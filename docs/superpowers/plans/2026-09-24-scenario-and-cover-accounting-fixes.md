# Scenario and Cover Accounting Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open the week with an undecided backlog and a one-click `Use proposal`, make a replacement booking belong to an applied visit and requestable only from the weekly plan, charge cover only where it was requested, show a committed replacement as a per-van dashboard fact, and render capacity cells as `own + rental / demand`.

**Architecture:** The proposal stays on the item and is adopted only through one pure function, `adoptProposal`, shared by the UI button and the tests. A booking is pruned by the reducer whenever its vehicle stops having a visit and is filtered structurally by every reader through `bookingsForVisits`, so no surface can count cover for a van that is not in the workshop. The hand-authored item-level cover cost is deleted; the Consequence tile and the weekly total read requested bookings only. The dashboard derives replacement facts from the committed plan, the same source as `In workshop` and `Booked`. One formatter, `capacityFigure`, renders every capacity number on three surfaces.

**Tech Stack:** React 19, TypeScript (strict), Vitest, no new dependencies. macOS `sed -i ''` syntax where a mechanical rename is used.

## Global Constraints

- Validation is unchanged: an undecided item, a capacity shortfall, an infeasible slot and unready parts all still block Commit, and `canCommit` stays `blockers.length === 0` (spec §2, §4).
- The pre-confirmed rentals R-1 and R-2 never enter the weekly cost total; only requested bookings do (spec §5.6).
- The dashboard's per-van facts come from the committed plan only; draft requests never produce a fact. Coverage lines keep reading the draft (spec §6).
- A booking belongs to a visit: the reducer prunes bookings to visiting vehicles on every `set-decision`, ignores `set-booking` for a vehicle without a visit, and every reader passes bookings through `bookingsForVisits` first (spec §5.3, §5.4).
- A visit is a decision whose treatment is `act-now` or `bundle` and whose slot is set. Nothing else counts as a visit anywhere (spec §3.3).
- `capacityFigure` renders `own + cover / demand` when cover exists and `own / demand` otherwise; `available` against `demand` still decides short, spare, impacted and candidate states (spec §7).
- The persisted state version moves from 1 to 2 so a browser holding the old seeded drafts resets to the seed with the demo bar's older-build notice (spec §3.5).
- Copy follows the codebase: the middle dot `·` separates facts, dates use `formatDay`, prices read `EUR n`. No em dashes anywhere, in code, copy or docs.
- `npm test`, `npx tsc --noEmit` and `npm run build` must all be clean at the end of every task.

**Reference:** `docs/superpowers/specs/2026-09-24-scenario-and-cover-accounting-fixes-design.md`, cited below as `[spec §n]`. The parallel Codex attempt's diff is at `.superpowers/sdd/codex-fleet-scenario-fixes-2026-09-24.patch` (gitignored, local only). Consult it for mechanics where a task below says so; never apply it wholesale (spec §13).

**Before Task 1:** create the isolated worktree with `superpowers:using-git-worktrees`, branched from `main` at `ba6ef6d` or later, named `scenario-cover-fixes`. Every command below runs from that worktree's root. `npm install` there first if `node_modules` is absent.

---

## File Structure

New files:
- `src/domain/visits.test.ts`: the structural definition of a visit (Task 3).

Modified files, grouped by responsibility:
- Proposal adoption and open seeding: `src/domain/recommendation.ts`, `src/domain/testSupport.ts`, `src/state/planReducer.ts`, and every test that relied on the seeded scenario (Task 1).
- Persisted version: `src/state/planReducer.ts`, `src/state/persistence.ts`, `src/domain/persistence.test.ts` (Task 2).
- Visit definition: `src/domain/visits.ts` (Task 3).
- Visit-bound bookings: `src/domain/replacementBooking.ts`, `src/state/planReducer.ts` (Task 4); `src/domain/validation.ts`, `src/domain/fleetStatus.ts`, `src/domain/commit.ts`, `src/ui/CapacityBand.tsx` (Task 6).
- Cover cost model: `src/domain/types.ts`, `src/domain/fixture.ts`, `src/domain/consequence.ts`, `src/domain/recommendation.ts`, `src/domain/costs.ts` (Task 5).
- Dashboard replacement facts: `src/domain/fleetStatus.ts` (Task 7).
- Capacity figure: `src/domain/types.ts`, `src/domain/capacity.ts`, `src/ui/CapacityBand.tsx`, `src/ui/CommitSummary.tsx`, `src/ui/DailyConfirmation.tsx` (Task 8).
- Queue grouping and chips: `src/ui/grouping.ts`, `src/ui/ItemCard.tsx`, `src/ui/PlanHeader.tsx`, `src/ui/DecisionQueue.tsx`, `src/ui/theme.css` (Task 9).
- Detail pane and dashboard surfaces: `src/ui/TreatmentForm.tsx`, `src/ui/AssumptionBlock.tsx`, `src/ui/ItemDetail.tsx`, `src/ui/ReplacementBookingControl.tsx`, `src/ui/InspectPopover.tsx`, `src/ui/FleetView.tsx`, `src/ui/theme.css` (Task 10).
- Documentation: `README.md`, `src/ui/coverNoteContent.ts`, `docs/acceptance.md`, and the five specs named in spec §12 (Task 11).

---

### Task 1: `adoptProposal`, `proposedDecisions()`, and the backlog opens undecided

**Files:**
- Modify: `src/domain/recommendation.ts`
- Modify: `src/domain/testSupport.ts`
- Modify: `src/state/planReducer.ts:73-95` (`draftFor`)
- Test: `src/domain/recommendation.test.ts`, `src/domain/planReducer.test.ts`, `src/domain/fleetStatus.test.ts`, `src/domain/scenarios.test.ts`, `src/ui/grouping.test.ts`, `src/domain/validation.test.ts`, `src/domain/capacity.test.ts`, `src/domain/costs.test.ts`, `src/domain/commit.test.ts`, `src/domain/feasibility.test.ts`

**Interfaces:**
- Produces: `adoptProposal(item: OpenItem): DraftDecision` in `src/domain/recommendation.ts`. `proposedDecisions(fx?: Fixture): Record<ItemId, DraftDecision>` and `adoptedState(fx?: Fixture): AppState` in `src/domain/testSupport.ts`. `coldOpenDecisions` no longer exists.
- Consumes: nothing new.

- [ ] **Step 1: Write the failing tests for `adoptProposal`**

Append to `src/domain/recommendation.test.ts`, and change its imports as shown:

```ts
// replace the two import lines
//   import { recommendationFor, watchAvailable } from './recommendation'
//   import { coldOpenDecisions, item, vehicle } from './testSupport'
// with
import { adoptProposal, recommendationFor, watchAvailable } from './recommendation'
import { proposedDecisions, item, vehicle } from './testSupport'
```

```ts
describe('adoptProposal', () => {
  it('turns a visit proposal into a staged decision with its slot', () => {
    expect(adoptProposal(item('item-v118'))).toEqual({
      itemId: 'item-v118',
      treatment: 'act-now',
      slotDate: '2026-09-29',
      deferral: null,
    })
  })

  it('carries the deferral for a watch proposal, and no slot', () => {
    const d = adoptProposal(item('item-v027'))
    expect(d.treatment).toBe('watch')
    expect(d.slotDate).toBeNull()
    expect(d.deferral!.reviewDate).toBe('2026-11-02')
    expect(d.deferral!.trigger.label).toBe('Driver reports the wipe quality degrading')
  })

  it('leaves the slot open where the proposal names none', () => {
    expect(adoptProposal(item('item-v041'))).toEqual({
      itemId: 'item-v041',
      treatment: 'act-now',
      slotDate: null,
      deferral: null,
    })
  })
})
```

In the same file, the two `orderQueue` calls in `describe('queue ordering')` read `decisions: coldOpenDecisions()`; change both to `decisions: proposedDecisions()`.

- [ ] **Step 2: Run the file to verify it fails**

Run: `npx vitest run src/domain/recommendation.test.ts`
Expected: FAIL, the import of `adoptProposal` and `proposedDecisions` cannot be resolved.

- [ ] **Step 3: Implement `adoptProposal`**

In `src/domain/recommendation.ts`, change the type import and add the function after `proposedAction`:

```ts
import type { DraftDecision, ISODate, OpenItem, Urgency, Vehicle } from './types'
```

```ts
/**
 * The proposal is the system's; adopting it is the user's act. This is the
 * one definition of "adopt", used by the Use proposal button and by the
 * tests, so the two can never drift. A deferral belongs only to a watch and
 * a slot only to a visit. [scenario spec §3.2]
 */
export function adoptProposal(item: OpenItem): DraftDecision {
  const { treatment, slotDate, deferral } = item.proposal
  return {
    itemId: item.id,
    treatment,
    slotDate: treatment === 'watch' ? null : slotDate,
    deferral: treatment === 'watch' ? deferral : null,
  }
}
```

- [ ] **Step 4: Replace `coldOpenDecisions` with `proposedDecisions` and add `adoptedState` in test support**

Replace the whole of `src/domain/testSupport.ts` with:

```ts
import { fixture } from './fixture'
import { adoptProposal } from './recommendation'
import { initialState, planReducer, type AppState } from '../state/planReducer'
import type { DraftDecision, Fixture, ItemId, OpenItem, Vehicle } from './types'

const WEEK_40 = '2026-09-28'

export const item = (id: string): OpenItem => {
  const found = fixture.items.find((i) => i.id === id)
  if (!found) throw new Error(`No fixture item ${id}`)
  return found
}

export const vehicle = (id: string): Vehicle => {
  const found = fixture.vehicles.find((v) => v.id === id)
  if (!found) throw new Error(`No fixture vehicle ${id}`)
  return found
}

/**
 * Every week-40 proposal adopted, exactly as the Use proposal button does it:
 * three Tuesday visits, V-027 watched, V-041 proposed with no slot. This is
 * the scripted scenario. It is no longer the cold open, which is undecided.
 */
export function proposedDecisions(fx: Fixture = fixture): Record<ItemId, DraftDecision> {
  const out: Record<ItemId, DraftDecision> = {}
  const week40ItemIds = fx.weeks[0].itemIds
  for (const i of fx.items) {
    if (week40ItemIds.includes(i.id)) out[i.id] = adoptProposal(i)
  }
  return out
}

/** The seed with every week-40 proposal applied through the reducer. */
export function adoptedState(fx: Fixture = fixture): AppState {
  let s = initialState(fx)
  for (const decision of Object.values(proposedDecisions(fx))) {
    s = planReducer(s, { type: 'set-decision', weekId: WEEK_40, decision }, fx)
  }
  return s
}
```

Then the mechanical rename in the tests whose meaning does not change (they describe the adopted scenario, which `proposedDecisions` still is):

```bash
sed -i '' 's/coldOpenDecisions/proposedDecisions/g' \
  src/domain/capacity.test.ts src/domain/costs.test.ts src/domain/commit.test.ts \
  src/domain/feasibility.test.ts
sed -i '' 's/coldOpenDecisions as coldOpen/proposedDecisions as proposed/; s/coldOpen()/proposed()/g' \
  src/domain/validation.test.ts
grep -rn coldOpenDecisions src || echo "no references left"
```

Expected: `no references left`.

- [ ] **Step 5: Run the suite; it still passes, because seeding has not changed yet**

Run: `npx vitest run`
Expected: all tests pass (259 plus the 3 new ones).

- [ ] **Step 6: Write the failing test for open seeding**

In `src/domain/planReducer.test.ts`, replace the test `'seeds the draft from the system proposals, undisposed items included'` inside `describe('initial state')` with:

```ts
  it('seeds every item open, with the proposal left on the item', () => {
    const draft = draftFor({ fixture, state: s, weekId: '2026-09-28' })
    expect(Object.keys(draft).sort()).toEqual(['item-v012', 'item-v027', 'item-v041', 'item-v103', 'item-v118'])
    for (const d of Object.values(draft)) {
      expect(d).toEqual({ itemId: d.itemId, treatment: null, slotDate: null, deferral: null })
    }
    expect(fixture.items.find((i) => i.id === 'item-v118')!.proposal.slotDate).toBe('2026-09-29')
  })
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx vitest run src/domain/planReducer.test.ts -t "seeds every item open"`
Expected: FAIL, `item-v118` has `treatment: 'act-now'` and `slotDate: '2026-09-29'`.

- [ ] **Step 8: Seed every entry open in `draftFor`**

In `src/state/planReducer.ts`, replace the body of the `for` loop in `draftFor`:

```ts
  for (const entry of queueFor({ fixture, state, weekId })) {
    // Every entry opens undecided, authored or resurfaced alike. The
    // proposal stays on the item and is adopted only by the user's own
    // action (adoptProposal); a resurfaced item's earlier rationale stays
    // visible through priorDecision. [scenario spec §3.1, WP E6.4]
    seeded[entry.item.id] = { itemId: entry.item.id, treatment: null, slotDate: null, deferral: null }
  }
```

- [ ] **Step 9: Migrate the tests that assumed the seeded scenario**

`src/domain/planReducer.test.ts`: add `import { adoptedState } from './testSupport'` and change the first line of `committedWeek40()` from `let s = initialState(fixture)` to `let s = adoptedState()`.

`src/domain/fleetStatus.test.ts`: add `import { adoptedState } from './testSupport'` and `import type { Fixture, ReplacementBooking } from './types'` (replacing the existing `Fixture`-only type import). In `committedState(fx)`, change `let s = initialState(fx)` to `let s = adoptedState(fx)`. Then, in `describe('fleet overview at cold open')`:

```ts
  it('orders attention exactly like the queue', () => {
    // Every item is undecided, so after the safety-class van the order is
    // urgency (estimates before assessment-needed), then item id.
    expect(o.attention.map((s) => s.vehicleId)).toEqual(['V-012', 'V-027', 'V-103', 'V-118', 'V-041'])
  })
```

and replace `'covers today with R-1 on site, and flags Tuesday standard short by 1'` with:

```ts
  it('covers today and tomorrow, because nothing is planned yet', () => {
    expect(o.today.date).toBe(SEED_DATE)
    expect(o.today.covered).toBe(true)
    expect(o.today.coverOnSite).toEqual(['R-1'])
    expect(o.nextBusinessDay.date).toBe('2026-09-29')
    expect(o.nextBusinessDay.covered).toBe(true)
    expect(o.nextBusinessDay.shortfalls).toEqual([])
    expect(o.nextBusinessDay.coverOnSite).toEqual(['R-1', 'R-2'])
  })
```

Add a new describe directly after that block:

