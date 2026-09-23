# Guided-Queue Declutter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the weekly plan surface into a guided queue: slim two-row tiles grouped by what blocks commit, blocker chips beside the Commit button, one meaning for red, and a capacity band that is loud only on exception days.

**Architecture:** Presentation layer only. One new pure view-model module (`src/ui/grouping.ts`) derives queue groups and blocker chips from state that already exists (`blockersForItem`, draft decisions); five existing UI components and `theme.css` are restyled around it. Nothing under `src/domain/` or `src/state/` changes.

**Tech Stack:** React 19, TypeScript, Vite 8, vitest 5. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-23-guided-queue-declutter-design.md` (cited as `[D §n]`). Visual reference: `docs/mockups/redesign-guided-queue.mockup.html`.

## Global Constraints

- Do not modify anything under `src/domain/` or `src/state/`. The existing 183 tests must pass **unmodified**. [D §2]
- No new dependencies. No component-test infrastructure. [D §10]
- Copy is exact. Status strings [D §3]: `Causes Tue shortfall` (weekday of the short day), `Slot not bookable`, `No decision`, `Watch, incomplete`, `Watch until {formatDay}`, `{formatDay} booked`, plus unchanged `No slot chosen`. Chip strings [D §5]: `{formatDay(date)} · {vehicleClass} short {shortBy}` for capacity, `{vehicleId} · no decision`, `{vehicleId} · parts not ready`, `{vehicleId} · slot not bookable`.
- The red rule [D §6]: after this work, red at week-40 open appears only in blocker chips, the Blocking group (header, left edges, statuses), the Tue band cell and flagline, `no specialist cover`, and the safety badge. The Deadline chip is dark (`#2b3138`), not red.
- All dates render through `formatDay` from `src/domain/clock.ts`.
- Run `npm test` (vitest) and `npm run build` (tsc + vite) before every commit; both must pass.
- Untracked files from other sessions exist in the working tree (`docs/mockups/fleet-overview-*`, `docs/superpowers/specs/2026-09-23-fleet-overview-design.md`, `.nimbalyst/`). Never `git add .`; always add exact paths.

---

### Task 1: Queue grouping and blocker-chip view models

**Files:**
- Create: `src/ui/grouping.ts`
- Test: `src/ui/grouping.test.ts`

**Interfaces:**
- Consumes: `orderQueue` (`src/domain/urgency.ts`), `blockersForItem` (`src/domain/validation.ts`), `formatDay` (`src/domain/clock.ts`), types from `src/domain/types.ts`.
- Produces (used by Tasks 2 and 3):
  - `type QueueGroupKind = 'blocking' | 'open' | 'settled'`
  - `interface QueueGroup { kind: QueueGroupKind; label: string; items: OpenItem[] }`
  - `groupQueue(args: { items: OpenItem[]; decisions: Record<ItemId, DraftDecision>; blockers: Blocker[]; fixture: Fixture }): QueueGroup[]` — ordered by `orderQueue` within groups, empty groups omitted.
  - `interface BlockerChip { key: string; label: string; targetItemId: ItemId | null }`
  - `blockerChips(args: { blockers: Blocker[]; items: OpenItem[]; decisions: Record<ItemId, DraftDecision>; fixture: Fixture }): BlockerChip[]` — one chip per blocker, in `validatePlan` order.

- [ ] **Step 1: Write the failing tests**

