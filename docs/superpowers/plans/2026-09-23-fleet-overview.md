# Fleet Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the read-only fleet overview landing screen specified in
`docs/superpowers/specs/2026-09-23-fleet-overview-design.md`: every van with a derived
red/amber/green status, a glance header with today and next-business-day coverage, an inspect
popover, and navigation into the existing week plan.

**Architecture:** One pure domain projection (`fleetStatus.ts`) computes everything; the UI renders
it and computes nothing. `App.tsx` grows its view value to `'fleet' | 'planning' | 'summary'` with
`'fleet'` as the default. Decisions and commit stay exclusively on the week plan.

**Tech Stack:** React 18, TypeScript, Vite, Vitest. No new dependencies.

## Global Constraints

- No new dependencies, no router, no new storage keys. View state is a `useState` value.
- `src/domain/` stays pure: no React, no DOM, no storage imports there.
- `src/ui/theme.css` design tokens only; reuse the existing palette variables, no new colour values.
- All copy in this plan is verbatim from the spec. Render it; do not rewrite it. Dates go through
  the existing `formatDay` / `formatLongDay` in `src/domain/clock.ts`.
- After every task: `npm test` all green (183 existing tests plus this plan's new suite),
  `npx tsc --noEmit` clean, `npm run build` succeeds.
- No component tests, per project precedent (design spec section 1). UI is verified live in a
  browser at the end of Task 2 and Task 3.
- Commit with CLI git, staging exact paths (`git add <file> <file>`). NEVER `git add -A` or
  `git add .`: parallel sibling sessions leave untracked work in this tree.
- Coordination boundary (spec section 11): a sibling session is redesigning the week-plan surface.
  Do not modify `DecisionQueue.tsx`, `ItemCard.tsx`, `ItemDetail.tsx`, `CapacityBand.tsx`,
  `PlanHeader.tsx`, `CommitSummary.tsx`, or existing `theme.css` blocks. Only append new CSS blocks
  and touch the files this plan names.

**Two corrections to the spec, decided here and recorded as the spec's own convention requires
(divergence stated at the point it occurs):**

1. The spec's section-5 label "In service, nothing open" becomes **"In service today"** (stat tile
   and grid heading). After commit, booked and watching vans live in that group, so the "nothing
   open" qualifier would be false on the very screen the demo shows after committing.
2. The popover's "View in week plan" link renders only when the van's item is in the active week's
   queue (`itemId !== null`). Selecting an item the queue does not list would open a detail panel
   with no corresponding queue card, which reads as a bug.

---

## File structure

| File | Change | Responsibility |
| --- | --- | --- |
| `src/domain/fleetStatus.ts` | Create | Pure projection: per-van statuses, counts, coverage facts |
| `src/domain/fleetStatus.test.ts` | Create | The projection's suite (Task 1) |
| `src/ui/NavTabs.tsx` | Create | Fleet today / Week plan tabs |
| `src/ui/InspectPopover.tsx` | Create | Per-van popover: content, close behaviour, edge flip |
| `src/ui/FleetView.tsx` | Create | Glance header, stat strip, attention cards, tile grid |
| `src/ui/DemoBar.tsx` | Modify | Reset also notifies App so the view returns to the fleet |
| `src/App.tsx` | Modify | View union with `'fleet'` default, tabs, navigation callbacks |
| `src/ui/theme.css` | Modify (append only) | New `.tabs .glance .stats .attn .fleetgrid .popover` blocks |
| `src/ui/CoverNote.tsx` | Modify | CTA label becomes "Open the fleet" |
| `src/ui/coverNoteContent.ts` | Modify | New opening paragraph in "What you are about to see"; paths entry |
| `docs/superpowers/specs/2026-09-23-cover-note-design.md` | Modify | Sections 3.5, 3.9 and 4 amended per its own copy rule |
| `README.md` | Modify | Walkthrough starts on the fleet view; counts and doc pointers updated |
| `docs/acceptance.md` | Modify | Dated addendum recording the fleet-view verification |

---

### Task 1: The fleet status projection

**Files:**
- Create: `src/domain/fleetStatus.ts`
- Test: `src/domain/fleetStatus.test.ts`

**Interfaces:**
- Consumes (all existing): `isHeldOn`, `computeDayCapacity`, `weekFixtureFor` from
  `src/domain/capacity.ts`; `visitsFromDecisions`, `visitCoversDate` from `src/domain/visits.ts`;
  `orderQueue` from `src/domain/urgency.ts`; `latestRecord` from `src/domain/deferral.ts`;
  `addDays`, `daysBetween`, `formatDay`, `mondayOf` from `src/domain/clock.ts`.
- Produces (Task 2 relies on these exact names):
  - `fleetOverview(args: { fixture: Fixture; weekId: WeekId; today: ISODate; queueItems: OpenItem[]; decisions: Record<ItemId, DraftDecision>; blockers: Blocker[]; committed: CommittedPlan | null; deferralHistory: Record<ItemId, DeferralRecord[]> }): FleetOverview`
  - `nextBusinessDay(fixture: Fixture, today: ISODate): ISODate`
  - Types `FleetStatusKind`, `VanStatus`, `CoverageFacts`, `FleetOverview` as defined below.

- [ ] **Step 1: Write the failing test file**

Create `src/domain/fleetStatus.test.ts` with exactly this content:

```ts
import { describe, expect, it } from 'vitest'
import { fixture, SEED_DATE } from './fixture'
import { fleetOverview, nextBusinessDay, type FleetOverview } from './fleetStatus'
import { validatePlan } from './validation'
import {
  activeWeekId,
  draftFor,
  initialState,
  planReducer,
  queueFor,
  type AppState,
} from '../state/planReducer'
import type { Fixture } from './types'

const WEEK_40 = '2026-09-28'

function overviewFor(state: AppState, fx: Fixture = fixture): FleetOverview {
  const weekId = activeWeekId(state)
  const decisions = draftFor({ fixture: fx, state, weekId })
  return fleetOverview({
    fixture: fx,
    weekId,
    today: state.demoDate,
    queueItems: queueFor({ fixture: fx, state, weekId }).map((e) => e.item),
    decisions,
    blockers: validatePlan({ fixture: fx, weekId, decisions }),
    committed: state.committedByWeek[weekId] ?? null,
    deferralHistory: state.deferralHistory,
  })
}

function vanOf(overview: FleetOverview, id: string) {
  const found = [...overview.attention, ...overview.quiet].find((s) => s.vehicleId === id)
  if (!found) throw new Error(`No status for ${id}`)
  return found
}

/** The walkthrough decisions: V-118 moved to Thursday, V-041 deferred, commit. */
function committedState(fx: Fixture = fixture): AppState {
  let s = initialState(fx)
  s = planReducer(
    s,
    {
      type: 'set-decision',
      weekId: WEEK_40,
      decision: { itemId: 'item-v118', treatment: 'act-now', slotDate: '2026-10-01', deferral: null },
    },
    fx,
  )
  s = planReducer(
    s,
    {
      type: 'set-decision',
      weekId: WEEK_40,
      decision: {
        itemId: 'item-v041',
        treatment: 'watch',
        slotDate: null,
        deferral: {
          reason: 'No drivability complaint. Assess if the code recurs.',
          reviewDate: '2026-10-05',
          trigger: { kind: 'event', eventId: 'v041-dtc-recurs', label: 'DTC P0300 recurs' },
        },
      },
    },
    fx,
  )
  return planReducer(s, { type: 'commit', weekId: WEEK_40 }, fx)
}

describe('fleet overview at cold open', () => {
  const o = overviewFor(initialState(fixture))

  it('counts 1 off the road, 4 needing a decision, 40 in service', () => {
    expect(o.counts).toEqual({ offRoad: 1, needsDecision: 4, inService: 40 })
    expect(o.onRoad).toBe(44)
    expect(o.committed).toBe(false)
  })

  it('orders attention exactly like the queue', () => {
    expect(o.attention.map((s) => s.vehicleId)).toEqual(['V-012', 'V-041', 'V-103', 'V-118', 'V-027'])
  })

  it('shows the held van with its hold reason and no workshop fact', () => {
    const v012 = vanOf(o, 'V-012')
    expect(v012.kind).toBe('off-road')
    expect(v012.facts).toEqual(['Held · Safety-relevant brake defect recorded at UVV inspection'])
    expect(v012.itemId).toBe('item-v012')
  })

  it('covers today with R-1 on site, and flags Tuesday standard short by 1', () => {
    expect(o.today.date).toBe(SEED_DATE)
    expect(o.today.covered).toBe(true)
    expect(o.today.coverOnSite).toEqual(['R-1'])
    expect(o.nextBusinessDay.date).toBe('2026-09-29')
    expect(o.nextBusinessDay.covered).toBe(false)
    expect(o.nextBusinessDay.shortfalls.map((s) => [s.vehicleClass, s.shortfall])).toEqual([
      ['standard', 1],
    ])
    expect(o.nextBusinessDay.coverOnSite).toEqual(['R-1', 'R-2'])
  })
})

describe('fleet overview after the walkthrough commit', () => {
  const o = overviewFor(committedState())

  it('clears every amber and flips the committed flag', () => {
    expect(o.counts).toEqual({ offRoad: 1, needsDecision: 0, inService: 44 })
    expect(o.committed).toBe(true)
  })

  it('labels booked and watching vans from the committed plan', () => {
    expect(vanOf(o, 'V-118').kind).toBe('in-service')
    expect(vanOf(o, 'V-118').facts).toEqual(['Booked Thu 1 Oct'])
    expect(vanOf(o, 'V-027').facts).toEqual(['Watching · review Mon 2 Nov'])
    expect(vanOf(o, 'V-041').facts).toEqual(['Watching · review Mon 5 Oct'])
  })

  it('keeps the held van red, now also carrying its booking', () => {
    expect(vanOf(o, 'V-012').facts).toEqual([
      'Held · Safety-relevant brake defect recorded at UVV inspection',
      'Booked Tue 29 Sep',
    ])
  })

  it('shows Tuesday clear after the move', () => {
    expect(o.nextBusinessDay.date).toBe('2026-09-29')
    expect(o.nextBusinessDay.covered).toBe(true)
  })
})

describe('fleet overview on the committed Tuesday', () => {
  const s = planReducer(committedState(), { type: 'advance-days', days: 1 }, fixture)
  const o = overviewFor(s)

  it('puts both visiting vans off the road, each exactly once', () => {
    expect(vanOf(o, 'V-012').facts).toEqual([
      'Held · Safety-relevant brake defect recorded at UVV inspection',
      'In workshop · day 1 of 1',
    ])
    expect(vanOf(o, 'V-103').kind).toBe('off-road')
    expect(vanOf(o, 'V-103').facts).toEqual(['In workshop · day 1 of 1'])
    expect(o.counts.offRoad).toBe(2)
    expect(o.onRoad).toBe(43)
  })

  it('still covers today, with both rentals on site', () => {
    expect(o.today.covered).toBe(true)
    expect(o.today.coverOnSite).toEqual(['R-1', 'R-2'])
  })
})

describe('fleet overview with a multi-day visit', () => {
  const twoDay: Fixture = {
    ...fixture,
    items: fixture.items.map((i) => (i.id === 'item-v103' ? { ...i, visitDays: 2 } : i)),
  }
  const s = planReducer(committedState(twoDay), { type: 'advance-days', days: 2 }, twoDay)
  const o = overviewFor(s, twoDay)

  it('counts every covered day with its position in the visit', () => {
    expect(vanOf(o, 'V-103').facts).toEqual(['In workshop · day 2 of 2'])
  })

  it('reproduces the Wednesday shortage, because R-2 does not cover Wednesday', () => {
    expect(o.today.covered).toBe(false)
    expect(o.today.shortfalls.map((s2) => [s2.vehicleClass, s2.shortfall])).toEqual([['standard', 1]])
  })
})

describe('fleet overview in week 41', () => {
  const s = planReducer(committedState(), { type: 'advance-to-next-review' }, fixture)

  it('lands on the review Monday with the resurfaced item amber', () => {
    expect(s.demoDate).toBe('2026-10-05')
    const o = overviewFor(s)
    expect(o.committed).toBe(false)
    expect(vanOf(o, 'V-041').kind).toBe('needs-decision')
    expect(vanOf(o, 'V-041').itemId).toBe('item-v041')
    expect(o.attention[0].vehicleId).toBe('V-041')
    expect(vanOf(o, 'V-012').kind).toBe('off-road')
  })

  it('releases the held van once the recorded release date passes', () => {
    const later = overviewFor(planReducer(s, { type: 'advance-days', days: 1 }, fixture))
    expect(vanOf(later, 'V-012').kind).toBe('in-service')
    expect(vanOf(later, 'V-012').facts).toEqual([])
    expect(vanOf(later, 'V-027').facts).toEqual(['Watching · review Mon 2 Nov'])
    expect(later.counts).toEqual({ offRoad: 0, needsDecision: 1, inService: 44 })
  })
})

describe('next business day', () => {
  it('is tomorrow inside the week and Monday from Friday', () => {
    expect(nextBusinessDay(fixture, '2026-09-28')).toBe('2026-09-29')
    expect(nextBusinessDay(fixture, '2026-10-02')).toBe('2026-10-05')
  })

  it('previews week 41 from Friday: covered, with R-1 only', () => {
    const s = planReducer(initialState(fixture), { type: 'advance-days', days: 4 }, fixture)
    const o = overviewFor(s)
    expect(o.nextBusinessDay.date).toBe('2026-10-05')
    expect(o.nextBusinessDay.covered).toBe(true)
    expect(o.nextBusinessDay.coverOnSite).toEqual(['R-1'])
  })
})
```