```ts
describe('fleet overview once every proposal is adopted', () => {
  const o = overviewFor(adoptedState())

  it('flags Tuesday standard short by 1, the scripted conflict', () => {
    expect(o.nextBusinessDay.date).toBe('2026-09-29')
    expect(o.nextBusinessDay.covered).toBe(false)
    expect(o.nextBusinessDay.shortfalls.map((s) => [s.vehicleClass, s.shortfall])).toEqual([['standard', 1]])
  })

  it('orders attention like the queue: safety, the undecided specialist, then the contributors', () => {
    expect(o.attention.map((s) => s.vehicleId)).toEqual(['V-012', 'V-041', 'V-103', 'V-118', 'V-027'])
  })
})
```

Replace the body of `describe("a booking is reflected in tomorrow's coverage")` so the booked van is one that visits Tuesday:

```ts
  it('clears the Tuesday shortfall and lists the booking as cover on site', () => {
    const s = adoptedState()
    const weekId = activeWeekId(s)
    const decisions = draftFor({ fixture, state: s, weekId })
    const bookings: Record<string, ReplacementBooking> = {
      'V-118': { vehicleId: 'V-118', startDate: '2026-09-29', days: 1 },
    }
    const o = fleetOverview({
      fixture,
      today: s.demoDate,
      queueItems: queueFor({ fixture, state: s, weekId }).map((e) => e.item),
      decisions,
      blockers: validatePlan({ fixture, weekId, decisions, bookings }),
      committed: s.committedByWeek[weekId] ?? null,
      deferralHistory: s.deferralHistory,
      bookings,
    })
    expect(o.nextBusinessDay.covered).toBe(true)
    expect(o.nextBusinessDay.coverOnSite).toContain('V-118 replacement')
  })
```

`src/domain/scenarios.test.ts`: add `import { adoptedState, item, vehicle } from './testSupport'` (replacing the existing testSupport import). In `resolvedState()`, change `let s = initialState(fixture)` to `let s = adoptedState()`. In scenario 1's second test, change `draftOf(initialState(fixture))` to `draftOf(adoptedState())`. In scenario 2's first test, change `draftOf(initialState(fixture))` to `draftOf(adoptedState())`. In scenario 3, change `const before = validate(draftOf(initialState(fixture)))` to `const before = validate(draftOf(adoptedState()))`.

`src/ui/grouping.test.ts`: add `import { proposedDecisions } from '../domain/testSupport'`, change `const decisions = draftFor({ fixture, state, weekId })` to `const decisions = proposedDecisions()`, drop `draftFor` from the planReducer import, and rename the two describe titles `'groupQueue at week-40 open'` to `'groupQueue with every proposal adopted'` and `'blockerChips at week-40 open'` to `'blockerChips with every proposal adopted'`. Expectations are unchanged: this file now pins the adopted scenario, and Task 9 adds the cold open.

`src/domain/validation.test.ts`: rename `describe('cold open carries exactly two blockers')` to `describe('the adopted proposals carry exactly two blockers')`, add `import { draftFor, initialState } from '../state/planReducer'`, and append:

```ts
describe('the true cold open', () => {
  it('carries one undisposed blocker per item and no shortfall, because nothing is planned', () => {
    const open = draftFor({ fixture, state: initialState(fixture), weekId: WEEK_40 })
    const blockers = validate(open)
    expect(blockers.map((b) => b.kind)).toEqual(Array(5).fill('undisposed-item'))
    expect(canCommit(blockers)).toBe(false)
  })
})
```

`src/domain/capacity.test.ts`: rename `describe('cold open capacity matches the seeded scenario')` to `describe('the adopted proposals reproduce the scripted scenario')`.

- [ ] **Step 10: Run the whole suite and the type check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all tests pass; tsc clean. If `persistence.test.ts` fails, its `committedRealState()` only round-trips state through JSON, so a failure there means a typo in Step 8, not a seeding dependency.

- [ ] **Step 11: Commit**

```bash
git add src/domain/recommendation.ts src/domain/testSupport.ts src/state/planReducer.ts \
  src/domain/recommendation.test.ts src/domain/planReducer.test.ts src/domain/fleetStatus.test.ts \
  src/domain/scenarios.test.ts src/ui/grouping.test.ts src/domain/validation.test.ts \
  src/domain/capacity.test.ts src/domain/costs.test.ts src/domain/commit.test.ts src/domain/feasibility.test.ts
git commit -m "feat: open every queue item undecided, with adoptProposal as the one way to take the system's proposal"
```

---

### Task 2: Persisted state version 2

**Files:**
- Modify: `src/state/planReducer.ts:19-27` (`AppState.version`), `src/state/planReducer.ts:102-112` (`initialState`)
- Modify: `src/state/persistence.ts:16` (`CURRENT_VERSION`)
- Test: `src/domain/persistence.test.ts`

**Interfaces:**
- Produces: `AppState.version` is the literal `2`; `CURRENT_VERSION = 2`.

- [ ] **Step 1: Write the failing tests**

In `src/domain/persistence.test.ts`, change `validEnvelope`'s `version: 1,` to `version: 2,`, and replace the test `'falls back to the seed on a wrong version'` with:

```ts
  it("falls back to the seed, with the older-build notice, on the previous build's version", () => {
    withStoredValue(validEnvelope({ version: 1 }), () => {
      const s = loadState(fixture)
      expectSeedEquivalent(s)
      expect(s.storageNotice).toContain('older build')
    })
  })

  it('falls back to the seed on a future version too', () => {
    withStoredValue(validEnvelope({ version: 3 }), () => {
      const s = loadState(fixture)
      expectSeedEquivalent(s)
      expect(s.storageNotice).not.toBeNull()
    })
  })
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/domain/persistence.test.ts`
Expected: FAIL. A `version: 2` envelope is currently rejected as a wrong version, so every round-trip test that uses `validEnvelope` reports the seed instead of the stored state.

- [ ] **Step 3: Bump the version**

`src/state/planReducer.ts`: in `AppState`, `version: 1` becomes `version: 2`; in `initialState`, `version: 1,` becomes `version: 2,`.

`src/state/persistence.ts`: `const CURRENT_VERSION = 1` becomes:

```ts
// 2 since the backlog opens undecided: a browser holding the old seeded
// drafts must reset to the new seed, and say so. [scenario spec §3.5]
const CURRENT_VERSION = 2
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/state/planReducer.ts src/state/persistence.ts src/domain/persistence.test.ts
git commit -m "feat: bump the persisted state version so old seeded drafts reset to the open backlog"
```

---

### Task 3: A visit needs a visit treatment and a slot

**Files:**
- Modify: `src/domain/visits.ts`
- Create: `src/domain/visits.test.ts`

**Interfaces:**
- Produces: `isVisitDecision(d: DraftDecision): boolean` exported from `src/domain/visits.ts`; `visitsFromDecisions` filters with it.

- [ ] **Step 1: Write the failing tests**

Create `src/domain/visits.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture'
import { isVisitDecision, visitsFromDecisions } from './visits'
import type { DraftDecision } from './types'

const d = (partial: Partial<DraftDecision>): DraftDecision => ({
  itemId: 'item-v118',
  treatment: null,
  slotDate: null,
  deferral: null,
  ...partial,
})

describe('a visit is a visit treatment with a slot, nothing less', () => {
  it('counts act-now and bundle with a slot', () => {
    expect(isVisitDecision(d({ treatment: 'act-now', slotDate: '2026-09-29' }))).toBe(true)
    expect(isVisitDecision(d({ treatment: 'bundle', slotDate: '2026-09-29' }))).toBe(true)
  })

  it('does not count a slot with no treatment, which the open backlog can now produce', () => {
    expect(isVisitDecision(d({ treatment: null, slotDate: '2026-09-29' }))).toBe(false)
    expect(visitsFromDecisions({ 'item-v118': d({ slotDate: '2026-09-29' }) }, fixture.items)).toEqual([])
  })

  it('does not count a watch, or a visit treatment without a slot', () => {
    expect(isVisitDecision(d({ treatment: 'watch', slotDate: '2026-09-29' }))).toBe(false)
    expect(isVisitDecision(d({ treatment: 'act-now', slotDate: null }))).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/domain/visits.test.ts`
Expected: FAIL, `isVisitDecision` is not exported.

- [ ] **Step 3: Implement**

Replace `src/domain/visits.ts` with:

```ts
import { addDays } from './clock'
import type { DraftDecision, ISODate, ItemId, OpenItem, TreatmentKind, Visit } from './types'

const VISIT_TREATMENTS: ReadonlySet<TreatmentKind> = new Set<TreatmentKind>(['act-now', 'bundle'])

/**
 * Structural, not trusting: a visit needs a visit treatment and a slot. With
 * the backlog opening undecided a slot can exist before a treatment does, and
 * that is not a visit anywhere in the plan. [scenario spec §3.3]
 */
export function isVisitDecision(d: DraftDecision): boolean {
  return d.treatment !== null && VISIT_TREATMENTS.has(d.treatment) && d.slotDate !== null
}

export function visitCoversDate(visit: Visit, date: ISODate): boolean {
  return date >= visit.startDate && date < addDays(visit.startDate, visit.days)
}

/**
 * Visits are derived from the decision set and keyed by item, never appended
 * to a list. Re-committing therefore cannot duplicate one. [S 2.2]
 */
export function visitsFromDecisions(
  decisions: Record<ItemId, DraftDecision>,
  items: OpenItem[],
): Visit[] {
  const byId = new Map(items.map((i) => [i.id, i]))
  return Object.values(decisions)
    .filter(isVisitDecision)
    .flatMap((d) => {
      const item = byId.get(d.itemId)
      if (!item) return []
      return [
        {
          itemId: item.id,
          vehicleId: item.vehicleId,
          garageId: item.garageId,
          startDate: d.slotDate as ISODate,
          days: item.visitDays,
          scope: item.title,
        },
      ]
    })
    .sort((a, b) => a.itemId.localeCompare(b.itemId))
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/domain/visits.ts src/domain/visits.test.ts
git commit -m "fix: a visit requires a visit treatment and a slot, structurally"
```

---

### Task 4: `bookingsForVisits`, and the reducer keeps bookings tied to visits

**Files:**
- Modify: `src/domain/replacementBooking.ts`
- Modify: `src/state/planReducer.ts` (`set-decision`, `set-booking`)
- Test: `src/domain/replacementBooking.test.ts`, `src/domain/planReducer.test.ts`

**Interfaces:**
- Consumes: `isVisitDecision` is not needed here; `visitsFromDecisions` from Task 3.
- Produces: `bookingsForVisits(bookings: Record<VehicleId, ReplacementBooking>, visits: Visit[]): Record<VehicleId, ReplacementBooking>` in `src/domain/replacementBooking.ts`.

- [ ] **Step 1: Write the failing domain test**

Append to `src/domain/replacementBooking.test.ts`, adding `bookingsForVisits` to the import list from `./replacementBooking` and `import type { ReplacementBooking, Visit } from './types'`:

```ts
describe('bookingsForVisits', () => {
  const visits: Visit[] = [
    { itemId: 'item-v118', vehicleId: 'V-118', garageId: 'werkstatt-berg', startDate: '2026-09-29', days: 1, scope: 'x' },
  ]
  const bookings: Record<string, ReplacementBooking> = {
    'V-118': { vehicleId: 'V-118', startDate: '2026-09-29', days: 1 },
    'V-027': { vehicleId: 'V-027', startDate: '2026-09-29', days: 2 },
  }

  it('keeps only bookings whose vehicle has a visit', () => {
    expect(Object.keys(bookingsForVisits(bookings, visits))).toEqual(['V-118'])
  })

  it('returns nothing when nothing visits', () => {
    expect(bookingsForVisits(bookings, [])).toEqual({})
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/domain/replacementBooking.test.ts`
Expected: FAIL, `bookingsForVisits` is not exported.

- [ ] **Step 3: Implement `bookingsForVisits`**

Append to `src/domain/replacementBooking.ts` (and add `Visit` to its type import):

```ts
/**
 * A replacement belongs to a visit. Every reader filters through here first,
 * so a booking that reached storage by any route other than the reducer, or
 * that outlived its visit, adds neither capacity nor cost. Structural, not
 * trusting, like deferralRecordsFrom. [scenario spec §5.4]
 */
export function bookingsForVisits(
  bookings: Record<VehicleId, ReplacementBooking>,
  visits: Visit[],
): Record<VehicleId, ReplacementBooking> {
  const visiting = new Set(visits.map((v) => v.vehicleId))
  return Object.fromEntries(Object.entries(bookings).filter(([vehicleId]) => visiting.has(vehicleId)))
}
```

- [ ] **Step 4: Write the failing reducer tests**

In `src/domain/planReducer.test.ts`, replace the whole `describe('booking a replacement')` block with the following. V-118 is used because it has a Tuesday visit in the adopted state; V-027 is watched and never visits.