Create `src/ui/grouping.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { fixture } from '../domain/fixture'
import { validatePlan } from '../domain/validation'
import type { DraftDecision } from '../domain/types'
import { activeWeekId, draftFor, initialState, queueFor } from '../state/planReducer'
import { blockerChips, classifyItem, groupQueue } from './grouping'

const state = initialState(fixture)
const weekId = activeWeekId(state)
const entries = queueFor({ fixture, state, weekId })
const items = entries.map((e) => e.item)
const decisions = draftFor({ fixture, state, weekId })
const blockers = validatePlan({ fixture, weekId, decisions })

const idOf = (vehicleId: string) => items.find((i) => i.vehicleId === vehicleId)!.id

describe('groupQueue at week-40 open', () => {
  const groups = groupQueue({ items, decisions, blockers, fixture })

  it('renders exactly two groups: blocking, then settled', () => {
    expect(groups.map((g) => g.kind)).toEqual(['blocking', 'settled'])
    expect(groups.map((g) => g.label)).toEqual(['Blocking the week', 'Settled'])
  })

  it('puts the blocked items first, in orderQueue order', () => {
    expect(groups[0].items.map((i) => i.vehicleId)).toEqual(['V-041', 'V-103', 'V-118'])
  })

  it('settles the booked hard stop and the watched item', () => {
    // V-012 is held, so the Tue shortfall is not attributed to it. [S 4.5]
    expect(groups[1].items.map((i) => i.vehicleId)).toEqual(['V-012', 'V-027'])
  })
})

describe('groupQueue once the week is clear', () => {
  const v041 = items.find((i) => i.vehicleId === 'V-041')!
  const cleared: Record<string, DraftDecision> = {
    ...decisions,
    [idOf('V-041')]: {
      itemId: idOf('V-041'),
      treatment: 'watch',
      slotDate: null,
      deferral: {
        reason: 'No specialist cover exists this week.',
        reviewDate: '2026-10-05',
        trigger: v041.triggerOptions[0],
      },
    },
    // Moving V-118 to Thursday clears the Tuesday shortfall (README step 2).
    [idOf('V-118')]: { ...decisions[idOf('V-118')], slotDate: '2026-10-01' },
  }
  const clearedBlockers = validatePlan({ fixture, weekId, decisions: cleared })

  it('has no blockers left', () => {
    expect(clearedBlockers).toEqual([])
  })

  it('renders a single settled group of five', () => {
    const groups = groupQueue({ items, decisions: cleared, blockers: clearedBlockers, fixture })
    expect(groups.map((g) => g.kind)).toEqual(['settled'])
    expect(groups[0].items).toHaveLength(5)
  })
})

describe('classifyItem', () => {
  it('classifies undecided-with-no-blockers as open, though validation never produces it', () => {
    // [D §4]: the third state is unreachable under current validation rules,
    // but the classifier stays total.
    const v041 = items.find((i) => i.vehicleId === 'V-041')!
    expect(classifyItem({ item: v041, decision: undefined, blockers: [], fixture })).toBe('open')
  })
})

describe('blockerChips at week-40 open', () => {
  const chips = blockerChips({ blockers, items, decisions, fixture })

  it('renders one chip per blocker with the spec copy', () => {
    expect(chips.map((c) => c.label)).toEqual([
      'V-041 · no decision',
      'Tue 29 Sep · standard short 1',
    ])
  })

  it('targets the undisposed item directly', () => {
    expect(chips[0].targetItemId).toBe(idOf('V-041'))
  })

  it('targets the first contributing item in queue order for the capacity blocker', () => {
    expect(chips[1].targetItemId).toBe(idOf('V-103'))
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/grouping.test.ts`
Expected: FAIL — `Cannot find module './grouping'` (or equivalent resolve error).

- [ ] **Step 3: Implement `src/ui/grouping.ts`**