- [ ] **Step 2: Run the suite to verify it fails**

Run: `npx vitest run src/domain/fleetStatus.test.ts`
Expected: FAIL to collect, error resolving `./fleetStatus` (module does not exist yet).

- [ ] **Step 3: Implement the projection**

Create `src/domain/fleetStatus.ts` with exactly this content:

```ts
import { computeDayCapacity, isHeldOn, weekFixtureFor } from './capacity'
import { addDays, daysBetween, formatDay, mondayOf } from './clock'
import { latestRecord } from './deferral'
import type {
  Blocker,
  CommittedPlan,
  DayCapacity,
  DeferralRecord,
  DraftDecision,
  Fixture,
  ISODate,
  ItemId,
  OpenItem,
  Vehicle,
  VehicleClass,
  VehicleId,
  Visit,
  WeekId,
} from './types'
import { orderQueue } from './urgency'
import { visitCoversDate, visitsFromDecisions } from './visits'

export type FleetStatusKind = 'off-road' | 'needs-decision' | 'in-service'

export interface VanStatus {
  vehicleId: VehicleId
  vehicleClass: VehicleClass
  kind: FleetStatusKind
  /** Sub-label lines, already worded: 'Held · …', 'In workshop · day 1 of 2',
   *  'Booked Thu 1 Oct', 'Watching · review Mon 2 Nov'. Empty for a plain
   *  green van and for an amber one (the card renders the item instead). */
  facts: string[]
  /** Set when the van links into the week plan: its item is in the active
   *  week's queue. Null otherwise, and the UI renders no link. */
  itemId: ItemId | null
}

export interface CoverageFacts {
  date: ISODate
  covered: boolean
  shortfalls: DayCapacity[]
  coverOnSite: string[]
}

export interface FleetOverview {
  /** Red and amber vans, in the week plan's queue order. */
  attention: VanStatus[]
  /** Green vans, in fixture order. */
  quiet: VanStatus[]
  counts: { offRoad: number; needsDecision: number; inService: number }
  onRoad: number
  /** Operational reality: committed visits and holds only. */
  today: CoverageFacts
  /** Planning preview: the same effective decisions the capacity band renders. */
  nextBusinessDay: CoverageFacts
  committed: boolean
}

/** The next date in the active week's day list, else the following week's Monday. */
export function nextBusinessDay(fixture: Fixture, today: ISODate): ISODate {
  const week = weekFixtureFor(fixture, mondayOf(today))
  const upcoming = week.days.find((d) => d > today)
  if (upcoming !== undefined) return upcoming
  return weekFixtureFor(fixture, addDays(week.weekId, 7)).days[0]
}

function coverageFor(date: ISODate, fixture: Fixture, visits: Visit[]): CoverageFacts {
  const week = weekFixtureFor(fixture, mondayOf(date))
  const classes: VehicleClass[] = ['standard', 'specialist']
  const days = classes.map((vehicleClass) =>
    computeDayCapacity({ date, vehicleClass, fixture, visits, week }),
  )
  return {
    date,
    covered: days.every((d) => d.shortfall === 0),
    shortfalls: days.filter((d) => d.shortfall > 0),
    coverOnSite: fixture.covers
      .filter((c) => week.coverIds.includes(c.id) && c.confirmedDates.includes(date))
      .map((c) => c.id),
  }
}

export function fleetOverview(args: {
  fixture: Fixture
  weekId: WeekId
  today: ISODate
  queueItems: OpenItem[]
  decisions: Record<ItemId, DraftDecision>
  blockers: Blocker[]
  committed: CommittedPlan | null
  deferralHistory: Record<ItemId, DeferralRecord[]>
}): FleetOverview {
  const { fixture, today, queueItems, decisions, blockers, committed, deferralHistory } = args

  // A booking is operational once committed; drafts affect only the coverage
  // preview, exactly as they affect the band. [spec 4]
  const committedVisits =
    committed === null ? [] : visitsFromDecisions(committed.decisions, fixture.items)
  const draftVisits = visitsFromDecisions(decisions, fixture.items)

  const queueByVehicle = new Map<VehicleId, OpenItem>()
  for (const item of queueItems) {
    if (!queueByVehicle.has(item.vehicleId)) queueByVehicle.set(item.vehicleId, item)
  }

  function statusOf(vehicle: Vehicle): VanStatus {
    const offRoad: string[] = []
    const hold = vehicle.hold
    if (hold !== null && isHeldOn(vehicle, today)) offRoad.push(`Held · ${hold.reason}`)
    const visit = committedVisits.find(
      (v) => v.vehicleId === vehicle.id && visitCoversDate(v, today),
    )
    if (visit !== undefined) {
      offRoad.push(`In workshop · day ${daysBetween(visit.startDate, today) + 1} of ${visit.days}`)
    }

    const queueItem = queueByVehicle.get(vehicle.id) ?? null
    const committedDecision =
      queueItem !== null && committed !== null ? (committed.decisions[queueItem.id] ?? null) : null

    const planFacts: string[] = []
    if (
      committedDecision !== null &&
      committedDecision.treatment !== null &&
      committedDecision.treatment !== 'watch' &&
      committedDecision.slotDate !== null &&
      !(visit !== undefined && visit.itemId === committedDecision.itemId)
    ) {
      planFacts.push(`Booked ${formatDay(committedDecision.slotDate)}`)
    }
    // Watching reads from the ledger, the one recency definition. A resurfaced
    // item is back in the queue and goes amber instead, so no stale fact shows.
    for (const item of fixture.items) {
      if (item.vehicleId !== vehicle.id) continue
      if (queueItem !== null && item.id === queueItem.id && committedDecision === null) continue
      const latest = latestRecord(deferralHistory[item.id] ?? [])
      if (latest !== undefined) {
        planFacts.push(`Watching · review ${formatDay(latest.deferral.reviewDate)}`)
      }
    }

    const base = {
      vehicleId: vehicle.id,
      vehicleClass: vehicle.vehicleClass,
      itemId: queueItem === null ? null : queueItem.id,
    }
    if (offRoad.length > 0) return { ...base, kind: 'off-road', facts: [...offRoad, ...planFacts] }

    const unresolved =
      queueItem !== null && (committedDecision === null || committedDecision.treatment === null)
    if (unresolved) return { ...base, kind: 'needs-decision', facts: [] }
    return { ...base, kind: 'in-service', facts: planFacts }
  }

  const statuses = fixture.vehicles.map(statusOf)
  const ordered = orderQueue({ items: queueItems, decisions, blockers })
  const rank = new Map(ordered.map((item, index) => [item.vehicleId, index]))
  const attention = statuses
    .filter((s) => s.kind !== 'in-service')
    .sort(
      (a, b) =>
        (rank.get(a.vehicleId) ?? Number.MAX_SAFE_INTEGER) -
          (rank.get(b.vehicleId) ?? Number.MAX_SAFE_INTEGER) ||
        a.vehicleId.localeCompare(b.vehicleId),
    )
  const quiet = statuses.filter((s) => s.kind === 'in-service')

  const counts = {
    offRoad: statuses.filter((s) => s.kind === 'off-road').length,
    needsDecision: statuses.filter((s) => s.kind === 'needs-decision').length,
    inService: quiet.length,
  }

  return {
    attention,
    quiet,
    counts,
    onRoad: fixture.vehicles.length - counts.offRoad,
    today: coverageFor(today, fixture, committedVisits),
    nextBusinessDay: coverageFor(nextBusinessDay(fixture, today), fixture, draftVisits),
    committed: committed !== null,
  }
}
```