```ts
describe('booking a replacement', () => {
  const v118 = { vehicleId: 'V-118', startDate: '2026-09-29', days: 1 }

  it('records a draft booking for a visiting vehicle, scoped to its own week', () => {
    const s = reduce(adoptedState(), { type: 'set-booking', weekId: '2026-09-28', booking: v118 })
    expect(bookingsFor({ state: s, weekId: '2026-09-28' })).toEqual({ 'V-118': v118 })
    expect(bookingsFor({ state: s, weekId: '2026-10-05' })).toEqual({})
  })

  it('ignores a booking for a vehicle whose draft has no visit', () => {
    const s = reduce(adoptedState(), {
      type: 'set-booking',
      weekId: '2026-09-28',
      booking: { vehicleId: 'V-027', startDate: '2026-09-29', days: 1 },
    })
    expect(bookingsFor({ state: s, weekId: '2026-09-28' })).toEqual({})
    expect(s).toEqual(adoptedState())
  })

  it('replaces a prior draft booking for the same vehicle rather than accumulating', () => {
    let s = reduce(adoptedState(), { type: 'set-booking', weekId: '2026-09-28', booking: v118 })
    s = reduce(s, {
      type: 'set-booking',
      weekId: '2026-09-28',
      booking: { vehicleId: 'V-118', startDate: '2026-09-30', days: 3 },
    })
    expect(bookingsFor({ state: s, weekId: '2026-09-28' })).toEqual({
      'V-118': { vehicleId: 'V-118', startDate: '2026-09-30', days: 3 },
    })
  })

  it('clears a booking', () => {
    let s = reduce(adoptedState(), { type: 'set-booking', weekId: '2026-09-28', booking: v118 })
    s = reduce(s, { type: 'clear-booking', weekId: '2026-09-28', vehicleId: 'V-118' })
    expect(bookingsFor({ state: s, weekId: '2026-09-28' })).toEqual({})
  })

  it('drops the booking when the item is switched to watch', () => {
    let s = reduce(adoptedState(), { type: 'set-booking', weekId: '2026-09-28', booking: v118 })
    s = reduce(s, {
      type: 'set-decision',
      weekId: '2026-09-28',
      decision: {
        itemId: 'item-v118',
        treatment: 'watch',
        slotDate: null,
        deferral: {
          reason: 'The interval is still 2,180 km away on the stated rate.',
          reviewDate: '2026-10-09',
          trigger: { kind: 'odometer', vehicleId: 'V-118', thresholdKm: 49_500, label: 'Odometer passes 49,500 km' },
        },
      },
    })
    expect(bookingsFor({ state: s, weekId: '2026-09-28' })).toEqual({})
  })

  it('drops the booking when the treatment is cleared', () => {
    let s = reduce(adoptedState(), { type: 'set-booking', weekId: '2026-09-28', booking: v118 })
    s = reduce(s, {
      type: 'set-decision',
      weekId: '2026-09-28',
      decision: { itemId: 'item-v118', treatment: null, slotDate: null, deferral: null },
    })
    expect(bookingsFor({ state: s, weekId: '2026-09-28' })).toEqual({})
  })

  it('keeps the booking as the user set it when the visit merely moves day', () => {
    let s = reduce(adoptedState(), { type: 'set-booking', weekId: '2026-09-28', booking: v118 })
    s = reduce(s, {
      type: 'set-decision',
      weekId: '2026-09-28',
      decision: { itemId: 'item-v118', treatment: 'act-now', slotDate: '2026-10-01', deferral: null },
    })
    expect(bookingsFor({ state: s, weekId: '2026-09-28' })).toEqual({ 'V-118': v118 })
  })

  it('snapshots the booking on commit and survives a later draft edit', () => {
    let s = reduce(adoptedState(), { type: 'set-booking', weekId: '2026-09-28', booking: v118 })
    s = reduce(s, { type: 'commit', weekId: '2026-09-28' })
    expect(s.committedByWeek['2026-09-28']!.bookings['V-118']).toEqual(v118)

    s = reduce(s, {
      type: 'set-booking',
      weekId: '2026-09-28',
      booking: { vehicleId: 'V-118', startDate: '2026-09-30', days: 2 },
    })
    expect(s.committedByWeek['2026-09-28']!.bookings['V-118'].startDate).toBe('2026-09-29')
  })

  it('clears every booking on reset', () => {
    let s = reduce(adoptedState(), { type: 'set-booking', weekId: '2026-09-28', booking: v118 })
    s = reduce(s, { type: 'reset' })
    expect(s).toEqual(initialState(fixture))
  })
})
```

- [ ] **Step 5: Run to verify the new reducer tests fail**

Run: `npx vitest run src/domain/planReducer.test.ts`
Expected: FAIL on `ignores a booking for a vehicle whose draft has no visit`, `drops the booking when the item is switched to watch` and `drops the booking when the treatment is cleared`.

- [ ] **Step 6: Implement the reducer guards**

In `src/state/planReducer.ts`, add two imports:

```ts
import { bookingsForVisits } from '../domain/replacementBooking'
import { visitsFromDecisions } from '../domain/visits'
```

Replace the `set-decision` and `set-booking` cases:

```ts
    case 'set-decision': {
      const current = draftFor({ fixture, state, weekId: action.weekId })
      // A deferral is meaningful only under watch. Normalising at the write
      // site keeps a decision moved off watch from carrying a stale follow-up.
      const decision: DraftDecision =
        action.decision.treatment === 'watch' ? action.decision : { ...action.decision, deferral: null }
      const draft = { ...current, [decision.itemId]: decision }
      // A replacement belongs to a visit. Whenever the decisions change, the
      // week's bookings are pruned to vehicles that still have one, so a
      // watched or undecided item carries neither cover capacity nor cover
      // cost. [scenario spec §5.3]
      const bookings = bookingsForVisits(
        bookingsFor({ state, weekId: action.weekId }),
        visitsFromDecisions(draft, fixture.items),
      )
      return {
        ...state,
        draftByWeek: { ...state.draftByWeek, [action.weekId]: draft },
        draftBookingsByWeek: { ...state.draftBookingsByWeek, [action.weekId]: bookings },
      }
    }

    case 'set-booking': {
      // Structural: no action sequence can store a booking for a vehicle
      // whose draft has no visit. The control offers the request only once a
      // visit is applied; this guard does not rely on that. [scenario spec §5.3]
      const visits = visitsFromDecisions(draftFor({ fixture, state, weekId: action.weekId }), fixture.items)
      if (!visits.some((v) => v.vehicleId === action.booking.vehicleId)) return state
      const current = bookingsFor({ state, weekId: action.weekId })
      return {
        ...state,
        draftBookingsByWeek: {
          ...state.draftBookingsByWeek,
          [action.weekId]: { ...current, [action.booking.vehicleId]: action.booking },
        },
      }
    }
```

- [ ] **Step 7: Run the suite**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass, tsc clean. `commit.test.ts`'s bookings tests call `commitPlan` directly with a V-027 booking; that is a pure snapshot and is unaffected.

- [ ] **Step 8: Commit**

```bash
git add src/domain/replacementBooking.ts src/domain/replacementBooking.test.ts src/state/planReducer.ts src/domain/planReducer.test.ts
git commit -m "feat: a replacement booking belongs to a visit; the reducer prunes and guards, readers can filter"
```

---

### Task 5: Cover cost comes only from a requested booking

**Files:**
- Modify: `src/domain/types.ts:43-48` (`Consequence`)
- Modify: `src/domain/fixture.ts` (seven `coverCostEur` lines)
- Modify: `src/domain/consequence.ts`
- Modify: `src/domain/recommendation.ts` (`recommendationFor`)
- Modify: `src/domain/costs.ts`
- Test: `src/domain/recommendation.test.ts`, `src/domain/costs.test.ts`

**Interfaces:**
- Consumes: `bookingsForVisits` (Task 4), `proposedDecisions` (Task 1).
- Produces: `consequenceView(item: OpenItem, requestedCoverCostEur: number | null = null): ConsequenceView`; `recommendationFor(item: OpenItem, requestedCoverCostEur: number | null = null): RecommendationView`. `Consequence` no longer has `coverCostEur`. `costSummaryFor`'s signature is unchanged.

- [ ] **Step 1: Write the failing consequence tests**

In `src/domain/recommendation.test.ts`, replace the whole `describe('consequence keeps three figures apart')` block with:

```ts
describe('the cover figure comes only from a requested replacement', () => {
  it('reads not requested until a booking exists, even for the held van', () => {
    expect(consequenceView(item('item-v012')).coverCost).toBe('not requested')
    expect(consequenceView(item('item-v027')).coverCost).toBe('not requested')
  })

  it('reads the booking cost once one is requested', () => {
    expect(consequenceView(item('item-v012'), 700).coverCost).toBe('EUR 700')
    expect(consequenceView(item('item-v118'), 280).coverCost).toBe('EUR 280')
  })

  it('shows not available, never zero or a price, where no compatible cover exists', () => {
    expect(consequenceView(item('item-v041')).coverCost).toBe('not available')
    expect(consequenceView(item('item-v041'), 140).coverCost).toBe('not available')
    expect(consequenceView(item('item-v041')).coverCost).not.toContain('0')
  })

  it('keeps service cost as the fixture estimate, shown before any decision', () => {
    expect(consequenceView(item('item-v012')).serviceCost).toBe('EUR 480')
  })

  it('never renders operational disruption as money', () => {
    for (const i of fixture.items) {
      expect(consequenceView(i).disruption).not.toMatch(/EUR/)
    }
  })
})
```

In `describe('the recommendation contract')`, add to the first test, after the `serviceCost` assertion:

```ts
    expect(r.consequence.coverCost).toBe('not requested')
    expect(recommendationFor(item('item-v118'), 140).consequence.coverCost).toBe('EUR 140')
```

- [ ] **Step 2: Write the failing cost tests**

Replace the whole of `src/domain/costs.test.ts` with:

```ts
import { describe, expect, it } from 'vitest'
import { costSummaryFor } from './costs'
import { fixture } from './fixture'
import { proposedDecisions } from './testSupport'
import { draftFor, initialState } from '../state/planReducer'
import type { DraftDecision, ItemId, ReplacementBooking, VehicleId } from './types'

const WEEK_40 = '2026-09-28'
const rate = fixture.replacementDayRateEur

describe('costSummaryFor', () => {
  it('charges nothing at the true cold open, where nothing is decided', () => {
    const open = draftFor({ fixture, state: initialState(fixture), weekId: WEEK_40 })
    expect(costSummaryFor({ fixture, weekId: WEEK_40, decisions: open, bookings: {} })).toEqual({
      serviceCostEur: 0,
      coverCostEur: 0,
      totalEur: 0,
      budgetEur: 3000,
      overByEur: null,
    })
  })

  it('sums service cost for visited items only, and no cover until one is requested', () => {
    const s = costSummaryFor({ fixture, weekId: WEEK_40, decisions: proposedDecisions(), bookings: {} })
    // Visited once adopted: V-012 (480), V-103 (620), V-118 (340). V-041 has
    // no slot and V-027 is watched, so neither contributes.
    expect(s.serviceCostEur).toBe(480 + 620 + 340)
    expect(s.coverCostEur).toBe(0)
    expect(s.totalEur).toBe(1440)
  })

  it('adds a requested booking for a visiting vehicle', () => {
    const bookings: Record<VehicleId, ReplacementBooking> = {
      'V-012': { vehicleId: 'V-012', startDate: '2026-09-28', days: 5 },
    }
    const s = costSummaryFor({ fixture, weekId: WEEK_40, decisions: proposedDecisions(), bookings })
    expect(s.coverCostEur).toBe(5 * rate)
    expect(s.totalEur).toBe(1440 + 5 * rate)
  })

  it('ignores a booking for a vehicle without a visit', () => {
    const bookings: Record<VehicleId, ReplacementBooking> = {
      'V-027': { vehicleId: 'V-027', startDate: '2026-09-29', days: 2 },
    }
    const s = costSummaryFor({ fixture, weekId: WEEK_40, decisions: proposedDecisions(), bookings })
    expect(s.coverCostEur).toBe(0)
    expect(s.totalEur).toBe(1440)
  })

  it('never counts an item that is watched or undecided', () => {
    const decisions: Record<ItemId, DraftDecision> = {
      'item-v012': { itemId: 'item-v012', treatment: 'act-now', slotDate: '2026-09-29', deferral: null },
      'item-v041': { itemId: 'item-v041', treatment: 'watch', slotDate: null, deferral: null },
      'item-v027': { itemId: 'item-v027', treatment: null, slotDate: null, deferral: null },
    }
    const s = costSummaryFor({ fixture, weekId: WEEK_40, decisions, bookings: {} })
    expect(s.serviceCostEur).toBe(480)
    expect(s.coverCostEur).toBe(0)
    expect(s.totalEur).toBe(480)
  })

  it('reports no overage under budget, and the exact overage above it', () => {
    const under = costSummaryFor({ fixture, weekId: WEEK_40, decisions: proposedDecisions(), bookings: {} })
    expect(under.overByEur).toBeNull()
    expect(under.budgetEur).toBe(3000)

    // Five days of cover for each of the three visiting vans: 3 × 700 on top of 1,440.
    const bookings: Record<VehicleId, ReplacementBooking> = {
      'V-012': { vehicleId: 'V-012', startDate: '2026-09-28', days: 5 },
      'V-103': { vehicleId: 'V-103', startDate: '2026-09-28', days: 5 },
      'V-118': { vehicleId: 'V-118', startDate: '2026-09-28', days: 5 },
    }
    const over = costSummaryFor({ fixture, weekId: WEEK_40, decisions: proposedDecisions(), bookings })
    expect(over.totalEur).toBe(1440 + 3 * 5 * rate)
    expect(over.overByEur).toBe(1440 + 3 * 5 * rate - 3000)
  })
})
```

- [ ] **Step 3: Run both files to verify they fail**

Run: `npx vitest run src/domain/recommendation.test.ts src/domain/costs.test.ts`
Expected: FAIL. `consequenceView` ignores its second argument and reads `EUR 700` for V-012; `costSummaryFor` still adds the item-level cover cost (`coverCostEur` 700 + 140 + 140).

- [ ] **Step 4: Delete `coverCostEur` from the type and the fixture**

`src/domain/types.ts`: remove the line `  coverCostEur: number | null` from `Consequence`, leaving:

```ts
export interface Consequence {
  qualitative: string
  serviceCostEur: number | null
  coverUnavailable: boolean
  uncoveredAssignmentsNote: string
}
```

`src/domain/fixture.ts`: delete these seven lines, one in each item's `consequence` block, exactly as written:

```
      coverCostEur: 700,
      coverCostEur: 140,
      coverCostEur: 140,
      coverCostEur: null,
      coverCostEur: 0,
      coverCostEur: 140,
      coverCostEur: 140,
```

Check: `grep -n coverCostEur src/domain/fixture.ts src/domain/types.ts` prints nothing.

- [ ] **Step 5: Rewrite `consequenceView` and thread the figure through `recommendationFor`**

Replace `src/domain/consequence.ts` with:

```ts
import type { OpenItem } from './types'

export interface ConsequenceView {
  qualitative: string
  serviceCost: string
  coverCost: string
  disruption: string
}

const eur = (n: number) => `EUR ${n.toLocaleString('en-GB')}`

/**
 * Service cost stays the fixture's estimate, shown before any decision,
 * because it is the number the decision is weighed against. Cover is
 * different: it exists only where a replacement was actually requested, so
 * it reads "not requested" until then, never a hand-authored guess and never
 * zero. A specialist still reads "not available", whatever is passed, because
 * no compatible cover exists at any price. Operational disruption stays a
 * count and never becomes money. [S 3.4, scenario spec §5.5]
 */
export function consequenceView(
  item: OpenItem,
  requestedCoverCostEur: number | null = null,
): ConsequenceView {
  const c = item.consequence
  return {
    qualitative: c.qualitative,
    serviceCost: c.serviceCostEur === null ? 'not stated' : eur(c.serviceCostEur),
    coverCost: c.coverUnavailable
      ? 'not available'
      : requestedCoverCostEur === null
        ? 'not requested'
        : eur(requestedCoverCostEur),
    disruption: c.uncoveredAssignmentsNote,
  }
}
```

In `src/domain/recommendation.ts`, change `recommendationFor`:

```ts
export function recommendationFor(
  item: OpenItem,
  requestedCoverCostEur: number | null = null,
): RecommendationView {
  return {
    urgency: item.urgency,
    observation: item.evidence.observation,
    source: item.evidence.source,
    receivedOn: item.evidence.receivedOn,
    verbatim: item.evidence.verbatim,
    relevantDate: item.urgency.relevantDate,
    assumption: item.assumption,
    proposedAction: proposedAction(item),
    consequence: consequenceView(item, requestedCoverCostEur),
  }
}
```

- [ ] **Step 6: Charge only requested, visit-bound cover in `costSummaryFor`**

Replace `src/domain/costs.ts` with:

```ts
import { weekFixtureFor } from './capacity'
import { bookingCostEur, bookingsForVisits } from './replacementBooking'
import type { DraftDecision, Fixture, ItemId, ReplacementBooking, VehicleId, WeekId } from './types'
import { visitsFromDecisions } from './visits'

export interface CostSummary {
  serviceCostEur: number
  coverCostEur: number
  totalEur: number
  budgetEur: number
  overByEur: number | null
}

/**
 * One function for both the live dashboard and the frozen commit summary, so
 * cost can never disagree with itself between the two surfaces the way
 * capacity once did (5bbdec1, 25dee47). [replacement cover spec §4.2]
 *
 * Service cost is charged for every item with a visit this week. Cover cost
 * is charged only for a replacement the user actually requested, and only
 * while its vehicle has a visit; the pre-confirmed rentals R-1 and R-2 are
 * fixture inputs, like the budget itself, and never enter this total.
 * Operational disruption is not part of it either: it stays a count, never
 * money [C §3.6, as amended 2026-09-24]. [scenario spec §5.6]
 */
export function costSummaryFor(args: {
  fixture: Fixture
  weekId: WeekId
  decisions: Record<ItemId, DraftDecision>
  bookings: Record<VehicleId, ReplacementBooking>
}): CostSummary {
  const { fixture, weekId, decisions, bookings } = args
  const week = weekFixtureFor(fixture, weekId)
  const visits = visitsFromDecisions(decisions, fixture.items)
  const visitedItemIds = new Set(visits.map((v) => v.itemId))

  let serviceCostEur = 0
  for (const item of fixture.items) {
    if (visitedItemIds.has(item.id)) serviceCostEur += item.consequence.serviceCostEur ?? 0
  }

  let coverCostEur = 0
  for (const booking of Object.values(bookingsForVisits(bookings, visits))) {
    coverCostEur += bookingCostEur(booking, fixture.replacementDayRateEur)
  }

  const totalEur = serviceCostEur + coverCostEur
  const overByEur = totalEur > week.budgetEur ? totalEur - week.budgetEur : null

  return { serviceCostEur, coverCostEur, totalEur, budgetEur: week.budgetEur, overByEur }
}
```

- [ ] **Step 7: Run the suite and the type check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass, tsc clean. `ConsequenceBlock.tsx` reads only the view's strings and needs no change.

- [ ] **Step 8: Commit**

```bash
git add src/domain/types.ts src/domain/fixture.ts src/domain/consequence.ts src/domain/recommendation.ts \
  src/domain/costs.ts src/domain/recommendation.test.ts src/domain/costs.test.ts
git commit -m "feat: cover cost exists only where a replacement was requested; delete the hand-authored item-level figure"
```

---

### Task 6: Every capacity reader filters bookings to visiting vehicles

**Files:**
- Modify: `src/domain/validation.ts:19-25`
- Modify: `src/domain/fleetStatus.ts:106-116` (`fleetOverview` setup)
- Modify: `src/domain/commit.ts` (`summaryFor`, `dailyConfirmation`)
- Modify: `src/ui/CapacityBand.tsx:19-24`
- Test: `src/domain/validation.test.ts`, `src/domain/fleetStatus.test.ts`, `src/domain/commit.test.ts`

**Interfaces:**
- Consumes: `bookingsForVisits` (Task 4).
- Produces: no new exports. `summaryFor` and `dailyConfirmation` now count the committed plan's visit-bound bookings as cover, and `dailyConfirmation().coverInUse` lists them.

- [ ] **Step 1: Write the failing validation tests**

In `src/domain/validation.test.ts`, replace `describe('a requested booking clears a capacity blocker')` with:

```ts
describe('a requested booking clears a capacity blocker only for a vehicle with a visit', () => {
  it('removes the Tuesday shortfall once the visiting van is covered', () => {
    const bookings = { 'V-118': { vehicleId: 'V-118', startDate: '2026-09-29', days: 1 } }
    const blockers = validatePlan({ fixture, weekId: WEEK_40, decisions: proposed(), bookings })
    expect(blockers.some((b) => b.kind === 'capacity-shortfall')).toBe(false)
  })

  it('does nothing for a booking on a different day', () => {
    const bookings = { 'V-118': { vehicleId: 'V-118', startDate: '2026-09-30', days: 1 } }
    const blockers = validatePlan({ fixture, weekId: WEEK_40, decisions: proposed(), bookings })
    expect(blockers.some((b) => b.kind === 'capacity-shortfall')).toBe(true)
  })

  it('does nothing for a vehicle that has no visit', () => {
    const bookings = { 'V-027': { vehicleId: 'V-027', startDate: '2026-09-29', days: 1 } }
    const blockers = validatePlan({ fixture, weekId: WEEK_40, decisions: proposed(), bookings })
    expect(blockers.some((b) => b.kind === 'capacity-shortfall')).toBe(true)
  })
})
```

- [ ] **Step 2: Write the failing fleet status test**

In `src/domain/fleetStatus.test.ts`, add a second test inside `describe("a booking is reflected in tomorrow's coverage")`:

```ts
  it('adds nothing for a booking whose vehicle has no visit', () => {
    const s = adoptedState()
    const weekId = activeWeekId(s)
    const decisions = draftFor({ fixture, state: s, weekId })
    const bookings: Record<string, ReplacementBooking> = {
      'V-027': { vehicleId: 'V-027', startDate: '2026-09-29', days: 1 },
    }
    const o = fleetOverview({
      fixture,
      today: s.demoDate,
      queueItems: queueFor({ fixture, state: s, weekId }).map((e) => e.item),
      decisions,
      blockers: validatePlan({ fixture, weekId, decisions, bookings }),
      committed: s.committedByWeek[weekId] ?? null,
      deferralHistory: s.deferralHistory,
      bookings,
    })
    expect(o.nextBusinessDay.covered).toBe(false)
    expect(o.nextBusinessDay.coverOnSite).toEqual(['R-1', 'R-2'])
  })
```

- [ ] **Step 3: Write the failing commit tests**

Append to `src/domain/commit.test.ts`:

```ts
describe('a committed booking is cover in the summary and the daily confirmation', () => {
  // V-118 back on Tuesday beside V-012 and V-103: short by one without cover.
  function tuesdayHeavy(): Record<ItemId, DraftDecision> {
    const d = committable()
    d['item-v118'] = { ...d['item-v118'], slotDate: '2026-09-29' }
    return d
  }
  const bookings = { 'V-118': { vehicleId: 'V-118', startDate: '2026-09-29', days: 1 } }
  const tuesdayStandard = (rows: { date: string; vehicleClass: string; shortfall: number }[]) =>
    rows.find((a) => a.date === '2026-09-29' && a.vehicleClass === 'standard')!

  it('clears the Tuesday shortfall in forward availability', () => {
    const without = summaryFor({
      fixture,
      plan: commitPlan({ weekId: WEEK_40, decisions: tuesdayHeavy(), demoDate: '2026-09-28' }),
    })
    expect(tuesdayStandard(without.availability).shortfall).toBe(1)

    const withBooking = summaryFor({
      fixture,
      plan: commitPlan({ weekId: WEEK_40, decisions: tuesdayHeavy(), bookings, demoDate: '2026-09-28' }),
    })
    expect(tuesdayStandard(withBooking.availability).shortfall).toBe(0)
  })

  it('lists the booking as cover in use on its day, and not on others', () => {
    const plan = commitPlan({ weekId: WEEK_40, decisions: tuesdayHeavy(), bookings, demoDate: '2026-09-28' })
    expect(dailyConfirmation({ fixture, plan, forDate: '2026-09-29' }).coverInUse).toEqual([
      'R-1',
      'R-2',
      'V-118 replacement',
    ])
    expect(dailyConfirmation({ fixture, plan, forDate: '2026-09-29' }).rows.every((r) => r.shortfall === 0)).toBe(true)
    expect(dailyConfirmation({ fixture, plan, forDate: '2026-09-30' }).coverInUse).toEqual(['R-1'])
  })

  it('ignores a committed booking whose vehicle has no visit', () => {
    const stale = { 'V-027': { vehicleId: 'V-027', startDate: '2026-09-29', days: 1 } }
    const plan = commitPlan({ weekId: WEEK_40, decisions: tuesdayHeavy(), bookings: stale, demoDate: '2026-09-28' })
    expect(tuesdayStandard(summaryFor({ fixture, plan }).availability).shortfall).toBe(1)
    expect(dailyConfirmation({ fixture, plan, forDate: '2026-09-29' }).coverInUse).toEqual(['R-1', 'R-2'])
  })
})
```

- [ ] **Step 4: Run the three files to verify they fail**

Run: `npx vitest run src/domain/validation.test.ts src/domain/fleetStatus.test.ts src/domain/commit.test.ts`
Expected: FAIL on `does nothing for a vehicle that has no visit`, `adds nothing for a booking whose vehicle has no visit`, `clears the Tuesday shortfall in forward availability` and `lists the booking as cover in use`.

- [ ] **Step 5: Filter in `validatePlan`**

In `src/domain/validation.ts`, change the import and the `adHocCovers` line:

```ts
import { adHocCoversFrom, bookingsForVisits } from './replacementBooking'
```

```ts
  const visits = visitsFromDecisions(decisions, fixture.items)
  // A booking counts as cover only while its vehicle has a visit. [scenario spec §5.4]
  const adHocCovers = adHocCoversFrom(bookingsForVisits(bookings, visits), fixture.replacementDayRateEur)
```

- [ ] **Step 6: Filter in `fleetOverview`'s coverage lines**

In `src/domain/fleetStatus.ts`, change the import and move the `adHocCovers` line below `draftVisits`:

```ts
import { adHocCoversFrom, bookingsForVisits } from './replacementBooking'
```

```ts
  const { fixture, today, queueItems, decisions, blockers, committed, deferralHistory, bookings = {} } = args

  // A van turns red only for an operational fact: a hold, or a committed
  // visit. Coverage is a different question, and both its lines read the
  // draft, exactly as the band does, so no day of the active week can have a
  // second capacity semantics. [spec 4, 7]
  const committedVisits =
    committed === null ? [] : visitsFromDecisions(committed.decisions, fixture.items)
  const draftVisits = visitsFromDecisions(decisions, fixture.items)
  // Draft bookings, filtered to draft visits: the same rule every other
  // capacity reader applies. [scenario spec §5.4]
  const adHocCovers = adHocCoversFrom(bookingsForVisits(bookings, draftVisits), fixture.replacementDayRateEur)
```

Delete the earlier `const adHocCovers = adHocCoversFrom(bookings, fixture.replacementDayRateEur)` line that sat directly under the destructuring.

- [ ] **Step 7: Count committed bookings in `summaryFor` and `dailyConfirmation`**

In `src/domain/commit.ts`, add the import:

```ts
import { adHocCoversFrom, bookingsForVisits } from './replacementBooking'
```

In `summaryFor`, after `const visits = visitsFromDecisions(plan.decisions, fixture.items)`:

```ts
  // A committed replacement is cover in the summary too. Until now the band
  // counted it and this table did not. [scenario spec §6]
  const adHocCovers = adHocCoversFrom(bookingsForVisits(plan.bookings, visits), fixture.replacementDayRateEur)
```

and change the availability line to:

```ts
    availability: computeWeekCapacity({ fixture, weekId: plan.weekId, visits, adHocCovers }),
```

In `dailyConfirmation`, after `const visits = visitsFromDecisions(plan.decisions, fixture.items)`:

```ts
  const adHocCovers = adHocCoversFrom(bookingsForVisits(plan.bookings, visits), fixture.replacementDayRateEur)
```

change the `rows` computation to pass `adHocCovers`:

```ts
    rows: classes.map((vehicleClass) =>
      computeDayCapacity({ date: forDate, vehicleClass, fixture, visits, week, adHocCovers }),
    ),
```

and replace `coverInUse` with:

```ts
    coverInUse: [
      ...fixture.covers.filter((c) => week.coverIds.includes(c.id) && c.confirmedDates.includes(forDate)),
      ...adHocCovers.filter((c) => c.confirmedDates.includes(forDate)),
    ]
      .map((c) => c.id)
      .sort(),
```

- [ ] **Step 8: Filter in the band**

In `src/ui/CapacityBand.tsx`:

```ts
import { adHocCoversFrom, bookingsForVisits } from '../domain/replacementBooking'
```

```ts
  const visits = visitsFromDecisions(decisions, fixture.items)
  const adHocCovers = adHocCoversFrom(bookingsForVisits(bookings, visits), fixture.replacementDayRateEur)
```

- [ ] **Step 9: Run the suite and the type check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass, tsc clean.

- [ ] **Step 10: Commit**

```bash
git add src/domain/validation.ts src/domain/fleetStatus.ts src/domain/commit.ts src/ui/CapacityBand.tsx \
  src/domain/validation.test.ts src/domain/fleetStatus.test.ts src/domain/commit.test.ts
git commit -m "feat: every capacity reader counts only visit-bound bookings, the commit summary included"
```

---

### Task 7: The dashboard shows a committed replacement as a per-van fact

**Files:**
- Modify: `src/domain/fleetStatus.ts` (`fleetOverview`, `statusOf`)
- Test: `src/domain/fleetStatus.test.ts`

**Interfaces:**
- Consumes: `bookingsForVisits` (Task 4), `daysBetween` and `formatDay` from `./clock`.
- Produces: two new `VanStatus.facts` strings, `Replacement on site · day n of m` and `Replacement booked <day> · m days`, derived from the committed plan only.

- [ ] **Step 1: Write the failing tests**

Append to `src/domain/fleetStatus.test.ts` (it already imports `adoptedState`, `ReplacementBooking`, `planReducer`, `activeWeekId`, `draftFor`, `queueFor`, `validatePlan`, `fleetOverview` from Task 1):