```ts
import { formatDay } from '../domain/clock'
import { orderQueue } from '../domain/urgency'
import { blockersForItem } from '../domain/validation'
import type { Blocker, DraftDecision, Fixture, ItemId, OpenItem } from '../domain/types'

export type QueueGroupKind = 'blocking' | 'open' | 'settled'

export interface QueueGroup {
  kind: QueueGroupKind
  label: string
  items: OpenItem[]
}

const GROUP_LABELS: Record<QueueGroupKind, string> = {
  blocking: 'Blocking the week',
  open: 'To decide',
  settled: 'Settled',
}

/**
 * Exhaustive classification of a queue item. Under current validation rules
 * 'open' cannot occur: an absent or incomplete decision is itself a commit
 * blocker, so undecided always means blocking. The classifier stays total so
 * a future relaxation of validation gets a third group for free. [D §4]
 */
export function classifyItem(args: {
  item: OpenItem
  decision: DraftDecision | undefined
  blockers: Blocker[]
  fixture: Fixture
}): QueueGroupKind {
  const { item, decision, blockers, fixture } = args
  if (blockersForItem(blockers, item, fixture).length > 0) return 'blocking'
  if (!decision || decision.treatment === null) return 'open'
  if (decision.treatment === 'watch') return decision.deferral === null ? 'open' : 'settled'
  return decision.slotDate === null ? 'open' : 'settled'
}

/** Groups in fixed order, orderQueue order within each, empty groups omitted. [D §4] */
export function groupQueue(args: {
  items: OpenItem[]
  decisions: Record<ItemId, DraftDecision>
  blockers: Blocker[]
  fixture: Fixture
}): QueueGroup[] {
  const { decisions, blockers, fixture } = args
  const by: Record<QueueGroupKind, OpenItem[]> = { blocking: [], open: [], settled: [] }
  for (const item of orderQueue(args)) {
    by[classifyItem({ item, decision: decisions[item.id], blockers, fixture })].push(item)
  }
  return (['blocking', 'open', 'settled'] as const)
    .filter((kind) => by[kind].length > 0)
    .map((kind) => ({ kind, label: GROUP_LABELS[kind], items: by[kind] }))
}

export interface BlockerChip {
  key: string
  label: string
  targetItemId: ItemId | null
}

/**
 * One chip per blocker, in the order validatePlan produced them. An
 * item-attributed blocker targets its item; a capacity blocker targets the
 * first item in queue order it is attributed to, which excludes held
 * vehicles the same way the tiles do. [D §5]
 */
export function blockerChips(args: {
  blockers: Blocker[]
  items: OpenItem[]
  decisions: Record<ItemId, DraftDecision>
  fixture: Fixture
}): BlockerChip[] {
  const { blockers, fixture } = args
  const ordered = orderQueue(args)
  return blockers.map((b) => {
    if (b.kind === 'capacity-shortfall') {
      const target =
        ordered.find((item) => blockersForItem(blockers, item, fixture).includes(b)) ?? null
      return {
        key: `capacity-${b.date}-${b.vehicleClass}`,
        label: `${formatDay(b.date)} · ${b.vehicleClass} short ${b.shortBy}`,
        targetItemId: target === null ? null : target.id,
      }
    }
    const vehicleId = fixture.items.find((i) => i.id === b.itemId)?.vehicleId ?? b.itemId
    const reason =
      b.kind === 'undisposed-item'
        ? 'no decision'
        : b.kind === 'parts-not-ready'
          ? 'parts not ready'
          : 'slot not bookable'
    return { key: `${b.kind}-${b.itemId}`, label: `${vehicleId} · ${reason}`, targetItemId: b.itemId }
  })
}
```

- [ ] **Step 4: Run the new tests to verify they pass**

Run: `npx vitest run src/ui/grouping.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Run the full suite and the build**

Run: `npm test && npm run build`
Expected: all tests pass (183 existing + 8 new), tsc emits no errors.

- [ ] **Step 6: Commit**

```bash
git add src/ui/grouping.ts src/ui/grouping.test.ts
git commit -m "feat: derive queue groups and blocker chips from existing state"
```

---

### Task 2: Slim two-row tiles in a grouped queue

**Files:**
- Modify: `src/ui/ItemCard.tsx` (full rewrite below)
- Modify: `src/ui/DecisionQueue.tsx` (full rewrite below)
- Modify: `src/ui/theme.css` (`.card*` block, new `.group*` block, `.badge` block, `.panetitle` removal)

**Interfaces:**
- Consumes: `groupQueue`, `QueueGroupKind` from Task 1.
- Produces: `ItemCard` props change to `{ item, vehicle, decision, blockers, resurfaced: boolean, groupKind: QueueGroupKind, selected, onSelect }` — `resurfacedBecause` and `priorDecision` props are gone (their prose moves to `ItemDetail` in Task 5; the Resurfaced badge stays [D §3]).

- [ ] **Step 1: Rewrite `src/ui/ItemCard.tsx`**

```tsx
import { formatDay } from '../domain/clock'
import { urgencyLabel } from '../domain/urgency'
import type { Blocker, DraftDecision, OpenItem, Vehicle } from '../domain/types'
import type { QueueGroupKind } from './grouping'

export function ItemCard({
  item,
  vehicle,
  decision,
  blockers,
  resurfaced,
  groupKind,
  selected,
  onSelect,
}: {
  item: OpenItem
  vehicle: Vehicle
  decision: DraftDecision | undefined
  blockers: Blocker[]
  resurfaced: boolean
  groupKind: QueueGroupKind
  selected: boolean
  onSelect: () => void
}) {
  const state = dispositionLabel(decision, blockers)

  return (
    <button className={`card ${groupKind}${selected ? ' sel' : ''}`} onClick={onSelect}>
      <div className="r1">
        <span className="vid">{item.vehicleId}</span>
        {item.safetyClass && <span className="badge safety">Safety · hard stop</span>}
        {vehicle.hold !== null && <span className="badge">Held since {formatDay(vehicle.hold.since)}</span>}
        {vehicle.vehicleClass === 'specialist' && <span className="badge specialist">Specialist</span>}
        {resurfaced && <span className="badge resurfaced">Resurfaced</span>}
        <span className="spacer" />
        <span className={`status ${state.tone}`}>{state.text}</span>
      </div>
      <div className="r2">
        <span className="title">{item.title}</span>
        <span className="spacer" />
        <span className={`urg ${item.urgency.kind}`}>{urgencyLabel(item.urgency.kind)}</span>
      </div>
    </button>
  )
}