One wrinkle to understand before running: the `Watching` loop skips the van's own queue item only
while that item is uncommitted (`committedDecision === null`), so a van whose deferral was decided
in an EARLIER week (V-027 seen from week 41) still shows its fact, while a resurfaced-and-undecided
item never does (it is amber, and amber returns before the loop's output is used).

- [ ] **Step 4: Run the suite to verify it passes**

Run: `npx vitest run src/domain/fleetStatus.test.ts`
Expected: PASS, 16 tests.

- [ ] **Step 5: Run everything**

Run: `npm test` then `npx tsc --noEmit`
Expected: all suites pass (183 existing + 16 new = 199), tsc clean. If a cold-open expectation
fails, the defect is in this task's code, not the fixture: the fixture and its arithmetic are
review-hardened. Do not edit `src/domain/fixture.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/domain/fleetStatus.ts src/domain/fleetStatus.test.ts
git commit -m "feat: add the fleet status projection"
```

---

### Task 2: The fleet view, tabs, popover and app wiring

**Files:**
- Create: `src/ui/NavTabs.tsx`, `src/ui/InspectPopover.tsx`, `src/ui/FleetView.tsx`
- Modify: `src/ui/DemoBar.tsx`, `src/App.tsx`, `src/ui/theme.css` (append only)

**Interfaces:**
- Consumes: `fleetOverview`, `nextBusinessDay` types and function from Task 1 (exact signature in
  Task 1's Produces block); existing `usePlan()`, `activeWeekId`, `queueFor`, `draftFor`,
  `validatePlan`, `urgencyLabel`, `formatDay`, `formatLongDay`, `isoWeekNumber`, `addDays`.
- Produces: `FleetView({ decisions, blockers, onOpenPlan })` where
  `onOpenPlan: (itemId: ItemId | null) => void`; `NavTabs({ active, onNavigate })` with
  `active: 'fleet' | 'plan'`; `DemoBar({ onAbout, onReset })`.

- [ ] **Step 1: Append the new style blocks**

Append to the END of `src/ui/theme.css` (do not touch existing blocks):

```css
/* Fleet overview. A read-only landing surface: glance header, stat strip,
   attention cards, tile grid, inspect popover. All actions navigate. [FO spec 5] */
.tabs { display: flex; gap: 2px; padding: 0 18px; background: var(--surface); border-bottom: 1px solid var(--border); }
.tabs .tab {
  font-size: 12.5px; font-weight: 600; padding: 10px 14px 8px; color: var(--muted);
  background: none; border: none; border-bottom: 2px solid transparent;
}
.tabs .tab.on { color: var(--accent); border-bottom-color: var(--accent); }

.glance {
  display: flex; align-items: flex-start; gap: 16px; flex-wrap: wrap;
  padding: 14px 18px 12px; background: var(--surface); border-bottom: 1px solid var(--border);
}
.glance h1 { margin: 0 0 3px; font-size: 16px; font-weight: 650; letter-spacing: -0.01em; }
.glance .today { font-size: 12.5px; color: var(--muted); }
.glance .today b { color: var(--text); }
.glance .spacer { flex: 1; }
.glance .cta { text-align: right; }
.glance .cta > button {
  font-weight: 600; font-size: 13px; padding: 8px 16px; border-radius: var(--r);
  border: 1px solid var(--accent); background: var(--accent); color: #fff;
}
.glance .cta .sub { font-size: 11.5px; font-weight: 600; margin-top: 4px; color: var(--warn); }
.glance .cta .sub.ok { color: var(--ok); }
.glance .tomorrow {
  width: 100%; display: flex; align-items: center; gap: 7px;
  font-size: 11.5px; color: var(--crit); font-weight: 600;
}
.glance .tomorrow .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--crit); flex: none; }
.glance .tomorrow .fix {
  background: none; border: none; padding: 0; font-size: 11.5px;
  color: var(--accent); font-weight: 600; text-decoration: underline;
}

.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 12px 18px 0; }
.stats .stat {
  border: 1px solid var(--border); border-left-width: 4px; border-radius: var(--r);
  background: var(--surface); padding: 10px 12px;
}
.stats .stat .n { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.1; }
.stats .stat .l { font-size: 11px; color: var(--muted); font-weight: 600; margin-top: 2px; }
.stats .stat.crit { border-left-color: var(--crit); } .stats .stat.crit .n { color: var(--crit); }
.stats .stat.warn { border-left-color: var(--warn); } .stats .stat.warn .n { color: var(--warn); }
.stats .stat.ok { border-left-color: var(--ok); } .stats .stat.ok .n { color: var(--ok); }

.fleetsection { padding: 14px 18px 4px; }
.fleetsection > h2 {
  font-size: 11px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase;
  color: var(--faint); margin: 0 0 8px;
}
.fleetsection > h2 .hint { text-transform: none; letter-spacing: 0; font-weight: 500; }

.attn { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 8px; }
.acard {
  display: block; text-align: left; background: var(--surface);
  border: 1px solid var(--border); border-left-width: 4px; border-radius: var(--r);
  padding: 9px 11px 9px 13px;
}
.acard:hover { border-color: var(--border-strong); }
.acard.crit { border-left-color: var(--crit); }
.acard.warn { border-left-color: var(--warn); }
.acard .row1 { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-bottom: 3px; }
.acard .title { font-size: 12.5px; margin-bottom: 5px; }
.acard .why { font-size: 11.5px; color: var(--muted); }
.acard .go { margin-top: 6px; font-size: 11px; font-weight: 600; color: var(--accent); }

.legend { display: flex; gap: 16px; font-size: 11px; color: var(--muted); padding: 2px 0 10px; }
.specdot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--spec); }

.fleetgrid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(86px, 1fr));
  gap: 6px; padding-bottom: 16px;
}
.popwrap { position: relative; }
.tile {
  position: relative; width: 100%; background: var(--surface); border: 1px solid var(--border);
  border-bottom: 3px solid #bfe0cb; border-radius: 5px; padding: 7px 6px 6px; text-align: center;
}
.tile:hover { border-color: var(--border-strong); }
.tile.open { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }
.tile .vid { font-size: 12px; }
.tile .s { display: block; font-size: 9.5px; color: var(--ok); font-weight: 600; margin-top: 2px; }
.tile .specdot { position: absolute; top: 5px; right: 5px; }

.popover {
  position: absolute; z-index: 5; top: calc(100% + 6px); left: -2px; width: 268px; text-align: left;
  background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--r);
  box-shadow: 0 8px 24px rgba(20, 24, 29, 0.14); padding: 11px 12px;
}
.popover.flip { left: auto; right: -2px; }
.popover .head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.popover .badge.cls { background: #f2f4f6; color: #4a525c; }
.popover .kv { display: grid; grid-template-columns: 104px 1fr; gap: 3px 10px; font-size: 12px; margin: 0; }
.popover .kv dt { color: var(--muted); }
.popover .kv dd { margin: 0; }
.popover .foot {
  display: block; width: 100%; text-align: left; margin-top: 9px; padding: 8px 0 0;
  border-top: 1px dashed var(--border); font-size: 11.5px; font-weight: 600; color: var(--ok);
}
.popover button.foot { background: none; border-left: none; border-right: none; border-bottom: none; color: var(--accent); }
```

- [ ] **Step 2: Create the tabs**

Create `src/ui/NavTabs.tsx`:

```tsx
export function NavTabs({
  active,
  onNavigate,
}: {
  active: 'fleet' | 'plan'
  onNavigate: (tab: 'fleet' | 'plan') => void
}) {
  return (
    <nav className="tabs">
      <button className={`tab${active === 'fleet' ? ' on' : ''}`} onClick={() => onNavigate('fleet')}>
        Fleet today
      </button>
      <button className={`tab${active === 'plan' ? ' on' : ''}`} onClick={() => onNavigate('plan')}>
        Week plan
      </button>
    </nav>
  )
}
```

- [ ] **Step 3: Create the popover**

Create `src/ui/InspectPopover.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { formatDay } from '../domain/clock'
import type { ItemId, Vehicle } from '../domain/types'

/**
 * Read-only inspection of one van. Click-away and Escape close it; near the
 * right viewport edge it opens leftward so it never clips. [FO spec 6]
 */
export function InspectPopover({
  vehicle,
  facts,
  itemId,
  onClose,
  onOpenPlan,
}: {
  vehicle: Vehicle
  facts: string[]
  itemId: ItemId | null
  onClose: () => void
  onOpenPlan: (itemId: ItemId | null) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el !== null && el.getBoundingClientRect().right > window.innerWidth - 16) {
      el.classList.add('flip')
    }
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Element | null
      if (target === null || target.closest('.popwrap') === null) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div ref={ref} className="popover" role="dialog" aria-label={`${vehicle.id} details`}>
      <div className="head">
        <span className="vid">{vehicle.id}</span>
        <span className="badge cls">{vehicle.vehicleClass === 'specialist' ? 'Specialist' : 'Standard'}</span>
      </div>
      <dl className="kv">
        <dt>Model year</dt>
        <dd>{vehicle.modelYear}</dd>
        <dt>Odometer</dt>
        <dd>
          {vehicle.odometerKm.toLocaleString('en-GB')} km · read {formatDay(vehicle.odometerReadOn)}
        </dd>
        <dt>Typical week</dt>
        <dd>≈ {vehicle.weeklyRateKm.toLocaleString('en-GB')} km</dd>
        <dt>Status</dt>
        <dd>{facts.length > 0 ? facts.join(' · ') : 'In service · not held'}</dd>
      </dl>
      {itemId !== null ? (
        <button className="foot" onClick={() => onOpenPlan(itemId)}>
          View in week plan →
        </button>
      ) : (
        <div className="foot">{facts.length > 0 ? 'Follow-up recorded' : 'Nothing open for this van'}</div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create the fleet view**

Create `src/ui/FleetView.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { addDays, formatDay, formatLongDay, isoWeekNumber } from '../domain/clock'
import { fleetOverview, type VanStatus } from '../domain/fleetStatus'
import type { Blocker, DraftDecision, ItemId, VehicleId } from '../domain/types'
import { urgencyLabel } from '../domain/urgency'
import { usePlan } from '../state/PlanProvider'
import { activeWeekId, queueFor } from '../state/planReducer'
import { InspectPopover } from './InspectPopover'

export function FleetView({
  decisions,
  blockers,
  onOpenPlan,
}: {
  decisions: Record<ItemId, DraftDecision>
  blockers: Blocker[]
  onOpenPlan: (itemId: ItemId | null) => void
}) {
  const { state, fixture } = usePlan()
  const weekId = activeWeekId(state)
  const [inspected, setInspected] = useState<VehicleId | null>(null)

  const overview = useMemo(
    () =>
      fleetOverview({
        fixture,
        weekId,
        today: state.demoDate,
        queueItems: queueFor({ fixture, state, weekId }).map((e) => e.item),
        decisions,
        blockers,
        committed: state.committedByWeek[weekId] ?? null,
        deferralHistory: state.deferralHistory,
      }),
    [fixture, state, weekId, decisions, blockers],
  )

  const specialists = fixture.vehicles.filter((v) => v.vehicleClass === 'specialist').length
  const next = overview.nextBusinessDay
  const nextLabel = next.date === addDays(state.demoDate, 1) ? 'Tomorrow' : 'Next business day'

  const closeInspect = (vehicleId: VehicleId) => {
    setInspected(null)
    document.getElementById(`tile-${vehicleId}`)?.focus()
  }

  return (
    <>
      <div className="glance">
        <div>
          <h1>Fleet · {formatLongDay(state.demoDate)}</h1>
          <div className="today">
            <b>
              {overview.onRoad} of {fixture.vehicles.length}
            </b>{' '}
            vans on the road ·{' '}
            {overview.today.covered
              ? 'every assignment covered today'
              : overview.today.shortfalls
                  .map((s) => `${s.vehicleClass} short by ${s.shortfall} today`)
                  .join(' · ')}
            {overview.today.coverOnSite.length > 0 && <> · {overview.today.coverOnSite.join(', ')} on site</>}
          </div>
        </div>
        <span className="spacer" />
        <div className="cta">
          <button onClick={() => onOpenPlan(null)}>Open the week plan →</button>
          <div className={`sub${overview.committed ? ' ok' : ''}`}>
            {overview.committed
              ? `Week ${isoWeekNumber(weekId)} committed`
              : `${overview.attention.length} items waiting for week ${isoWeekNumber(weekId)}`}
          </div>
        </div>
        {!next.covered && (
          <div className="tomorrow">
            <span className="dot" />
            {nextLabel}, {formatDay(next.date)}:{' '}
            {next.shortfalls.map((s) => `${s.vehicleClass} short by ${s.shortfall}`).join(', ')} as
            currently planned ·{' '}
            <button className="fix" onClick={() => onOpenPlan(null)}>
              resolve in the week plan
            </button>
          </div>
        )}
      </div>

      <div className="stats">
        <div className="stat crit">
          <div className="n">{overview.counts.offRoad}</div>
          <div className="l">Off the road</div>
        </div>
        <div className="stat warn">
          <div className="n">{overview.counts.needsDecision}</div>
          <div className="l">Need a decision</div>
        </div>
        <div className="stat ok">
          <div className="n">{overview.counts.inService}</div>
          <div className="l">In service today</div>
        </div>
      </div>

      <div className="fleetsection">
        <h2>
          Needs attention <span className="hint">· click a van to open it in the week plan</span>
        </h2>
        {overview.attention.length === 0 && (
          <p className="empty">Nothing needs attention. All {fixture.vehicles.length} vans in service.</p>
        )}
        <div className="attn">
          {overview.attention.map((s) => (
            <AttentionCard key={s.vehicleId} status={s} onOpenPlan={onOpenPlan} />
          ))}
        </div>
      </div>

      <div className="fleetsection">
        <h2>
          In service today · {overview.quiet.length}{' '}
          <span className="hint">· click any van to inspect</span>
        </h2>
        <div className="legend">
          <span>
            <span className="specdot" /> Specialist van ({specialists} in fleet)
          </span>
        </div>
        <div className="fleetgrid">
          {overview.quiet.map((s) => (
            <div className="popwrap" key={s.vehicleId}>
              <button
                id={`tile-${s.vehicleId}`}
                className={`tile${inspected === s.vehicleId ? ' open' : ''}`}
                aria-expanded={inspected === s.vehicleId}
                onClick={() => setInspected(inspected === s.vehicleId ? null : s.vehicleId)}
              >
                {s.vehicleClass === 'specialist' && <span className="specdot" />}
                <span className="vid">{s.vehicleId}</span>
                {s.facts.length > 0 && <span className="s">{s.facts[0]}</span>}
              </button>
              {inspected === s.vehicleId && (
                <InspectPopover
                  vehicle={fixture.vehicles.find((v) => v.id === s.vehicleId)!}
                  facts={s.facts}
                  itemId={s.itemId}
                  onClose={() => closeInspect(s.vehicleId)}
                  onOpenPlan={onOpenPlan}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function AttentionCard({
  status,
  onOpenPlan,
}: {
  status: VanStatus
  onOpenPlan: (itemId: ItemId | null) => void
}) {
  const { fixture } = usePlan()
  const item = fixture.items.find((i) => i.id === status.itemId) ?? null
  return (
    <button
      className={`acard ${status.kind === 'off-road' ? 'crit' : 'warn'}`}
      onClick={() => onOpenPlan(status.itemId)}
    >
      <div className="row1">
        <span className="vid">{status.vehicleId}</span>
        {item !== null && item.safetyClass && <span className="badge safety">Safety · hard stop</span>}
        {status.kind === 'off-road' && <span className="badge held">Off the road</span>}
        {status.vehicleClass === 'specialist' && <span className="badge specialist">Specialist</span>}
        {item !== null && (
          <span className={`urg ${item.urgency.kind}`}>{urgencyLabel(item.urgency.kind)}</span>
        )}
      </div>
      {item !== null && <div className="title">{item.title}</div>}
      <div className="why">
        {status.kind === 'off-road' ? status.facts.join(' · ') : item !== null ? item.urgency.because : ''}
      </div>
      <div className="go">Open in week plan →</div>
    </button>
  )
}
```

- [ ] **Step 5: Give the demo bar a reset callback**

Modify `src/ui/DemoBar.tsx`. The signature line

```tsx
export function DemoBar({ onAbout }: { onAbout: () => void }) {
```

becomes

```tsx
export function DemoBar({ onAbout, onReset }: { onAbout: () => void; onReset: () => void }) {
```

and the reset button

```tsx
      <button onClick={() => dispatch({ type: 'reset' })}>Reset scenario</button>
```

becomes

```tsx
      <button
        onClick={() => {
          dispatch({ type: 'reset' })
          // Resetting inside week 40 changes no week id, so the week-change
          // effect cannot restore the landing view; the callback does. [FO spec 3]
          onReset()
        }}
      >
        Reset scenario
      </button>
```

- [ ] **Step 6: Rewire the app shell**

**Integration note, added after Task 1 landed.** Between this plan being written and this step
executing, the sibling week-plan redesign (spec section 11) merged to `main` and changed the
`App.tsx` on disk: `PlanHeader` now takes two more props, `decisions` and `onSelectItem`, to drive
its blocker chips. The replacement below already carries that forward (`decisions={decisions}` and
`onSelectItem={setSelectedItemId}` on the `<PlanHeader>` element inside the `planning`/`summary`
branch) — it is not the literal pre-merge file. Before running this step, diff the current
`src/App.tsx` against the block below; if `PlanHeader` has gained further props since, carry those
forward the same way rather than reverting them.

Replace the entire content of `src/App.tsx` with:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { validatePlan } from './domain/validation'
import type { ItemId } from './domain/types'
import { hasSeenCoverNote, markCoverNoteSeen } from './state/coverNoteSeen'
import { usePlan } from './state/PlanProvider'
import { activeWeekId, draftFor } from './state/planReducer'
import { CapacityBand } from './ui/CapacityBand'
import { CommitSummary } from './ui/CommitSummary'
import { CoverNote } from './ui/CoverNote'
import { DecisionQueue } from './ui/DecisionQueue'
import { DemoBar } from './ui/DemoBar'
import { FleetView } from './ui/FleetView'
import { ItemDetail } from './ui/ItemDetail'
import { NavTabs } from './ui/NavTabs'
import { PlanHeader } from './ui/PlanHeader'

export default function App() {
  const { state, dispatch, fixture } = usePlan()
  const [selectedItemId, setSelectedItemId] = useState<ItemId | null>(null)
  // A value, not a router: three states, no URLs, no history entries. The
  // fleet view is the landing surface; decisions stay on the week plan.
  // [FO spec 3]
  const [view, setView] = useState<'fleet' | 'planning' | 'summary'>('fleet')
  // [cover note spec 5.4] Lazy-initialised so the synchronous localStorage
  // read only happens once, on mount, not on every render.
  const [showCoverNote, setShowCoverNote] = useState(() => !hasSeenCoverNote())

  const weekId = activeWeekId(state)

  useEffect(() => {
    setView('fleet')
    setSelectedItemId(null)
  }, [weekId])

  const decisions = useMemo(() => draftFor({ fixture, state, weekId }), [fixture, state, weekId])
  const blockers = useMemo(
    () => validatePlan({ fixture, weekId, decisions }),
    [fixture, weekId, decisions],
  )
  const selectedItem = fixture.items.find((i) => i.id === selectedItemId) ?? null

  const openPlan = (itemId: ItemId | null) => {
    if (itemId !== null) setSelectedItemId(itemId)
    setView('planning')
  }

  // The cover note is a full screen, not chrome over the plan: the demo bar
  // does not render here. [cover note spec 4]
  if (showCoverNote) {
    return (
      <CoverNote
        onOpenPlan={() => {
          markCoverNoteSeen()
          setShowCoverNote(false)
        }}
      />
    )
  }

  return (
    <>
      <DemoBar
        onAbout={() => setShowCoverNote(true)}
        onReset={() => {
          setView('fleet')
          setSelectedItemId(null)
        }}
      />
      <NavTabs
        active={view === 'fleet' ? 'fleet' : 'plan'}
        onNavigate={(tab) => {
          if (tab === 'fleet') setView('fleet')
          // Clicking the already-active plan tab must not yank summary back
          // to planning. [FO spec 3]
          else if (view === 'fleet') setView('planning')
        }}
      />
      {view === 'fleet' ? (
        <FleetView decisions={decisions} blockers={blockers} onOpenPlan={openPlan} />
      ) : (
        <>
          <PlanHeader
            blockers={blockers}
            decisions={decisions}
            onCommit={() => {
              dispatch({ type: 'commit', weekId })
              setView('summary')
            }}
            onSelectItem={setSelectedItemId}
          />
          <CapacityBand decisions={decisions} selectedItemId={selectedItemId} />
          {view === 'summary' && state.committedByWeek[weekId] ? (
            <CommitSummary onEdit={() => setView('planning')} />
          ) : (
            <div className="split">
              <DecisionQueue
                decisions={decisions}
                blockers={blockers}
                selectedItemId={selectedItemId}
                onSelect={setSelectedItemId}
              />
              <div className="pane right">
                {selectedItem === null ? (
                  <p className="empty">Select an item to see its evidence and options.</p>
                ) : (
                  <ItemDetail
                    key={selectedItem.id}
                    item={selectedItem}
                    decisions={decisions}
                    onChange={(decision) => dispatch({ type: 'set-decision', weekId, decision })}
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
```

- [ ] **Step 7: Run the checks**

Run: `npm test` then `npx tsc --noEmit` then `npm run build`
Expected: 199 tests pass, tsc clean, build succeeds.

- [ ] **Step 8: Verify live in the browser**

Run `npm run dev` and check each item against the running app (a fresh profile or cleared
`localStorage` where cold open matters). This is the mandatory manual pass; every item must hold:

1. After the cover note (fresh profile), the app lands on **Fleet today**: header reads
   `Fleet · Monday 28 September 2026`, `44 of 45 vans on the road · every assignment covered today
   · R-1 on site`, warning line `Tomorrow, Tue 29 Sep: standard short by 1 as currently planned`.
2. Stat strip reads 1 / 4 / 40. Attention cards in order V-012, V-041, V-103, V-118, V-027; V-012
   carries `Safety · hard stop`, `Off the road`, and its hold reason.
3. Click a green tile: popover shows model year, odometer with read date, typical week, status;
   click-away, Escape and re-click all close it; Escape returns focus to the tile. A tile in the
   rightmost column opens its popover leftward (no clipping).
4. Click the V-118 card: week plan opens with V-118 selected in queue and detail panel.
5. Tab to Fleet today and back: an in-progress draft (e.g. V-118 moved to Thursday) survives.
6. Run the walkthrough (move V-118 to Thursday, defer V-041, commit): summary appears; Fleet today
   now shows `Week 40 committed`, no ambers, V-118 tile `Booked Thu 1 Oct`, V-027 and V-041 tiles
   `Watching · …`, V-012 card also carrying `Booked Tue 29 Sep`, and no tomorrow warning line.
7. Advance 1 day (Tuesday): V-012 and V-103 both off the road with workshop facts; 43 of 45.
8. Advance to next review date: week 41 lands on Fleet today with V-041 amber (`Resurfaced` in the
   week plan queue) and V-012 still red on Monday; advance 1 day and V-012 goes green.
9. Reset from the week plan: app returns to Fleet today with the cold-open board (item 1's exact
   state). Reload mid-draft: app lands on Fleet today; the draft is still in the week plan.

Record any failures, fix, and re-run the affected checks before committing.

- [ ] **Step 9: Commit**

```bash
git add src/ui/NavTabs.tsx src/ui/InspectPopover.tsx src/ui/FleetView.tsx src/ui/DemoBar.tsx src/App.tsx src/ui/theme.css
git commit -m "feat: add the fleet overview landing screen"
```

---

### Task 3: The cover note bridge, handoff docs and acceptance addendum

**Files:**
- Modify: `src/ui/CoverNote.tsx`, `src/ui/coverNoteContent.ts`
- Modify: `docs/superpowers/specs/2026-09-23-cover-note-design.md`, `README.md`, `docs/acceptance.md`

**Interfaces:**
- Consumes: the Task 2 landing behaviour (cover note click-through now lands on the fleet view).
- Produces: nothing consumed by other tasks; this is the copy-honesty and handoff task. The cover
  note spec's own rule applies: verify copy against the built surface, and correct the copy rather
  than the screen.

- [ ] **Step 1: Rename the cover note action**

In `src/ui/CoverNote.tsx`, the button content

```tsx
          Open this week's plan
```

becomes

```tsx
          Open the fleet
```

(The `onOpenPlan` prop name stays; renaming a prop across App and tests buys nothing.)

- [ ] **Step 2: Add the bridge paragraph to the cover note copy**

In `src/ui/coverNoteContent.ts`, the `what-you-will-see` block's paragraphs begin with:

```ts
        'One planning week. A capacity band across the top that stays visible while you work, because it is the thing every decision moves. Below it, five decisions waiting on you.',
```

Insert this new first paragraph directly above that line (verbatim, from the fleet overview spec
section 10):

```ts
        'You land on the fleet first: 45 vans, one already off the road, and a short list of what needs you. It answers the daily question, is today fine, before you plan the week. The weekly plan is one tab over, and everything below describes it.',
```

- [ ] **Step 3: Correct the paths entry**

In the same file, the `thinking` block entry

```ts
          path: 'docs/mockups/',
          description: 'The two layouts the layout decision was made from',
```

becomes

```ts
          path: 'docs/mockups/',
          description: 'Layout decisions and the alternatives they were made from',
```

("The two layouts" stopped being true when the fleet overview mockups landed in `docs/mockups/`.)

- [ ] **Step 4: Amend the cover note spec**

In `docs/superpowers/specs/2026-09-23-cover-note-design.md`:

(a) In section 3.5, insert the same bridge paragraph as a new first blockquote line, so the quoted
copy begins:

```markdown
> You land on the fleet first: 45 vans, one already off the road, and a short list of what needs
> you. It answers the daily question, is today fine, before you plan the week. The weekly plan is
> one tab over, and everything below describes it.
>
> One planning week. A capacity band across the top that stays visible while you work, because it
```

(b) Append to section 3.5's existing "Implementation note" paragraph:

```markdown
Amended again on the same date for the fleet overview
(`docs/superpowers/specs/2026-09-23-fleet-overview-design.md`): the click-through now lands on the
fleet view, the action label is **Open the fleet**, and the block gains the bridge paragraph above.
```

(c) In section 3.9's table, the `docs/mockups/` row description "The two layouts the layout
decision was made from" becomes "Layout decisions and the alternatives they were made from".

(d) In the section 4 behaviour table, these three rows:

```markdown
| **Open this week's plan** | Flag is set, plan surface is shown |
| Any later load, flag set | Plan surface directly, no cover note |
```

```markdown
| **Open this week's plan**, reached via About | Identical behaviour. Returns to the plan, flag already set |
```

become:

```markdown
| **Open the fleet** | Flag is set, the fleet view is shown |
| Any later load, flag set | Fleet view directly, no cover note |
```

```markdown
| **Open the fleet**, reached via About | Identical behaviour. Returns to the fleet view, flag already set |
```

- [ ] **Step 5: Update the README**

Four edits in `README.md`:

(a) The cover note paragraph sentence

```markdown
`Open this week's plan` continues to the app, and
`About this prototype` in the demo bar brings the note back at any time.
```

becomes

```markdown
`Open the fleet` continues to the app, landing on the
fleet overview, and `About this prototype` in the demo bar brings the note back at any time.
```

(b) The walkthrough's step 1

```markdown
1. The plan opens on week 40 with five decisions and two blockers. `V-012` is already out of service,
   before anything is committed.
```

becomes

```markdown
1. The app opens on **Fleet today**: 45 vans at a glance, one already off the road, four more
   needing a decision, and tomorrow's shortfall flagged. Click any quiet van to inspect it.
2. Switch to the week plan. Week 40 carries five decisions and two blockers. `V-012` is already out
   of service, before anything is committed.
```

and the remaining steps renumber from 3 to 8 (content unchanged).

(c) The test-count comment in the Running it section: replace `183 tests` with the CURRENT total
reported by running `npm test` yourself right before this edit. (Originally estimated at 199; by
the time Tasks 1 and 2 landed, a concurrent sibling session had also merged its own tests, and the
actual total was 209. Use whatever `npm test` reports at the moment you make this edit, not either
number written here — this file is not the live source of truth for a count that drifts.)

(d) **Reconciliation, added after a sibling session's merge changed this exact line.** The plan's
original text assumed the mockups bullet in "Where the thinking lives" was still one line reading
"the two layouts the layout decision was made from". A concurrent sibling session (the week-plan
declutter redesign) already edited that same bullet to a two-line form documenting its own mockup.
Before editing, read the current `README.md` "Where the thinking lives" section and confirm what
is actually there. As of this plan update it reads:

```markdown
- `docs/mockups/`: the two layouts the layout decision was made from, and the guided-queue
  declutter proposal the current surface follows
```

Change it to (extending the sibling's sentence rather than reverting it):

```markdown
- `docs/mockups/`: layout decisions and the alternatives they were made from, including the
  guided-queue declutter proposal the current surface follows
```

and add this line after the cover-note spec line:
`` - `docs/superpowers/specs/2026-09-23-fleet-overview-design.md`: the fleet overview landing screen, specified separately ``

If the bullet has drifted again since this plan update (another concurrent edit), apply the same
principle: keep every prior session's pointer, phrase the sentence to include all of them, don't
revert anything.

- [ ] **Step 6: Run the full verification**

Run: `npm test`, `npx tsc --noEmit`, `npm run build`, then open `dist/index.html` from the
filesystem and confirm: cover note appears on a fresh profile, its button reads **Open the fleet**,
and clicking it lands on the fleet view. Then re-run Task 2's browser checks 1, 6 and 9 against
`npm run dev` (the copy changes touch the landing path those checks cover).
Expected: all green, identical behaviour.

- [ ] **Step 7: Append the acceptance addendum**

Append to `docs/acceptance.md` (fill the two bracketed values from the actual run: the short hash
from `git rev-parse --short HEAD` after Step 8's first commit, and the test total from `npm test`):

```markdown
## Addendum: the fleet overview landing screen (2026-09-23)

**Build:** [short hash] · **Commands:** `npm test` ([N] tests, all passing), `npx tsc --noEmit`
(clean), `npm run build` (succeeds; `dist/index.html` verified from a filesystem origin), plus the
live browser checks below.

The app now lands on a read-only fleet overview ahead of the weekly plan
(`docs/superpowers/specs/2026-09-23-fleet-overview-design.md`). The weekly plan remains the only
decision surface; the overview's only verb is navigation. Statuses are fully derived: red from
holds and committed visits, amber from queue items not resolved by a committed disposition, green
otherwise with booked and watching sub-labels from the committed plan and the deferral ledger.

**Verified live:** cold-open board (1 off the road, 4 needing a decision, 40 in service, attention
in queue order, Tuesday shortfall flagged for tomorrow); click-through to the week plan with the
item pre-selected; inspect popover open, close, Escape and edge behaviour; committed-week board
(booked, watching, no tomorrow warning); Tuesday with two vans off the road; week 41 resurfacing
with the V-012 release; reset and reload both landing on the fleet view.

**G1 restated from the new landing.** The structural claim now starts one screen earlier: at cold
open the fleet view shows the exception (V-012, held, safety) first among five attention cards,
with the 45-van fleet represented without a 45-row list. The observed one-minute criterion remains
**not run** (no unfamiliar observer), unchanged from the main record.
```

- [ ] **Step 8: Commit, code and docs separately**

```bash
git add src/ui/CoverNote.tsx src/ui/coverNoteContent.ts
git commit -m "feat: open the fleet from the cover note"
git add docs/superpowers/specs/2026-09-23-cover-note-design.md README.md docs/acceptance.md
git commit -m "docs: record the fleet overview in the handoff and acceptance"
```

---

## Plan self-review record

Checked against the spec after writing:

- **Spec coverage:** section 3 navigation table → Task 2 steps 2, 5, 6, checks 4, 5, 8, 9;
  section 4 status model and header facts → Task 1; section 5 layout → Task 2 step 4; section 6
  popover → Task 2 step 3, check 3; section 7 architecture → file structure and Tasks 1 and 2;
  section 8 edge cases → Task 1 tests (multi-day, week 41, Friday); section 9 testing → Task 1
  suite plus Task 2 step 8 and Task 3 step 6; section 10 documentation → Task 3; section 11
  coordination → Global Constraints. Section 13's observed-walkthrough caveat → acceptance
  addendum's last paragraph.
- **Placeholders:** the only bracketed values are the two measured ones in the acceptance addendum,
  filled from command output at execution time.
- **Type consistency:** `fleetOverview` and `nextBusinessDay` signatures match between Task 1's
  Produces block, its implementation, its tests, and Task 2's `FleetView`; `onOpenPlan(itemId:
  ItemId | null)` is identical in `FleetView`, `AttentionCard`, `InspectPopover` and `App.tsx`;
  `DemoBar`'s new `onReset` matches its call site in `App.tsx`.