```ts
describe('fleet overview shows a committed replacement as a fact about the van', () => {
  const HELD = 'Held · Safety-relevant brake defect recorded at UVV inspection'

  /** The walkthrough commit, plus one requested replacement. */
  function committedWith(booking: ReplacementBooking): AppState {
    let s = adoptedState()
    s = planReducer(
      s,
      {
        type: 'set-decision',
        weekId: WEEK_40,
        decision: { itemId: 'item-v118', treatment: 'act-now', slotDate: '2026-10-01', deferral: null },
      },
      fixture,
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
      fixture,
    )
    s = planReducer(s, { type: 'set-booking', weekId: WEEK_40, booking }, fixture)
    return planReducer(s, { type: 'commit', weekId: WEEK_40 }, fixture)
  }

  it('reads on site with its day count while the booking runs', () => {
    const monday = committedWith({ vehicleId: 'V-012', startDate: '2026-09-28', days: 5 })
    expect(vanOf(overviewFor(monday), 'V-012').facts).toEqual([
      HELD,
      'Booked Tue 29 Sep',
      'Replacement on site · day 1 of 5',
    ])
    const tuesday = planReducer(monday, { type: 'advance-days', days: 1 }, fixture)
    expect(vanOf(overviewFor(tuesday), 'V-012').facts).toEqual([
      HELD,
      'In workshop · day 1 of 1',
      'Replacement on site · day 2 of 5',
    ])
  })

  it('reads booked with its start day before it begins, on a green van', () => {
    const o = overviewFor(committedWith({ vehicleId: 'V-118', startDate: '2026-10-01', days: 1 }))
    expect(vanOf(o, 'V-118').kind).toBe('in-service')
    expect(vanOf(o, 'V-118').facts).toEqual(['Booked Thu 1 Oct', 'Replacement booked Thu 1 Oct · 1 day'])
  })

  it('says nothing once the booking has ended', () => {
    const friday = planReducer(
      committedWith({ vehicleId: 'V-118', startDate: '2026-10-01', days: 1 }),
      { type: 'advance-days', days: 4 },
      fixture,
    )
    expect(vanOf(overviewFor(friday), 'V-118').facts).toEqual(['Booked Thu 1 Oct'])
  })

  it('never shows a draft request', () => {
    let s = adoptedState()
    s = planReducer(
      s,
      { type: 'set-booking', weekId: WEEK_40, booking: { vehicleId: 'V-012', startDate: '2026-09-28', days: 5 } },
      fixture,
    )
    const weekId = activeWeekId(s)
    const decisions = draftFor({ fixture, state: s, weekId })
    const bookings = s.draftBookingsByWeek[weekId] ?? {}
    expect(Object.keys(bookings)).toEqual(['V-012'])
    const o = fleetOverview({
      fixture,
      today: s.demoDate,
      queueItems: queueFor({ fixture, state: s, weekId }).map((e) => e.item),
      decisions,
      blockers: validatePlan({ fixture, weekId, decisions, bookings }),
      committed: null,
      deferralHistory: s.deferralHistory,
      bookings,
    })
    expect(vanOf(o, 'V-012').facts).toEqual([HELD])
    // The draft booking still counts as cover on Monday's coverage line.
    expect(o.today.coverOnSite).toEqual(['R-1', 'V-012 replacement'])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/domain/fleetStatus.test.ts -t "committed replacement"`
Expected: FAIL, the facts arrays carry no `Replacement …` entry.

- [ ] **Step 3: Implement the facts**

In `src/domain/fleetStatus.ts`, directly after the `committedVisits` declaration in `fleetOverview`:

```ts
  // A committed replacement is an operational fact about the van, by the same
  // rule as In workshop and Booked: committed, never draft, and only while its
  // vehicle has a committed visit. [scenario spec §6]
  const committedBookings =
    committed === null ? {} : bookingsForVisits(committed.bookings, committedVisits)
```

Inside `statusOf`, after the `for (const item of fixture.items)` loop that pushes `Watching · …` facts and before `const base = {`:

```ts
    const replacement = committedBookings[vehicle.id]
    if (replacement !== undefined) {
      const day = daysBetween(replacement.startDate, today) + 1
      if (day >= 1 && day <= replacement.days) {
        planFacts.push(`Replacement on site · day ${day} of ${replacement.days}`)
      } else if (today < replacement.startDate) {
        const length = `${replacement.days} ${replacement.days === 1 ? 'day' : 'days'}`
        planFacts.push(`Replacement booked ${formatDay(replacement.startDate)} · ${length}`)
      }
    }
```

Update the `VanStatus.facts` doc comment to list the two new forms:

```ts
  /** Sub-label lines, already worded: 'Held · …', 'In workshop · day 1 of 2',
   *  'Booked Thu 1 Oct', 'Watching · review Mon 2 Nov', 'Replacement on site ·
   *  day 1 of 5', 'Replacement booked Thu 1 Oct · 1 day'. Empty for a plain
   *  green van and for an amber one (the card renders the item instead). */
```