/** Status copy per [D §3]. The weekday is the first token of formatDay. */
function dispositionLabel(
  decision: DraftDecision | undefined,
  blockers: Blocker[],
): { text: string; tone: string } {
  const short = blockers.find(
    (b): b is Extract<Blocker, { kind: 'capacity-shortfall' }> => b.kind === 'capacity-shortfall',
  )
  if (short) {
    return { text: `Causes ${formatDay(short.date).split(' ')[0]} shortfall`, tone: 'crit' }
  }
  if (blockers.some((b) => b.kind === 'infeasible-slot' || b.kind === 'parts-not-ready')) {
    return { text: 'Slot not bookable', tone: 'crit' }
  }
  if (!decision || decision.treatment === null) return { text: 'No decision', tone: 'crit' }
  if (decision.treatment === 'watch') {
    return decision.deferral === null
      ? { text: 'Watch, incomplete', tone: 'crit' }
      : { text: `Watch until ${formatDay(decision.deferral.reviewDate)}`, tone: '' }
  }
  if (decision.slotDate === null) return { text: 'No slot chosen', tone: 'crit' }
  return { text: `${formatDay(decision.slotDate)} booked`, tone: 'ok' }
}
```

Changes of record: the corner `state` becomes the right-aligned `status` (loudest text on the tile); the `why` line (urgency chip + because sentence) and the `prior` line are gone; the urgency chip moves to row 2 right; `Decision needed` becomes `No decision`; the shortfall status names its weekday and its tone changes from `warn` to `crit`; booked gains tone `ok`.

- [ ] **Step 2: Rewrite `src/ui/DecisionQueue.tsx`**

```tsx
import { blockersForItem } from '../domain/validation'
import type { Blocker, DraftDecision, ItemId } from '../domain/types'
import { usePlan } from '../state/PlanProvider'
import { activeWeekId, queueFor } from '../state/planReducer'
import { groupQueue } from './grouping'
import { ItemCard } from './ItemCard'