- [ ] **Step 4: Run the suite and the type check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/domain/fleetStatus.ts src/domain/fleetStatus.test.ts
git commit -m "feat: show a committed replacement as a per-van dashboard fact"
```

---

### Task 8: `capacityFigure`: own vans and rentals, separately, on three surfaces

**Files:**
- Modify: `src/domain/types.ts:161-170` (`DayCapacity`)
- Modify: `src/domain/capacity.ts` (`computeDayCapacity`, new `capacityFigure`, `capacityBreakdown`)
- Modify: `src/ui/CapacityBand.tsx` (`Cell`, caption)
- Modify: `src/ui/CommitSummary.tsx` (forward availability)
- Modify: `src/ui/DailyConfirmation.tsx` (rows)
- Test: `src/domain/capacity.test.ts`

**Interfaces:**
- Produces: `DayCapacity.coverIds: string[]`; `capacityFigure(day: DayCapacity): string`; `capacityBreakdown(day: DayCapacity): string`, both exported from `src/domain/capacity.ts`.

- [ ] **Step 1: Write the failing tests**

Append to `src/domain/capacity.test.ts`, adding `capacityBreakdown, capacityFigure` to the import from `./capacity`:

```ts
describe('capacity figures name own vans and rentals separately', () => {
  const adopted = visitsFromDecisions(proposedDecisions(), fixture.items)
  const week = weekFixtureFor(fixture, WEEK_40)

  it('reads own + rental / demand where rentals are on site', () => {
    const thu = standardFor(adopted, '2026-10-01')
    expect(thu.available).toBe(39)
    expect(thu.coverIds).toEqual(['R-1', 'R-2'])
    expect(capacityFigure(thu)).toBe('37 + 2 / 38')
    expect(capacityFigure(standardFor(adopted, '2026-09-29'))).toBe('35 + 2 / 38')
    expect(capacityFigure(standardFor([], '2026-09-30'))).toBe('37 + 1 / 38')
  })

  it('drops the rental term where no cover exists', () => {
    const spec = computeDayCapacity({ date: '2026-10-01', vehicleClass: 'specialist', fixture, visits: adopted, week })
    expect(spec.coverIds).toEqual([])
    expect(capacityFigure(spec)).toBe('7 / 7')
  })

  it('lists an ad hoc cover by its id', () => {
    const extra: Cover = { id: 'V-118 replacement', vehicleClass: 'standard', confirmedDates: ['2026-09-29'], dayRateEur: 140 }
    const tue = computeDayCapacity({
      date: '2026-09-29',
      vehicleClass: 'standard',
      fixture,
      visits: adopted,
      week,
      adHocCovers: [extra],
    })
    expect(tue.coverIds).toEqual(['R-1', 'R-2', 'V-118 replacement'])
    expect(capacityFigure(tue)).toBe('35 + 3 / 38')
  })

  it('spells the breakdown out for the cell tooltip', () => {
    expect(capacityBreakdown(standardFor(adopted, '2026-10-01'))).toBe(
      '38 owned · off the road: V-012 · rentals on site: R-1, R-2',
    )
    const spec = computeDayCapacity({ date: '2026-10-01', vehicleClass: 'specialist', fixture, visits: adopted, week })
    expect(capacityBreakdown(spec)).toBe('7 owned · none off the road · no rental on site')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/domain/capacity.test.ts`
Expected: FAIL, `capacityFigure` and `capacityBreakdown` are not exported and `coverIds` is undefined.

- [ ] **Step 3: Add `coverIds` and the two formatters**

`src/domain/types.ts`, in `DayCapacity`, add `coverIds` after `cover`:

```ts
export interface DayCapacity {
  date: ISODate
  vehicleClass: VehicleClass
  owned: number
  unavailable: VehicleId[]
  cover: number
  /** Pool rentals first, then ad hoc bookings, in the order they were counted. */
  coverIds: string[]
  available: number
  demand: number
  shortfall: number
}
```

`src/domain/capacity.ts`: in `computeDayCapacity`, replace the block from `const poolCover = …` through `const cover = poolCover + extraCover` with:

```ts
  // Cover carries its own class, so a standard rental can never close a
  // specialist gap. The data model does not allow it. [S 3.1]
  const poolCovers = fixture.covers.filter(
    (c) =>
      week.coverIds.includes(c.id) &&
      c.vehicleClass === vehicleClass &&
      c.confirmedDates.includes(date),
  )
  // A requested replacement booking is merged in as an indistinguishable
  // extra cover source, so it clears a shortfall exactly like R-1 or R-2
  // does, with no second capacity mechanism to keep in sync. [replacement
  // cover spec §4.1]
  const extraCovers = adHocCovers.filter(
    (c) => c.vehicleClass === vehicleClass && c.confirmedDates.includes(date),
  )
  const coverIds = [...poolCovers, ...extraCovers].map((c) => c.id)
  const cover = coverIds.length
```

and add `coverIds,` to the returned object, directly after `cover,`. Then append to the file:

```ts
/**
 * Own vans and rentals, stated separately, so a day where rentals outnumber
 * outages reads `37 + 2 / 38` rather than one total larger than the fleet.
 * The `+ n` term appears only where cover exists. Short, spare, impacted and
 * candidate states still key off `available` against `demand`; this changes
 * the words, not the arithmetic. [scenario spec §7]
 */
export function capacityFigure(day: DayCapacity): string {
  const own = day.owned - day.unavailable.length
  return day.cover > 0 ? `${own} + ${day.cover} / ${day.demand}` : `${own} / ${day.demand}`
}

/** The parts behind the figure, for the cell's tooltip. [scenario spec §7] */
export function capacityBreakdown(day: DayCapacity): string {
  const offRoad =
    day.unavailable.length === 0 ? 'none off the road' : `off the road: ${day.unavailable.join(', ')}`
  const rentals = day.coverIds.length === 0 ? 'no rental on site' : `rentals on site: ${day.coverIds.join(', ')}`
  return `${day.owned} owned · ${offRoad} · ${rentals}`
}
```

- [ ] **Step 4: Run the domain tests**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass, tsc clean.

- [ ] **Step 5: Render the figure on all three surfaces**

`src/ui/CapacityBand.tsx`: change the import and the caption, and replace `Cell`:

```ts
import { capacityBreakdown, capacityFigure, computeWeekCapacity, weekFixtureFor } from '../domain/capacity'
```

```tsx
        <span className="t">Week capacity · own + rental / demand</span>
```

```tsx
function Cell({ capacity }: { capacity: DayCapacity }) {
  const short = capacity.shortfall > 0
  const spare = capacity.available > capacity.demand
  return (
    <div className={`c${short ? ' short' : spare ? ' spare' : ''}`} title={capacityBreakdown(capacity)}>
      <span className="n">{capacityFigure(capacity)}</span>
      {short && <span className="sub">short {capacity.shortfall}</span>}
      {spare && <span className="sub">+{capacity.available - capacity.demand}</span>}
    </div>
  )
}
```

`src/ui/CommitSummary.tsx`: add `import { capacityFigure } from '../domain/capacity'` and, in the forward availability section, replace

```tsx
                    <span className="n">
                      {a.available} / {a.demand}
                    </span>{' '}
                    {a.vehicleClass}
```

with

```tsx
                    <span className="n">{capacityFigure(a)}</span> {a.vehicleClass}
```

`src/ui/DailyConfirmation.tsx`: add `import { capacityFigure } from '../domain/capacity'` and replace

```tsx
            <span className="n">
              {r.available} / {r.demand}
            </span>{' '}
            {r.vehicleClass} assignments covered
```

with

```tsx
            <span className="n">{capacityFigure(r)}</span> {r.vehicleClass} assignments covered
```

- [ ] **Step 6: Type check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add src/domain/types.ts src/domain/capacity.ts src/domain/capacity.test.ts \
  src/ui/CapacityBand.tsx src/ui/CommitSummary.tsx src/ui/DailyConfirmation.tsx
git commit -m "feat: render capacity as own + rental / demand, with the breakdown in the cell tooltip"
```

---

### Task 9: `To decide` group, amber tone, and the collapsed chip

**Files:**
- Modify: `src/ui/grouping.ts`
- Modify: `src/ui/ItemCard.tsx` (`dispositionLabel`)
- Modify: `src/ui/PlanHeader.tsx` (chip class)
- Modify: `src/ui/DecisionQueue.tsx` (group title class)
- Modify: `src/ui/theme.css`
- Test: `src/ui/grouping.test.ts`

**Interfaces:**
- Consumes: `isDeferralComplete` from `src/domain/deferral.ts`; `proposedDecisions` (Task 1).
- Produces: `BlockerChip.tone: 'crit' | 'warn'`; `classifyItem` returns `'open'` for any undecided or incomplete item without a hard blocker; `GROUP_LABELS.open === 'To decide'`.

- [ ] **Step 1: Write the failing tests**

Replace the whole of `src/ui/grouping.test.ts` with:

```ts
import { describe, expect, it } from 'vitest'
import { fixture } from '../domain/fixture'
import { proposedDecisions } from '../domain/testSupport'
import { validatePlan } from '../domain/validation'
import type { DraftDecision } from '../domain/types'
import { activeWeekId, draftFor, initialState, queueFor } from '../state/planReducer'
import { blockerChips, classifyItem, groupQueue } from './grouping'

const state = initialState(fixture)
const weekId = activeWeekId(state)
const entries = queueFor({ fixture, state, weekId })
const items = entries.map((e) => e.item)
const idOf = (vehicleId: string) => items.find((i) => i.vehicleId === vehicleId)!.id

describe('groupQueue at the true cold open', () => {
  const decisions = draftFor({ fixture, state, weekId })
  const blockers = validatePlan({ fixture, weekId, decisions })
  const groups = groupQueue({ items, decisions, blockers, fixture })

  it('renders one To decide group holding every item, in queue order', () => {
    expect(groups.map((g) => [g.kind, g.label])).toEqual([['open', 'To decide']])
    expect(groups[0].items.map((i) => i.vehicleId)).toEqual(['V-012', 'V-027', 'V-103', 'V-118', 'V-041'])
  })

  it('collapses the five undecided items into one amber chip that selects the first of them', () => {
    const chips = blockerChips({ blockers, items, decisions, fixture })
    expect(chips).toEqual([
      { key: 'undisposed-all', label: '5 to decide', targetItemId: idOf('V-012'), tone: 'warn' },
    ])
  })
})

describe('groupQueue with every proposal adopted', () => {
  const decisions = proposedDecisions()
  const blockers = validatePlan({ fixture, weekId, decisions })
  const groups = groupQueue({ items, decisions, blockers, fixture })

  it('renders blocking, then to decide, then settled', () => {
    expect(groups.map((g) => g.kind)).toEqual(['blocking', 'open', 'settled'])
    expect(groups.map((g) => g.label)).toEqual(['Blocking the week', 'To decide', 'Settled'])
  })

  it('blocks only the two vans whose Tuesday visits cause the shortfall', () => {
    expect(groups[0].items.map((i) => i.vehicleId)).toEqual(['V-103', 'V-118'])
  })

  it('leaves the slotless specialist proposal to decide, not blocking', () => {
    expect(groups[1].items.map((i) => i.vehicleId)).toEqual(['V-041'])
  })

  it('settles the booked hard stop and the watched item', () => {
    // V-012 is held, so the Tue shortfall is not attributed to it. [S 4.5]
    expect(groups[2].items.map((i) => i.vehicleId)).toEqual(['V-012', 'V-027'])
  })

  it('renders one chip per blocker, a single undecided item by name', () => {
    const chips = blockerChips({ blockers, items, decisions, fixture })
    expect(chips.map((c) => [c.label, c.tone])).toEqual([
      ['V-041 · no decision', 'warn'],
      ['Tue 29 Sep · standard short 1', 'crit'],
    ])
    expect(chips[0].targetItemId).toBe(idOf('V-041'))
    expect(chips[1].targetItemId).toBe(idOf('V-103'))
  })
})

describe('groupQueue once the week is clear', () => {
  const decisions = proposedDecisions()
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
    // Moving V-118 to Thursday clears the Tuesday shortfall.
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
  const v041 = items.find((i) => i.vehicleId === 'V-041')!
  const v118 = items.find((i) => i.vehicleId === 'V-118')!

  it('reads an undecided item as open even though validation blocks the commit on it', () => {
    const blockers = [{ kind: 'undisposed-item' as const, itemId: v041.id }]
    expect(classifyItem({ item: v041, decision: undefined, blockers, fixture })).toBe('open')
  })

  it('reads a visit treatment without a slot, and a watch without a record, as open', () => {
    const noSlot: DraftDecision = { itemId: v118.id, treatment: 'act-now', slotDate: null, deferral: null }
    const noRecord: DraftDecision = { itemId: v118.id, treatment: 'watch', slotDate: null, deferral: null }
    expect(classifyItem({ item: v118, decision: noSlot, blockers: [], fixture })).toBe('open')
    expect(classifyItem({ item: v118, decision: noRecord, blockers: [], fixture })).toBe('open')
  })

  it('reads a hard blocker as blocking whatever the decision says', () => {
    const blockers = [
      {
        kind: 'capacity-shortfall' as const,
        date: '2026-09-29',
        vehicleClass: 'standard' as const,
        shortBy: 1,
        contributors: ['V-118'],
      },
    ]
    const booked: DraftDecision = { itemId: v118.id, treatment: 'act-now', slotDate: '2026-09-29', deferral: null }
    expect(classifyItem({ item: v118, decision: booked, blockers, fixture })).toBe('blocking')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ui/grouping.test.ts`
Expected: FAIL. The cold open renders one `blocking` group and five chips; the adopted scenario renders two groups with V-041 in `blocking`; chips have no `tone`.

- [ ] **Step 3: Rewrite the classifier and the chips**

Replace `src/ui/grouping.ts` with:

```ts
import { formatDay } from '../domain/clock'
import { isDeferralComplete } from '../domain/deferral'
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

type UndisposedBlocker = Extract<Blocker, { kind: 'undisposed-item' }>

/**
 * Only a capacity, slot or parts blocker makes an item "blocking". An item
 * with no decision, a watch without its record, or a visit treatment without
 * a slot is "open": work still to do, in the dashboard's amber, not a failure
 * in red. Validation is unchanged, so an open item still blocks Commit; this
 * is the third group the declutter spec reserved. [D §4, scenario spec §4]
 */
export function classifyItem(args: {
  item: OpenItem
  decision: DraftDecision | undefined
  blockers: Blocker[]
  fixture: Fixture
}): QueueGroupKind {
  const { item, decision, blockers, fixture } = args
  const hard = blockersForItem(blockers, item, fixture).filter((b) => b.kind !== 'undisposed-item')
  if (hard.length > 0) return 'blocking'
  if (!decision || decision.treatment === null) return 'open'
  if (decision.treatment === 'watch') return isDeferralComplete(decision.deferral) ? 'settled' : 'open'
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
  /** crit for a hard blocker, warn for a decision still waiting. */
  tone: 'crit' | 'warn'
}

/**
 * One chip per hard blocker, in the order validatePlan produced them. A
 * capacity blocker targets the first item in queue order it is attributed to,
 * which excludes held vehicles the same way the tiles do. Two or more
 * undecided items collapse into one amber chip, in the position of the first
 * of them, targeting the first undecided item in queue order; a single one
 * keeps its own name. [D §5, scenario spec §4]
 */
export function blockerChips(args: {
  blockers: Blocker[]
  items: OpenItem[]
  decisions: Record<ItemId, DraftDecision>
  fixture: Fixture
}): BlockerChip[] {
  const { blockers, fixture } = args
  const ordered = orderQueue(args)
  const undisposed = blockers.filter((b): b is UndisposedBlocker => b.kind === 'undisposed-item')
  const out: BlockerChip[] = []
  let collapsed = false

  for (const b of blockers) {
    if (b.kind === 'undisposed-item') {
      if (undisposed.length === 1) {
        out.push(itemChip(b, 'no decision', 'warn', fixture))
      } else if (!collapsed) {
        collapsed = true
        const target = ordered.find((item) => undisposed.some((u) => u.itemId === item.id)) ?? null
        out.push({
          key: 'undisposed-all',
          label: `${undisposed.length} to decide`,
          targetItemId: target === null ? null : target.id,
          tone: 'warn',
        })
      }
      continue
    }
    if (b.kind === 'capacity-shortfall') {
      const target =
        ordered.find((item) => blockersForItem(blockers, item, fixture).includes(b)) ?? null
      out.push({
        key: `capacity-${b.date}-${b.vehicleClass}`,
        label: `${formatDay(b.date)} · ${b.vehicleClass} short ${b.shortBy}`,
        targetItemId: target === null ? null : target.id,
        tone: 'crit',
      })
      continue
    }
    out.push(itemChip(b, b.kind === 'parts-not-ready' ? 'parts not ready' : 'slot not bookable', 'crit', fixture))
  }
  return out
}

function itemChip(
  b: Extract<Blocker, { itemId: ItemId }>,
  reason: string,
  tone: 'crit' | 'warn',
  fixture: Fixture,
): BlockerChip {
  const vehicleId = fixture.items.find((i) => i.id === b.itemId)?.vehicleId ?? b.itemId
  return { key: `${b.kind}-${b.itemId}`, label: `${vehicleId} · ${reason}`, targetItemId: b.itemId, tone }
}
```

- [ ] **Step 4: Run the grouping tests**

Run: `npx vitest run src/ui/grouping.test.ts`
Expected: PASS.

- [ ] **Step 5: Carry the tone into the card, the chip and the group title**

`src/ui/ItemCard.tsx`, in `dispositionLabel`, change the three waiting states to the amber tone:

```ts
  if (!decision || decision.treatment === null) return { text: 'No decision', tone: 'warn' }
  if (decision.treatment === 'watch') {
    return decision.deferral === null
      ? { text: 'Watch, incomplete', tone: 'warn' }
      : { text: `Watch until ${formatDay(decision.deferral.reviewDate)}`, tone: '' }
  }
  if (decision.slotDate === null) return { text: 'No slot chosen', tone: 'warn' }
```

and update the comment above it: `/** Status copy per [D §3]; the waiting states take the dashboard's amber [scenario spec §4]. The weekday is the first token of formatDay. */`

`src/ui/PlanHeader.tsx`: the chip button's class becomes

```tsx
              className={`bchip ${chip.tone}`}
```

`src/ui/DecisionQueue.tsx`: the group title's class becomes

```tsx
          <p className={`grouptitle${group.kind === 'blocking' ? ' crit' : group.kind === 'open' ? ' warn' : ''}`}>
```

`src/ui/theme.css`: after `.planheader .bchip .dot { … }` add

```css
.planheader .bchip.warn { color: var(--warn); background: var(--warn-soft); border-color: #ead4a8; }
.planheader .bchip.warn .dot { background: var(--warn); }
```

after `.grouptitle.crit { color: var(--crit); }` add

```css
.grouptitle.warn { color: var(--warn); }
```

after `.card.blocking { border-left-color: var(--crit); }` add

```css
.card.open { border-left-color: var(--warn); }
```

and after `.card .status.crit { color: var(--crit); }` add

```css
.card .status.warn { color: var(--warn); }
```

- [ ] **Step 6: Type check, build, full suite**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all clean.

- [ ] **Step 7: Commit**

```bash
git add src/ui/grouping.ts src/ui/grouping.test.ts src/ui/ItemCard.tsx src/ui/PlanHeader.tsx src/ui/DecisionQueue.tsx src/ui/theme.css
git commit -m "feat: undecided items form a To decide group in amber, with one collapsed header chip"
```

---

### Task 10: The detail pane adopts proposals and gates the booking control; the dashboard loses it

**Files:**
- Modify: `src/ui/TreatmentForm.tsx`
- Modify: `src/ui/AssumptionBlock.tsx`
- Modify: `src/ui/ItemDetail.tsx`
- Modify: `src/ui/ReplacementBookingControl.tsx`
- Modify: `src/ui/InspectPopover.tsx`
- Modify: `src/ui/FleetView.tsx`
- Modify: `src/ui/theme.css`

**Interfaces:**
- Consumes: `adoptProposal` (Task 1), `visitsFromDecisions` (Task 3), `bookingsForVisits` (Task 4), `recommendationFor(item, requestedCoverCostEur)` (Task 5), `bookingsFor` from `src/state/planReducer.ts`.
- Produces: `TreatmentForm` gains a required prop `proposedAction: string`. `ReplacementBookingControl` gains required props `appliedVisit: Visit | null` and `watched: boolean`, and is mounted only by `ItemDetail`.

This task is UI only; the domain and state layers were pinned in Tasks 1 to 9. Verification is `tsc`, the build, and the live checks at the end of this task.

- [ ] **Step 1: Move the proposal line into the Treatment block, with `Use proposal`**

Replace `src/ui/TreatmentForm.tsx` with:

```tsx
import { useState } from 'react'
import { deferralErrors } from '../domain/deferral'
import { adoptProposal, watchAvailable, watchUnavailableReason } from '../domain/recommendation'
import type { Deferral, DraftDecision, OpenItem, TreatmentKind, Vehicle } from '../domain/types'

const TREATMENTS: Array<{ kind: TreatmentKind; label: string }> = [
  { kind: 'act-now', label: 'Act now' },
  { kind: 'bundle', label: 'Bundle' },
  { kind: 'watch', label: 'Watch' },
]

export function TreatmentForm({
  item,
  vehicle,
  decision,
  proposedAction,
  onChange,
  onApply,
}: {
  item: OpenItem
  vehicle: Vehicle
  decision: DraftDecision
  /** The recommendation's wording of the proposal, shown beside Use proposal. */
  proposedAction: string
  onChange: (d: DraftDecision) => void
  onApply: (d: DraftDecision) => void
}) {
  const allowWatch = watchAvailable(item, vehicle)
  const [draft, setDraft] = useState<Partial<Deferral>>(decision.deferral ?? {})
  const errors = deferralErrors(draft)
  const needsDeferral = decision.treatment === 'watch'
  // A treatment is required: with the backlog opening undecided, a slot can
  // be picked before a treatment exists, and that is not a decision.
  // [scenario spec §3.3]
  const canApply =
    decision.treatment !== null && (needsDeferral ? errors.length === 0 : decision.slotDate !== null)
  // Two forms can be mounted for two items, so control ids carry the item id.
  const fieldId = (name: string) => `${item.id}-${name}`

  // The proposal is the system's; adopting it is the user's act, staged like
  // any other edit and settled only by Apply to draft. [scenario spec §3.2]
  const proposal = adoptProposal(item)
  const proposalAllowed = proposal.treatment === 'act-now' || allowWatch

  function useProposal() {
    if (!proposalAllowed) return
    setDraft(proposal.deferral ?? {})
    onChange(proposal)
  }

  function pick(kind: TreatmentKind) {
    if (kind !== 'act-now' && !allowWatch) return
    // A slot belongs to a visit and a deferral belongs to a watch, so leaving
    // either treatment drops the field the other one owns.
    onChange({
      ...decision,
      treatment: kind,
      slotDate: kind === 'watch' ? null : decision.slotDate,
      deferral: kind === 'watch' ? decision.deferral : null,
    })
  }

  function apply() {
    if (!canApply) return
    onApply({
      ...decision,
      deferral: needsDeferral ? (draft as Deferral) : null,
    })
  }

  return (
    <div className="block">
      <div className="blocktitle">Treatment</div>
      <p className="proposed">
        <span>
          <strong>Proposed:</strong> {proposedAction}
        </span>
        <button
          className="ghost"
          disabled={!proposalAllowed}
          title={proposalAllowed ? undefined : watchUnavailableReason()}
          onClick={useProposal}
        >
          Use proposal
        </button>
      </p>
      <div className="treat">
        {TREATMENTS.map((t) => (
          <button
            key={t.kind}
            className={decision.treatment === t.kind ? 'on' : ''}
            disabled={t.kind !== 'act-now' && !allowWatch}
            onClick={() => pick(t.kind)}
            title={t.kind !== 'act-now' && !allowWatch ? watchUnavailableReason() : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!allowWatch && <div className="blockedreason">{watchUnavailableReason()}</div>}

      {needsDeferral && (
        <>
          <div className="field">
            <label htmlFor={fieldId('rationale')}>
              Rationale <span className="req">required</span>
            </label>
            <textarea
              id={fieldId('rationale')}
              value={draft.reason ?? ''}
              onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
              placeholder="Why is waiting defensible on this evidence?"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="field">
              <label htmlFor={fieldId('review-date')}>
                Review date <span className="req">required</span>
              </label>
              <input
                id={fieldId('review-date')}
                type="date"
                value={draft.reviewDate ?? ''}
                onChange={(e) => setDraft({ ...draft, reviewDate: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor={fieldId('trigger')}>
                Trigger <span className="req">required</span>
              </label>
              <select
                id={fieldId('trigger')}
                value={draft.trigger?.label ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    // The label is the option key and the triggers are the
                    // item's own, so the full Trigger is stored, odometer
                    // thresholds included.
                    trigger: item.triggerOptions.find((t) => t.label === e.target.value),
                  })
                }
              >
                <option value="">Choose a trigger</option>
                {item.triggerOptions.map((t) => (
                  <option key={t.label} value={t.label}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {errors.length > 0 && <div className="missing">Missing: {errors.join('. ')}.</div>}
        </>
      )}

      <div className="actions">
        <button className="primary" onClick={apply} disabled={!canApply}>
          Apply to draft
        </button>
      </div>
    </div>
  )
}
```

Replace `src/ui/AssumptionBlock.tsx` with (the `Proposed:` paragraph moves to the Treatment block):

```tsx
import type { RecommendationView } from '../domain/recommendation'

export function AssumptionBlock({ recommendation }: { recommendation: RecommendationView }) {
  return (
    <div className="block">
      <div className="blocktitle">Assumption in play</div>
      {recommendation.assumption === null ? (
        <p>
          No assumption supports a waiting period here. The evidence establishes that something is
          wrong, not how long it can wait, so the proposed action is to assess rather than to predict.
        </p>
      ) : (
        <p>{recommendation.assumption}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Gate the slot picker and the booking control in `ItemDetail`**

Replace `src/ui/ItemDetail.tsx` with:

```tsx
import { useEffect, useState } from 'react'
import { formatDay } from '../domain/clock'
import { recommendationFor } from '../domain/recommendation'
import { bookingCostEur, bookingsForVisits } from '../domain/replacementBooking'
import { urgencyLabel } from '../domain/urgency'
import { visitsFromDecisions } from '../domain/visits'
import type { DraftDecision, ItemId, OpenItem } from '../domain/types'
import { usePlan } from '../state/PlanProvider'
import { activeWeekId, bookingsFor, queueFor } from '../state/planReducer'
import { AssumptionBlock } from './AssumptionBlock'
import { ConsequenceBlock } from './ConsequenceBlock'
import { EvidenceBlock } from './EvidenceBlock'
import { ReplacementBookingControl } from './ReplacementBookingControl'
import { SlotPicker } from './SlotPicker'
import { TreatmentForm } from './TreatmentForm'

export function ItemDetail({
  item,
  decisions,
  onApply,
  onPendingChange,
}: {
  item: OpenItem
  decisions: Record<ItemId, DraftDecision>
  onApply: (d: DraftDecision) => void
  onPendingChange: (d: DraftDecision) => void
}) {
  const { state, fixture } = usePlan()
  const weekId = activeWeekId(state)
  const vehicle = fixture.vehicles.find((v) => v.id === item.vehicleId)!
  const entry = queueFor({ fixture, state, weekId }).find((e) => e.item.id === item.id)
  // The applied decision, as the plan holds it. The staged one lives below.
  const applied = decisions[item.id] ?? {
    itemId: item.id,
    treatment: null,
    slotDate: null,
    deferral: null,
  }
  // A replacement belongs to an applied visit, so both the control and the
  // Consequence tile's cover figure read the applied draft, never the staged
  // one. [scenario spec §5.1, §5.5]
  const draftVisits = visitsFromDecisions(decisions, fixture.items)
  const appliedVisit = draftVisits.find((v) => v.itemId === item.id) ?? null
  const booking = bookingsForVisits(bookingsFor({ state, weekId }), draftVisits)[item.vehicleId] ?? null
  const recommendation = recommendationFor(
    item,
    booking === null ? null : bookingCostEur(booking, fixture.replacementDayRateEur),
  )
  // App.tsx remounts this component via key={item.id}, so switching items
  // always reseeds from the applied decision and discards whatever was
  // staged here but never applied.
  const [decision, setDecision] = useState<DraftDecision>(applied)

  useEffect(() => {
    onPendingChange(decision)
  }, [decision, onPendingChange])

  const stagingVisit = decision.treatment === 'act-now' || decision.treatment === 'bundle'

  return (
    <div className="detail">
      <div className="head">
        <span className="vid" style={{ fontSize: 15 }}>
          {item.vehicleId}
        </span>
        <span className={`urg ${item.urgency.kind}`}>{urgencyLabel(item.urgency.kind)}</span>
        {vehicle.vehicleClass === 'specialist' && <span className="badge specialist">Specialist</span>}
      </div>
      <div className="sub">
        {item.title} · {vehicle.vehicleClass} class
      </div>
      <div className="because">{item.urgency.because}</div>
      {entry !== undefined && entry.priorDecision !== null && (
        <div className="because">
          Previously: watch, decided {formatDay(entry.priorDecision.decidedOn)}.{' '}
          {entry.priorDecision.deferral.reason}
        </div>
      )}

      <EvidenceBlock recommendation={recommendation} />
      <AssumptionBlock recommendation={recommendation} />
      <ConsequenceBlock recommendation={recommendation} />

      <TreatmentForm
        item={item}
        vehicle={vehicle}
        decision={decision}
        proposedAction={recommendation.proposedAction}
        onChange={setDecision}
        onApply={onApply}
      />

      {stagingVisit && (
        <SlotPicker
          item={item}
          decisions={decisions}
          selectedDate={decision.slotDate}
          onPick={(date) => setDecision({ ...decision, slotDate: date })}
        />
      )}

      <ReplacementBookingControl
        key={item.vehicleId}
        vehicleId={item.vehicleId}
        vehicleClass={vehicle.vehicleClass}
        appliedVisit={appliedVisit}
        watched={applied.treatment === 'watch'}
      />
    </div>
  )
}
```

Note the order: the Treatment block now sits above the slot picker, because a day is chosen after the treatment that needs one. `App.tsx` needs no change.

- [ ] **Step 3: Give the booking control its gated states and visit defaults**

Replace `src/ui/ReplacementBookingControl.tsx` with:

```tsx
import { useState } from 'react'
import { weekFixtureFor } from '../domain/capacity'
import { formatDay } from '../domain/clock'
import { bookingCostEur, replacementBookingErrors } from '../domain/replacementBooking'
import type { ReplacementBooking, VehicleClass, VehicleId, Visit } from '../domain/types'
import { usePlan } from '../state/PlanProvider'
import { activeWeekId } from '../state/planReducer'

/**
 * A replacement belongs to a visit. Mounted only in the weekly plan's detail
 * pane, and it offers the request only once a visit is applied for this
 * vehicle; the dashboard reports a committed booking as a fact and offers no
 * control. Callers mount it with key={vehicleId}. [scenario spec §5.1, §5.2]
 */
export function ReplacementBookingControl({
  vehicleId,
  vehicleClass,
  appliedVisit,
  watched,
}: {
  vehicleId: VehicleId
  vehicleClass: VehicleClass
  /** The vehicle's applied visit this week, or null when there is none. */
  appliedVisit: Visit | null
  /** True when the item's applied treatment is watch, for the explanatory line. */
  watched: boolean
}) {
  const { state, dispatch, fixture } = usePlan()
  const weekId = activeWeekId(state)
  const week = weekFixtureFor(fixture, weekId)
  const booking = appliedVisit === null ? null : (state.draftBookingsByWeek[weekId]?.[vehicleId] ?? null)
  const [editing, setEditing] = useState(false)
  // Defaults follow the visit: its day, its length. Both stay editable within
  // the week, so a held van can be covered Monday to Friday.
  const defaults = (): Partial<ReplacementBooking> => ({
    vehicleId,
    startDate: appliedVisit?.startDate ?? week.days[0],
    days: appliedVisit?.days ?? 1,
  })
  const [draft, setDraft] = useState<Partial<ReplacementBooking>>(booking ?? defaults())

  if (appliedVisit === null) {
    return (
      <div className="block">
        <div className="blocktitle">Replacement cover</div>
        <div className="bookinginfo">
          {watched ? 'Not needed while this vehicle is watched.' : 'Apply a visit before requesting a replacement.'}
        </div>
      </div>
    )
  }

  if (vehicleClass === 'specialist') {
    return (
      <div className="block">
        <div className="blocktitle">Replacement cover</div>
        <div className="blockedreason">No specialist replacement cover exists.</div>
      </div>
    )
  }

  if (booking && !editing) {
    const cost = bookingCostEur(booking, fixture.replacementDayRateEur)
    return (
      <div className="block">
        <div className="blocktitle">Replacement cover</div>
        <div className="bookinginfo">
          Booked {booking.days} {booking.days === 1 ? 'day' : 'days'} from {formatDay(booking.startDate)} ·
          EUR {cost.toLocaleString('en-GB')}
        </div>
        <div className="actions">
          <button
            className="ghost"
            onClick={() => {
              setDraft(booking)
              setEditing(true)
            }}
          >
            Change
          </button>
          <button className="ghost" onClick={() => dispatch({ type: 'clear-booking', weekId, vehicleId })}>
            Cancel booking
          </button>
        </div>
      </div>
    )
  }

  if (!booking && !editing) {
    return (
      <div className="block">
        <div className="blocktitle">Replacement cover</div>
        <div className="bookinginfo">No replacement requested.</div>
        <div className="actions">
          <button
            className="primary"
            onClick={() => {
              setDraft(defaults())
              setEditing(true)
            }}
          >
            Request replacement
          </button>
        </div>
      </div>
    )
  }

  const errors = replacementBookingErrors(draft, { fixture, weekId })
  const previewDays =
    draft.days !== undefined && draft.days !== null && Number.isInteger(draft.days) && draft.days >= 1
      ? draft.days
      : 0
  const previewCost = bookingCostEur({ ...draft, days: previewDays } as ReplacementBooking, fixture.replacementDayRateEur)
  const fieldId = (name: string) => `${vehicleId}-booking-${name}`

  return (
    <div className="block">
      <div className="blocktitle">Replacement cover</div>
      <div className="field">
        <label htmlFor={fieldId('start')}>Start date</label>
        <select
          id={fieldId('start')}
          value={draft.startDate ?? ''}
          onChange={(e) => setDraft({ ...draft, vehicleId, startDate: e.target.value })}
        >
          <option value="">Choose a day</option>
          {week.days.map((d) => (
            <option key={d} value={d}>
              {formatDay(d)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={fieldId('days')}>Days</label>
        <input
          id={fieldId('days')}
          type="number"
          min={1}
          max={week.days.length}
          step={1}
          value={draft.days ?? 1}
          onChange={(e) => setDraft({ ...draft, vehicleId, days: Number(e.target.value) })}
        />
      </div>
      <div className="bookinginfo">
        Downtime: {previewDays} {previewDays === 1 ? 'day' : 'days'} · EUR {previewCost.toLocaleString('en-GB')}
      </div>
      {errors.length > 0 && <div className="missing">{errors.join('. ')}.</div>}
      <div className="actions">
        <button
          className="primary"
          disabled={errors.length > 0}
          onClick={() => {
            dispatch({ type: 'set-booking', weekId, booking: draft as ReplacementBooking })
            setEditing(false)
          }}
        >
          Request replacement
        </button>
        <button className="ghost" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Remove the control from the dashboard surfaces**

`src/ui/InspectPopover.tsx`: delete the line `import { ReplacementBookingControl } from './ReplacementBookingControl'` and the line `<ReplacementBookingControl key={vehicle.id} vehicleId={vehicle.id} vehicleClass={vehicle.vehicleClass} />`.

`src/ui/FleetView.tsx`: delete the line `import { ReplacementBookingControl } from './ReplacementBookingControl'` and, at the end of `AttentionCard`, the line `<ReplacementBookingControl key={status.vehicleId} vehicleId={status.vehicleId} vehicleClass={status.vehicleClass} />`. The card stays a `<div>` with its `Open in week plan` button.

- [ ] **Step 5: Style the proposal line; drop the card spacing rule**

In `src/ui/theme.css`, replace the three lines

```css
/* Every card now carries the booking control, so every card has some
   interactive content; the hover affordance is no longer conditional on
   being a button. */
```

with

```css
/* Attention cards are read-only apart from their route into the week plan;
   the replacement request lives in the plan's detail pane. [scenario spec §5.1] */
```

delete the line `.acard .block { margin-top: 8px; }`, replace the comment `/* Replacement cover: the shared booking control, mounted per vehicle. */` with `/* Replacement cover: requested only from the weekly plan's detail pane, once a visit is applied. */`, and add after `.block .bookinginfo { … }`:

```css
.block .proposed {
  display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
  font-size: 12px; color: var(--muted); margin: 0 0 9px;
}
.block .proposed button { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 5px; }
.block .proposed button:disabled { opacity: 0.5; }
```

- [ ] **Step 6: Type check, build, full suite**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all clean. `grep -rn ReplacementBookingControl src/ui` lists only `ItemDetail.tsx` and the component itself.

- [ ] **Step 7: Live checks against `npm run dev`**

Start the dev server in the worktree and open the printed URL. Reset from the demo bar first, then confirm each line before ticking it:

1. Fleet today: 1 red, 4 amber, `5 items waiting for week 40`, cost tiles `EUR 0` three times. No `Replacement cover` block on any attention card; open `V-001`'s popover: facts only, no form.
2. Week plan: header chip `5 to decide` in amber, one group `To decide · 5` in the order V-012, V-027, V-103, V-118, V-041, band caption `own + rental / demand`, cells `37 + 1 / 38` Mon, Wed, Fri and `37 + 2 / 38` with `+1` and a green outline on Tue and Thu, specialist `7 / 7`. Hover Thursday's standard cell: tooltip `38 owned · off the road: V-012 · rentals on site: R-1, R-2`.
3. Open `V-012`: Treatment block shows `Proposed: Book a visit: Tue 29 Sep, 1 day.` with `Use proposal`; no treatment selected; no slot picker; Consequence reads `EUR 480` and `not requested`; Replacement cover block reads `Apply a visit before requesting a replacement.` Click `Use proposal`: Act now selected, slot picker appears with Tuesday chosen, band reacts. Click `Apply to draft`: `V-012` moves to `Settled`, the block reads `No replacement requested.` with `Request replacement`.
4. Repeat `Use proposal` and `Apply to draft` on `V-103` and `V-118`. Tuesday's cell turns red at `35 + 2 / 38`, chips read `V-041 · no decision` (amber) and `Tue 29 Sep · standard short 1` (red), groups read `Blocking the week · 2` (V-103, V-118), `To decide · 1` (V-041), `Settled · 2` (V-012, V-027).
5. Open `V-012`, click `Request replacement`: start defaults to Tue 29 Sep, days to 1. Set start Mon 28 Sep, days 5, submit. Consequence reads `EUR 700`; the fleet tab's cost tiles read `EUR 1,440`, `EUR 700`, `EUR 2,140`.
6. Open `V-118`, switch to Watch, fill rationale, review date and trigger, apply: its block reads `Not needed while this vehicle is watched.`; Tuesday clears. Return it to Act now on Thursday and apply.
7. Open `V-041`: `Use proposal` selects Act now with no slot and Apply stays disabled; choose Thursday and apply; the specialist row breaks. Switch to Watch, fill the deferral, apply. Commit.
8. Commit summary: forward availability cells read `own + rental / demand`; Tuesday standard reads `36 + 3 / 38`. Fleet today: `V-012`'s red card reads `Held · … · Booked Tue 29 Sep · Replacement on site · day 1 of 5`. Advance one day: `In workshop · day 1 of 1 · Replacement on site · day 2 of 5`.

Stop the dev server when done.

- [ ] **Step 8: Commit**

```bash
git add src/ui/TreatmentForm.tsx src/ui/AssumptionBlock.tsx src/ui/ItemDetail.tsx \
  src/ui/ReplacementBookingControl.tsx src/ui/InspectPopover.tsx src/ui/FleetView.tsx src/ui/theme.css
git commit -m "feat: Use proposal in the detail pane, a visit-gated replacement control, and no request control on the dashboard"
```

---

### Task 11: Documentation, spec amendments, and the final verification pass

**Files:**
- Modify: `README.md`
- Modify: `src/ui/coverNoteContent.ts`
- Modify: `docs/superpowers/specs/2026-09-23-cover-note-design.md` (§3.5)
- Modify: `docs/superpowers/specs/2026-09-24-replacement-cover-design.md` (§2, §3.1, §6, §7.1, §12)
- Modify: `docs/superpowers/specs/2026-09-23-fleet-maintenance-prototype-design.md` (§4.5)
- Modify: `docs/superpowers/specs/2026-09-23-guided-queue-declutter-design.md` (§4)
- Modify: `docs/superpowers/specs/2026-09-23-fleet-overview-design.md` (§4, §6)
- Modify: `docs/acceptance.md`

**Interfaces:** none. Every amendment is a dated paragraph in place, in the convention the cover-note spec already uses, pointing at the scenario spec.

- [ ] **Step 1: Run the full verification and note the test count**

Run: `npx vitest run 2>&1 | tail -6 && npx tsc --noEmit && npm run build`
Expected: all clean. The line `Tests  N passed (N)` gives the count used in Steps 2 and 9; the line `Test Files  M passed (M)` gives the file count (17, once `visits.test.ts` exists).

- [ ] **Step 2: README**

In `README.md`, under **Running it**, replace

```
npm test        # 252 tests over the domain and state layers, including the ten
                # verification scenarios end to end
```

with the same two lines carrying the count from Step 1 in place of `252`.

Replace the first three numbered items of **The five-minute walkthrough** with the following four, and renumber the remaining items 5 to 9:

```
1. The app opens on **Fleet today**: 45 vans at a glance, one already off the road and four more
   needing a decision. Nothing is planned yet, so every day reads covered. Click any quiet van to
   inspect it.
2. Switch to the week plan. Week 40 opens with five decisions and none taken: every item carries the
   system's proposal, and the band reads own vans plus rentals against demand, `37 + 2 / 38` on
   Tuesday and Thursday. `V-012` is already out of service, before anything is committed.
3. Open `V-012`, `V-103` and `V-118` in turn, click **Use proposal**, then **Apply to draft**. All
   three land on Tuesday and the band turns Tuesday red: three vans off the road, two rentals. Open
   `V-118` again, switch the slot to Thursday and watch Tuesday clear. Try Wednesday instead to see
   the shortage land there rather than disappear.
4. Open `V-012` once more and request a replacement for five days from Monday. Its Consequence tile
   moves from `not requested` to EUR 700, and the fleet dashboard's weekly cost with it.
```

In the renumbered item 8 (formerly 7, "Commit."), append one sentence: `On the fleet dashboard, V-012's card now also reads Replacement on site · day 1 of 5.`

Under **Decisions taken**, add this bullet directly after the **Disruption stays apart; spend does not.** bullet:

```
- **The system proposes, the user decides.** Every item opens undecided. The proposal is one click
  away and never adopted for you. A replacement is a consequence of a visit you have applied, never
  a freestanding purchase, and cover cost exists only where cover was requested: the pre-confirmed
  rentals R-1 and R-2 are inputs, not spend against the week's budget
  (`docs/superpowers/specs/2026-09-24-scenario-and-cover-accounting-fixes-design.md`).
```

Under **Where the thinking lives**, add after the replacement-cover line:

```
- `docs/superpowers/specs/2026-09-24-scenario-and-cover-accounting-fixes-design.md`: the undecided
  backlog, visit-bound replacement cover, and the own-plus-rental capacity figures
```

- [ ] **Step 3: The in-app cover note and its source spec**

In `src/ui/coverNoteContent.ts`, inside the `what-you-will-see` block, replace the third paragraph string (the one beginning `'Two things block the week.`) with:

```ts
        'Five decisions wait, and none is taken for you. Each carries the system\'s proposal; adopt it or choose differently. Take the three Tuesday proposals as they come and Tuesday goes one van short, because three standard vans would be off the road at once and the rental cover only stretches to two of them: moving one visit clears it. V-041, the only specialist van in the queue, has no proposed day at all. No specialist cover exists this week, so scheduling it leaves an assignment uncovered that nothing available can fill.',
```

and replace the fifth paragraph string (`'The plan cannot be committed until the blockers are cleared. That is deliberate.'`) with:

```ts
        'The plan cannot be committed until every item is decided and the blockers are cleared. That is deliberate.',
```

Add a fourth copy-fidelity note to the file's header comment, after the third:

```
 * - The "What you are about to see" block follows section 3.5 as amended on
 *   2026-09-24 for the scenario and cover accounting fixes: the backlog opens
 *   undecided, so the third paragraph no longer claims Tuesday is short at
 *   cold open. Re-syncing against the unamended block would reinstate that
 *   now-false claim.
```

In `docs/superpowers/specs/2026-09-23-cover-note-design.md` §3.5, replace the third blockquote paragraph (beginning `> Two things block the week.`) with:

```
> Five decisions wait, and none is taken for you. Each carries the system's proposal; adopt it or
> choose differently. Take the three Tuesday proposals as they come and Tuesday goes one van short,
> because three standard vans would be off the road at once and the rental cover only stretches to
> two of them: moving one visit clears it. `V-041`, the only specialist van in the queue, has no
> proposed day at all. No specialist cover exists this week, so scheduling it leaves an assignment
> uncovered that nothing available can fill.
```

replace the fifth blockquote line with

```
> The plan cannot be committed until every item is decided and the blockers are cleared. That is
> deliberate.
```

and append to the **Implementation note** paragraph:

```
**Amended 2026-09-24 for the scenario and cover accounting fixes**
(`docs/superpowers/specs/2026-09-24-scenario-and-cover-accounting-fixes-design.md` §3, §12): the
backlog opens undecided, so the block no longer claims that Tuesday is short before the user acts.
The Tuesday shortfall appears once the three Tuesday proposals are adopted, and the copy says so.
```

- [ ] **Step 4: The replacement cover spec**

In `docs/superpowers/specs/2026-09-24-replacement-cover-design.md`:

After the **It is** paragraph in §2, insert:

```
**Amended 2026-09-24** (`2026-09-24-scenario-and-cover-accounting-fixes-design.md` §5, §6). A
booking is no longer freestanding: it belongs to an applied visit, is requested only from the weekly
plan's detail pane once that visit is applied, and is removed when the visit goes. The dashboard
shows a committed booking as a fact about the van and offers no request control.
```

After the paragraph in §3.1 beginning `Proposed **EUR 3,000 for week 40's`, insert:

```
**Amended 2026-09-24** (scenario spec §5.5, §5.6). The item-level `coverCostEur` this figure relied
on is deleted. EUR 2,420 is what the walkthrough costs if the user requests five days of cover for
`V-012` and one day each for `V-103` and `V-118`; nothing is charged automatically, and R-1 and R-2
never enter the total.
```

After the §6 table, insert:

```
**Amended 2026-09-24** (scenario spec §5.1, §5.2). The first two rows, the fleet grid and attention
card surfaces, are superseded: the control is mounted only in `ItemDetail`, and only once a visit is
applied. Its states are the scenario spec's §5.2 table.
```

After the numbered list in §7.1, insert:

```
**Amended 2026-09-24** (scenario spec §5.1). Mount points 1 and 2 are removed; only 3 remains,
gated on an applied visit.
```

Add a final row to the §12 table:

```
| A request control on the dashboard or in the popover | Superseded 2026-09-24: the dashboard reports a committed booking as a fact (scenario spec §6) |
```

- [ ] **Step 5: The prototype, declutter and fleet-overview specs**

`docs/superpowers/specs/2026-09-23-fleet-maintenance-prototype-design.md`, in §4.5, directly after the line `Cold open, after the system proposals and before any user action:`, insert:

```
**Amended 2026-09-24** (`2026-09-24-scenario-and-cover-accounting-fixes-design.md` §3). The backlog
now opens undecided, so this table describes the week after every proposal has been adopted with
**Use proposal**, not the cold open. At the true cold open no visit is planned, every day is met, and
Tuesday and Thursday each carry one spare, which the band renders as `37 + 2 / 38`.
```

`docs/superpowers/specs/2026-09-23-guided-queue-declutter-design.md`, in §4, directly after the paragraph beginning `A third state, decided-incomplete-but-not-blocking, cannot occur`, insert:

```
**Amended 2026-09-24** (`2026-09-24-scenario-and-cover-accounting-fixes-design.md` §4). The third
state now occurs. An undecided or incomplete item is `To decide`, in the dashboard's amber, and only
capacity, slot and parts blockers make an item `Blocking the week`. Two or more undecided items
collapse into one amber header chip, `n to decide`. Validation is unchanged: an undecided item still
blocks Commit.
```

`docs/superpowers/specs/2026-09-23-fleet-overview-design.md`, in §4, directly after the **3. In service (green)** paragraph, insert:

```
**Amended 2026-09-24** (`2026-09-24-scenario-and-cover-accounting-fixes-design.md` §6). Two more
committed-state sub-labels, shown on red and green vans alike: `Replacement on site · day n of m`
while a committed booking runs, and `Replacement booked <day> · m days` before it starts. A draft
request produces no sub-label; the dashboard reports what has been committed.
```

and in §6, after the paragraph beginning `Content, all straight from the fixture`, insert:

```
**Amended 2026-09-24** (scenario spec §5.1). The popover carries no replacement request control. One
was mounted here by the replacement cover feature and removed by the scenario and cover accounting
fixes; the popover is read-only again, as first specified.
```

- [ ] **Step 6: The acceptance addendum**

Append to `docs/acceptance.md`, replacing `N` and `M` with the counts from Step 1:

```
## Addendum: scenario and cover accounting fixes (2026-09-24)

**Commands:** `npm test` (N tests, M files, all passing), `npx tsc --noEmit` (clean), `npm run build`
(clean), plus the live browser pass listed in the plan's Task 10.

**What changed, against `docs/superpowers/specs/2026-09-24-scenario-and-cover-accounting-fixes-design.md`.**
The backlog opens undecided: every item is seeded open and the system's proposal is adopted only
through **Use proposal**, then `Apply to draft`. A replacement booking belongs to an applied visit:
the reducer prunes bookings to visiting vehicles, `set-booking` ignores a vehicle without a visit,
and every reader filters through `bookingsForVisits`. The hand-authored item-level cover cost is
gone; the Consequence tile reads `not requested` until a booking exists, and the weekly total charges
service cost for visited items plus requested cover only. The dashboard shows a committed booking as
`Replacement on site · day n of m` or `Replacement booked <day> · m days`, and offers no request
control. Capacity cells read `own + rental / demand`. The persisted version moved to 2, so a browser
holding the old seeded drafts resets to the seed with the older-build notice.

**Live pass.** Cold open: one red, four amber, five to decide, cost tiles at EUR 0, no request
control on any dashboard surface, band cells `37 + 1 / 38` and `37 + 2 / 38` with Tuesday and
Thursday outlined green. Adopting the three Tuesday proposals turned Tuesday red at `35 + 2 / 38`
with chips `V-041 · no decision` and `Tue 29 Sep · standard short 1`. Requesting five days of cover
for `V-012` moved its Consequence tile from `not requested` to `EUR 700` and the dashboard tiles to
EUR 1,440, EUR 700, EUR 2,140. Switching `V-118` to Watch removed its booking and cost. After the
walkthrough commit, `V-012`'s red card read `Replacement on site · day 1 of 5`, and `day 2 of 5`
on Tuesday.

**Claims corrected elsewhere.** G1's cold-open evidence (the band flagging Tuesday) now applies
after adoption, not before; at the true cold open the queue reads `V-012, V-027, V-103, V-118,
V-041`, and once every proposal is adopted the earlier order returns. The cover note's third
"What you are about to see" paragraph, its source spec, the README walkthrough and four specs carry
dated amendments. The Codex attempt at the same fixes, reverted before any commit, is preserved as
`.superpowers/sdd/codex-fleet-scenario-fixes-2026-09-24.patch` for reference only.
```

- [ ] **Step 7: Scan the docs for stale claims**

Run:

```bash
grep -rn -E 'Two things block the week|coverCostEur|available / demand|three cost figures stay apart' README.md src docs/superpowers/specs docs/acceptance.md | grep -v 'Amended\|superseded\|now-false\|no longer'
```

Expected: no output. Any hit is a claim this task should have amended.

- [ ] **Step 8: Verify once more**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all clean, with the same count as Step 1.

- [ ] **Step 9: Commit**

```bash
git add README.md src/ui/coverNoteContent.ts docs/acceptance.md \
  docs/superpowers/specs/2026-09-23-cover-note-design.md \
  docs/superpowers/specs/2026-09-24-replacement-cover-design.md \
  docs/superpowers/specs/2026-09-23-fleet-maintenance-prototype-design.md \
  docs/superpowers/specs/2026-09-23-guided-queue-declutter-design.md \
  docs/superpowers/specs/2026-09-23-fleet-overview-design.md
git commit -m "docs: record the undecided backlog, visit-bound cover and own-plus-rental figures across the README, cover note, specs and acceptance"
```

Then hand the branch to `superpowers:finishing-a-development-branch`.