export function DecisionQueue({
  decisions,
  blockers,
  selectedItemId,
  onSelect,
}: {
  decisions: Record<ItemId, DraftDecision>
  blockers: Blocker[]
  selectedItemId: ItemId | null
  onSelect: (id: ItemId) => void
}) {
  const { state, fixture } = usePlan()
  const weekId = activeWeekId(state)
  const entries = queueFor({ fixture, state, weekId })
  const groups = groupQueue({ items: entries.map((e) => e.item), decisions, blockers, fixture })

  return (
    <div className="pane left">
      {groups.length === 0 && (
        <p className="empty">
          Nothing needs a decision this week. Deferred items return on their review date or when their
          trigger fires.
        </p>
      )}
      {groups.map((group) => (
        <div className="group" key={group.kind}>
          <p className={`grouptitle${group.kind === 'blocking' ? ' crit' : ''}`}>
            {group.label} <span className="cnt">· {group.items.length}</span>
          </p>
          {group.items.map((item) => {
            const entry = entries.find((e) => e.item.id === item.id)!
            const vehicle = fixture.vehicles.find((v) => v.id === item.vehicleId)!
            return (
              <ItemCard
                key={item.id}
                item={item}
                vehicle={vehicle}
                decision={decisions[item.id]}
                blockers={blockersForItem(blockers, item, fixture)}
                resurfaced={entry.resurfacedBecause !== null}
                groupKind={group.kind}
                selected={selectedItemId === item.id}
                onSelect={() => onSelect(item.id)}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
```

The pane title `Decisions needing attention · 5` is replaced by the group headers, which carry the counts [D §4].

- [ ] **Step 3: Restyle the tile and group CSS in `src/ui/theme.css`**

Replace the whole `.card` block (from `.card {` through the `.card .prior` rule inclusive) with:

```css
.group { margin-bottom: 16px; }
.grouptitle {
  display: flex; align-items: baseline; gap: 7px;
  font-size: 10.5px; font-weight: 700; letter-spacing: 0.07em;
  text-transform: uppercase; color: var(--faint); margin: 0 0 8px;
}
.grouptitle.crit { color: var(--crit); }
.grouptitle .cnt { font-weight: 600; color: var(--faint); }

.card {
  display: block; width: 100%; text-align: left;
  background: var(--surface); border: 1px solid var(--border);
  border-left: 3px solid var(--border-strong);
  border-radius: var(--r); padding: 8px 11px; margin-bottom: 6px;
}
.card.blocking { border-left-color: var(--crit); }
.card.settled { border-left-color: #bfd8c9; }
.card.settled .title { color: var(--muted); }
.card.settled .urg, .card.settled .badge { opacity: 0.7; }
.card:hover { border-color: var(--border-strong); }
.card.sel {
  border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft);
  border-left-color: var(--accent);
}
.card .r1 { display: flex; align-items: center; gap: 7px; margin-bottom: 2px; }
.card .r2 { display: flex; align-items: center; gap: 7px; }
.card .spacer { flex: 1; }
.card .title { font-size: 12.5px; }
.card .status { font-size: 11.5px; font-weight: 600; color: var(--muted); white-space: nowrap; }
.card .status.crit { color: var(--crit); }
.card .status.ok { color: var(--ok); }
```

Then replace the `.badge` block (`.badge {` through `.badge.resurfaced`) with:

```css
.badge {
  font-size: 9px; font-weight: 700; letter-spacing: 0.05em;
  text-transform: uppercase; padding: 1px 5px; border-radius: 3px;
  color: var(--muted); background: #f0f2f4;
}
.badge.safety { background: var(--crit-soft); color: var(--crit); }
.badge.specialist { background: var(--spec-soft); color: var(--spec); }
.badge.resurfaced { background: var(--accent-soft); color: var(--accent); }
```

(`.badge.held` is gone; the Held badge uses the default. Safety keeps red: it is the hard stop [D §3].)

Finally delete the `.pane .panetitle` rule (nothing renders it after Step 2).

- [ ] **Step 4: Verify**

Run: `npm test && npm run build`
Expected: all tests pass, build clean.

Then verify live: with the dev server running (`npm run dev`, background), open the app in a browser, dismiss the cover note if present, and check against the mockup:

- Two groups render: `BLOCKING THE WEEK · 3` (red, items V-041, V-103, V-118 with red left edges) and `SETTLED · 2` (muted, V-012 and V-027 dimmed with green edges).
- Each tile is two rows; the status is right-aligned on row 1 (`No decision`, `Causes Tue shortfall` twice, `Tue 29 Sep booked` in green, `Watch until Mon 2 Nov` muted); the urgency chip is right-aligned on row 2; no evidence sentence renders on any tile.
- Selecting a tile still shows the blue ring and drives the detail pane.

- [ ] **Step 5: Commit**

```bash
git add src/ui/ItemCard.tsx src/ui/DecisionQueue.tsx src/ui/theme.css
git commit -m "feat: slim two-row tiles in a grouped queue"
```

---

### Task 3: Blocker chips beside Commit

**Files:**
- Modify: `src/ui/PlanHeader.tsx` (full rewrite below)
- Modify: `src/App.tsx` (PlanHeader call site)
- Modify: `src/ui/theme.css` (`.planheader` block)

**Interfaces:**
- Consumes: `blockerChips` from Task 1.
- Produces: `PlanHeader` props become `{ blockers, decisions, onCommit, onSelectItem }`.

- [ ] **Step 1: Rewrite `src/ui/PlanHeader.tsx`**

```tsx
import { formatDay, isoWeekNumber } from '../domain/clock'
import { weekFixtureFor } from '../domain/capacity'
import { canCommit } from '../domain/validation'
import type { Blocker, DraftDecision, ItemId } from '../domain/types'
import { usePlan } from '../state/PlanProvider'
import { activeWeekId, queueFor } from '../state/planReducer'
import { blockerChips } from './grouping'

export function PlanHeader({
  blockers,
  decisions,
  onCommit,
  onSelectItem,
}: {
  blockers: Blocker[]
  decisions: Record<ItemId, DraftDecision>
  onCommit: () => void
  onSelectItem: (id: ItemId) => void
}) {
  const { state, fixture } = usePlan()
  const weekId = activeWeekId(state)
  const week = weekFixtureFor(fixture, weekId)
  const committed = state.committedByWeek[weekId] ?? null
  const ready = canCommit(blockers)
  const chips = blockerChips({
    blockers,
    items: queueFor({ fixture, state, weekId }).map((e) => e.item),
    decisions,
    fixture,
  })

  return (
    <header className="planheader">
      <h1>Weekly maintenance plan</h1>
      <span className="week">
        Week {isoWeekNumber(weekId)} · {formatDay(week.days[0])} to {formatDay(week.days[4])} 2026 ·{' '}
        {fixture.depot} · {fixture.vehicles.length} vans
      </span>
      <span className="spacer" />
      {!ready && (
        <div className="blockerchips">
          {chips.map((chip) => (
            <button
              key={chip.key}
              className="bchip"
              disabled={chip.targetItemId === null}
              onClick={() => chip.targetItemId !== null && onSelectItem(chip.targetItemId)}
            >
              <span className="dot" />
              {chip.label}
            </button>
          ))}
        </div>
      )}
      <div>
        <button className="commit" onClick={onCommit} disabled={!ready}>
          {committed === null ? 'Commit plan' : 'Recommit plan'}
        </button>
        {ready && committed !== null && (
          <div className="committed">Committed {formatDay(committed.committedOn)}. Simulated, nothing was sent.</div>
        )}
      </div>
    </header>
  )
}
```

`describeBlocker` is no longer imported here; the chips carry the blocker copy, and the flagline still carries the long capacity sentence. The committed note is unchanged [D §5].

- [ ] **Step 2: Update the call site in `src/App.tsx`**

Replace the `<PlanHeader ... />` element with:

```tsx
      <PlanHeader
        blockers={blockers}
        decisions={decisions}
        onCommit={() => {
          dispatch({ type: 'commit', weekId })
          setView('summary')
        }}
        onSelectItem={setSelectedItemId}
      />
```

- [ ] **Step 3: Restyle the header in `src/ui/theme.css`**

Replace the whole `.planheader` block (from `.planheader {` through `.planheader .committed`) with:

```css
.planheader {
  display: flex; align-items: center; gap: 16px;
  padding: 13px 18px; background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.planheader h1 { margin: 0; font-size: 16px; font-weight: 650; letter-spacing: -0.01em; }
.planheader .week { color: var(--muted); font-size: 12.5px; }
.planheader .spacer { flex: 1; }
.planheader .blockerchips { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.planheader .bchip {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11.5px; font-weight: 600; color: var(--crit);
  background: var(--crit-soft); border: 1px solid #e8bdb9;
  padding: 4px 10px; border-radius: 99px;
}
.planheader .bchip .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--crit); }
.planheader .commit {
  font-weight: 600; font-size: 13px; padding: 7px 15px; border-radius: var(--r);
  border: 1px solid var(--accent); background: var(--accent); color: #fff;
}
.planheader .commit:disabled {
  border-color: var(--border-strong); background: #f1f2f4; color: var(--faint);
}
.planheader .committed { font-size: 11.5px; color: var(--ok); margin-top: 4px; text-align: right; }
```

(The `.planheader .blocked` rule is deleted with the prose it styled.)

- [ ] **Step 4: Verify**

Run: `npm test && npm run build`
Expected: pass.

Live checks:

- Two chips render between the week metadata and Commit: `V-041 · no decision` and `Tue 29 Sep · standard short 1`.
- Clicking the first selects V-041 in the queue and its detail opens; clicking the second selects V-103.
- Book V-041's slot on a day and defer nothing: chips update as blockers change. Clear both blockers (defer V-041 with a full record, move V-118 to Thu): chips disappear, Commit enables.
- Commit: header shows the committed note, no chips. Then use the demo bar Reset.

- [ ] **Step 5: Commit**

```bash
git add src/ui/PlanHeader.tsx src/App.tsx src/ui/theme.css
git commit -m "feat: blocker chips beside Commit that select the offending item"
```

---

### Task 4: Exception-first band, dark Deadline chip, quieter demo bar

**Files:**
- Modify: `src/ui/CapacityBand.tsx` (day/Cell rendering only)
- Modify: `src/ui/theme.css` (`.band` block, `.urg.deadline`, `.demobar`)

**Interfaces:**
- Consumes: nothing new.
- Produces: no API changes; CSS classes `day exc` and `c .n` appear in the band markup.

- [ ] **Step 1: Mark exception days and wrap cell numbers in `src/ui/CapacityBand.tsx`**

In the `week.days.map` callback, extend the computed flags and the class string:

```tsx
        {week.days.map((date) => {
          const std = cellFor(date, 'standard')
          const spec = cellFor(date, 'specialist')
          const impacted = std.shortfall > 0 || spec.shortfall > 0
          const candidate = !impacted && (std.available > std.demand || spec.available > spec.demand)
          const exception = impacted || candidate
          return (
            <div
              key={date}
              className={`day${exception ? ' exc' : ''}${impacted ? ' impacted' : ''}${candidate ? ' candidate' : ''}`}
            >
              <div className="dh">{formatDay(date)}</div>
              <Cell capacity={std} />
              <Cell capacity={spec} />
            </div>
          )
        })}
```

And replace the `Cell` component with:

```tsx
function Cell({ capacity }: { capacity: DayCapacity }) {
  const short = capacity.shortfall > 0
  const spare = capacity.available > capacity.demand
  return (
    <div className={`c${short ? ' short' : spare ? ' spare' : ''}`}>
      <span className="n">
        {capacity.available} / {capacity.demand}
      </span>
      {short && <span className="sub">short {capacity.shortfall}</span>}
      {spare && <span className="sub">+{capacity.available - capacity.demand}</span>}
    </div>
  )
}
```

The impacted/candidate logic, the `Reacting to V-x` chip, the cover summary and the flagline are untouched [D §6].

- [ ] **Step 2: Restyle the band in `src/ui/theme.css`**

Replace the rules `.band .day`, `.band .day.impacted`, `.band .day.candidate`, `.band .day .dh`, `.band .c`, `.band .c + .c`, `.band .c .sub`, `.band .c.short`, `.band .c.spare` with:

```css
.band .day { border: 1px solid transparent; border-radius: var(--r); overflow: hidden; }
.band .day.exc { border-color: var(--border); background: #fbfcfd; }
.band .day.impacted { border-color: var(--crit); box-shadow: 0 0 0 2px var(--crit-soft); }
.band .day.candidate { border-color: var(--ok); box-shadow: 0 0 0 2px var(--ok-soft); }
.band .day .dh {
  font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
  color: var(--faint); text-align: center; padding: 3px 0 2px;
}
.band .c {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 4px; font-size: 12px; font-variant-numeric: tabular-nums;
}
.band .c .n { color: var(--faint); font-weight: 500; }
.band .c .sub { font-size: 10px; font-weight: 700; }
.band .c.short { background: var(--crit-soft); }
.band .c.short .n, .band .c.short .sub { color: var(--crit); }
.band .c.short .n { font-weight: 700; }
.band .c.spare { background: var(--ok-soft); }
.band .c.spare .n, .band .c.spare .sub { color: var(--ok); }
.band .c.spare .n { font-weight: 700; }
```

A quiet day that becomes impacted or candidate gets its outline without acquiring a fill [D §6]: the outline rules set only border and shadow, and quiet cells stay unfilled.

- [ ] **Step 3: Darken the Deadline chip and soften the cover line in `src/ui/theme.css`**

Replace the `.urg.deadline` rule with:

```css
.urg.deadline { color: #fff; border-color: #2b3138; background: #2b3138; }
```

Replace the `.band .cover` rule (keep `.band .cover b` and `.band .cover .none` as they are) with:

```css
.band .cover { font-size: 11px; color: var(--faint); }
```

- [ ] **Step 4: Quieten the demo bar one notch in `src/ui/theme.css`**

In the `.demobar` rule, change exactly these declarations: `padding: 7px 18px` to `padding: 5px 18px`, `background: #fff8e6` to `background: #fffbef`, `border-bottom: 1px solid #f0dfb4` to `border-bottom: 1px solid #f0e4c0`, and `font-size: 12px` to `font-size: 11.5px`. Content and controls are unchanged [D §2].

- [ ] **Step 5: Verify**

Run: `npm test && npm run build`
Expected: pass.

Live checks:

- Mon, Wed, Fri render as faint boxless number pairs; Tue is boxed with the red fill, bold `37 / 38` and `short 1`, plus the red impacted outline; Thu is boxed green with `+1` and the candidate outline.
- The Deadline chip on V-012 (queue and detail head) is dark with white text, not red.
- Selecting V-118 and switching its slot to Wednesday moves the shortage: Wednesday becomes the boxed red day. Switch it back.
- The demo bar is visibly lower-contrast but reads the same.

- [ ] **Step 6: Commit**

```bash
git add src/ui/CapacityBand.tsx src/ui/theme.css
git commit -m "feat: exception-first capacity band and one meaning for red"
```

---

### Task 5: Detail pane absorbs the dropped prose, README pointer, final verification

**Files:**
- Modify: `src/ui/ItemDetail.tsx` (head additions)
- Modify: `src/ui/theme.css` (`.detail` additions)
- Modify: `README.md` (mockups line)

**Interfaces:**
- Consumes: `queueFor`, `activeWeekId` from `src/state/planReducer.ts`; `formatDay` from `src/domain/clock.ts`.
- Produces: nothing consumed later.

- [ ] **Step 1: Add the because line and previous-decision line to `src/ui/ItemDetail.tsx`**

Add to the imports:

```tsx
import { formatDay } from '../domain/clock'
import { activeWeekId, queueFor } from '../state/planReducer'
```

Change the existing `const { fixture } = usePlan()` line to:

```tsx
  const { state, fixture } = usePlan()
```

Then, after the `vehicle` lookup line, resolve the queue entry:

```tsx
  const entry = queueFor({ fixture, state, weekId: activeWeekId(state) }).find(
    (e) => e.item.id === item.id,
  )
```

Then, directly after the `<div className="sub">…</div>` element, add:

```tsx
      <div className="because">{item.urgency.because}</div>
      {entry !== undefined && entry.priorDecision !== null && (
        <div className="because">
          Previously: watch, decided {formatDay(entry.priorDecision.decidedOn)}.{' '}
          {entry.priorDecision.deferral.reason}
        </div>
      )}
```

- [ ] **Step 2: Style the lines in `src/ui/theme.css`**

Change `.detail .sub`'s `margin-bottom` from `11px` to `2px`, and add after it:

```css
.detail .because { font-size: 12px; color: var(--muted); margin: 0 0 11px; }
.detail .because + .because { margin-top: -7px; }
```

- [ ] **Step 3: Update the mockups line in `README.md`**

Replace:

```markdown
- `docs/mockups/`: the two layouts the layout decision was made from
```

with:

```markdown
- `docs/mockups/`: the two layouts the layout decision was made from, and the guided-queue
  declutter proposal the current surface follows
```

- [ ] **Step 4: Full verification pass [D §9]**

Run: `npm test && npm run build`
Expected: 183 + 8 tests pass, build clean.

Live, from a reset scenario (demo bar → Reset scenario, reopen the plan):

1. **Walkthrough step 1:** week 40 opens with the two groups and two blocker chips; V-012 already reads held and booked.
2. **Walkthrough step 2:** open V-118, switch Tuesday → Thursday: Tue clears in the band, V-118's status flips to `Thu 1 Oct booked` and its tile moves to Settled. Try Wednesday: the shortage lands on Wed instead. End on Thursday.
3. **Walkthrough steps 3 and 4:** open V-041, schedule it: the specialist row breaks. Defer it with reason, review date and trigger: the chip disappears, V-041 settles.
4. **Walkthrough step 5:** V-012's bundle and watch are disabled with the UVV reason shown, unchanged.
5. **Walkthrough step 6:** Commit works; the summary is unchanged by this project.
6. **Walkthrough step 7:** advance the clock to the next review date; V-041 returns with the Resurfaced badge on its tile, and its detail head shows both the because line and `Previously: watch, decided …` with the recorded reason. Reset afterwards.
7. **Red audit at week-40 open:** red appears only in the two chips, the Blocking group (header, three edges, three statuses), the Tue cell and flagline, `no specialist cover`, and the safety badge. The Deadline chip is dark. Quiet band cells have no boxes.
8. **Detail regression:** each of the five items shows its because sentence in the detail head.

- [ ] **Step 5: Commit**

```bash
git add src/ui/ItemDetail.tsx src/ui/theme.css README.md
git commit -m "feat: detail pane absorbs evidence prose; README points at the proposal"
```

---

## Coverage map (spec section → task)

- [D §3] tile anatomy, status copy → Task 2
- [D §4] grouping, group headers, pure function + test → Tasks 1, 2
- [D §5] blocker chips, click behavior, committed state → Tasks 1, 3
- [D §6] red rule, dark Deadline, exception-first band, cover line → Task 4
- [D §7] because line, previous-decision line → Task 5
- [D §8] file boundary, README pointer → Tasks 1–5
- [D §9] verification → every task's verify step, full pass in Task 5
- [D §10] out of scope → nothing here touches commit summary, cover note, demo-bar content, or component-test infrastructure
