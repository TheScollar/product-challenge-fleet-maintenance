# No Pool Cover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every pre-confirmed rental, let a held van carry a requested replacement, add named light days, and bring the suite back to green against the hand-derived capacity table.

**Architecture:** Pure domain changes first (fixture, demand, booking eligibility), then the reducer and persistence, then one new UI panel reached from shortfall chips, then test reconciliation, then copy and docs. Every capacity, cost and summary reader goes through one eligibility predicate, `eligibleBookings`.

**Tech Stack:** React 19, TypeScript, Vite, Vitest. `npm test` runs the suite; `npx tsc -b` type-checks; `npm run build` bundles.

**Spec:** `docs/superpowers/specs/2026-09-28-no-pool-cover-design.md`. Its §3 table is the source of truth for every number.

## Global Constraints

- No pool cover: `fixture.covers`, every `WeekFixture.coverIds` and `fixture.defaultCoverIds` are `[]`.
- V-012 `releaseRecordedOn` is `'2026-10-06'`.
- Standard demand is 37 on `2026-10-01`, `2026-10-07`, `2026-10-08`; 38 on every other day. Specialist stays 7.
- Day rate EUR 140. Week 40 walkthrough total is EUR 2,280 against EUR 3,000.
- Persisted `CURRENT_VERSION` is 3.
- Copy: no em dashes in any user-facing string or doc written by this plan.
- Commits: stage exact paths with `git add <path>...`, commit with the CLI, end every message with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Match surrounding code: comment density, `[spec §n]` references, naming.

## File map

| File | Change |
|---|---|
| `src/domain/types.ts` | `WeekFixture.demandByDay?` |
| `src/domain/fixture.ts` | empty covers, release date, light days |
| `src/domain/capacity.ts` | `demandOn`, comments, breakdown wording |
| `src/domain/replacementBooking.ts` | `eligibleBookings`, `canCarryBooking` replace `bookingsForVisits` |
| `src/domain/validation.ts`, `costs.ts`, `commit.ts`, `fleetStatus.ts` | call `eligibleBookings` |
| `src/state/planReducer.ts` | version 3, reducer guard and pruning via eligibility |
| `src/state/persistence.ts` | `CURRENT_VERSION = 3` |
| `src/ui/grouping.ts` | chip `target` widened to a selection |
| `src/ui/HeldVehiclePanel.tsx` | new |
| `src/ui/ReplacementBookingControl.tsx` | accept a hold as the gate |
| `src/App.tsx`, `PlanHeader.tsx`, `CapacityBand.tsx`, `DecisionQueue.tsx`, `ItemDetail.tsx` | selection type, band cell click, legend |
| `src/ui/coverNoteContent.ts`, `README.md`, `docs/speaker-script.md`, `docs/acceptance.md`, older specs | copy |

---

### Task 1: Fixture without pool cover, with light days

**Files:**
- Modify: `src/domain/types.ts` (`WeekFixture`)
- Modify: `src/domain/fixture.ts:67`, `:370-401`
- Modify: `src/domain/capacity.ts:16-32`, `:95`
- Test: `src/domain/fixture.test.ts`, `src/domain/capacity.test.ts`

**Interfaces:**
- Produces: `WeekFixture.demandByDay?: Record<ISODate, Partial<Demand>>`; `demandOn(week: WeekFixture, date: ISODate, vehicleClass: VehicleClass): number` exported from `capacity.ts`.

- [ ] **Step 1: Write the failing tests** in `src/domain/fixture.test.ts`. Replace the tests `holds V-012 out of service from the seed date` (release date) and `confirms R-1 all week and R-2 on Tuesday and Thursday only`, and add the invariant:

```ts
  it('holds V-012 out of service from the seed date until 6 Oct', () => {
    const v012 = fixture.vehicles.find((v) => v.id === 'V-012')!
    expect(v012.hold).not.toBeNull()
    expect(v012.hold!.since).toBe('2026-09-25')
    expect(v012.hold!.releaseRecordedOn).toBe('2026-10-06')
  })

  it('carries no pool cover in any week or in the default template', () => {
    expect(fixture.covers).toEqual([])
    for (const week of fixture.weeks) expect(week.coverIds).toEqual([])
    expect(fixture.defaultCoverIds).toEqual([])
  })

  it('names only covers that exist', () => {
    const ids = new Set(fixture.covers.map((c) => c.id))
    for (const coverId of [...fixture.weeks.flatMap((w) => w.coverIds), ...fixture.defaultCoverIds]) {
      expect(ids.has(coverId)).toBe(true)
    }
  })

  it('lightens standard demand on Thursday of week 40 and Wednesday and Thursday of week 41', () => {
    expect(fixture.weeks[0].demandByDay).toEqual({ '2026-10-01': { standard: 37 } })
    expect(fixture.weeks[1].demandByDay).toEqual({
      '2026-10-07': { standard: 37 },
      '2026-10-08': { standard: 37 },
    })
  })
```

In `src/domain/capacity.test.ts`, add after the `isHeldOn` describe:

```ts
describe('demandOn reads a day override and falls back to the week', () => {
  it('uses the override for the class it names', () => {
    expect(demandOn(weekFixtureFor(fixture, '2026-09-28'), '2026-10-01', 'standard')).toBe(37)
  })
  it('falls back to week.demand for a class the override omits', () => {
    expect(demandOn(weekFixtureFor(fixture, '2026-09-28'), '2026-10-01', 'specialist')).toBe(7)
  })
  it('falls back to week.demand on a day with no override', () => {
    expect(demandOn(weekFixtureFor(fixture, '2026-09-28'), '2026-09-29', 'standard')).toBe(38)
  })
  it('holds V-012 on every day of week 40 and on Monday of week 41 only', () => {
    const v012 = vehicle('V-012')
    for (const d of ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-05']) {
      expect(isHeldOn(v012, d)).toBe(true)
    }
    for (const d of ['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']) {
      expect(isHeldOn(v012, d)).toBe(false)
    }
  })
})
```

Add `demandOn` to the `./capacity` import at the top of the file.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/domain/fixture.test.ts src/domain/capacity.test.ts`
Expected: the new tests FAIL (`demandOn` is not exported; release date is `2026-10-05`; week 41 names `R-1`).

- [ ] **Step 3: Implement.** In `src/domain/types.ts`:

```ts
export interface WeekFixture {
  weekId: WeekId
  days: ISODate[]
  demand: Demand
  /** Per-day overrides. A day or class not listed uses `demand`. */
  demandByDay?: Record<ISODate, Partial<Demand>>
  coverIds: string[]
  itemIds: ItemId[]
  budgetEur: number
}
```

In `src/domain/fixture.ts`, set `releaseRecordedOn: '2026-10-06'`, and replace the `weeks` and the tail of `fixture`:

```ts
const weeks: WeekFixture[] = [
  {
    weekId: '2026-09-28',
    days: WEEK_40,
    demand: { standard: 38, specialist: 7 },
    // One free standard van on Thursday, so moving a visit is a real lever
    // and not only a relocated shortfall. [no pool cover spec D5]
    demandByDay: { '2026-10-01': { standard: 37 } },
    coverIds: [],
    itemIds: ['item-v012', 'item-v041', 'item-v103', 'item-v118', 'item-v027'],
    budgetEur: 3000,
  },
  {
    weekId: '2026-10-05',
    days: WEEK_41,
    demand: { standard: 38, specialist: 7 },
    demandByDay: { '2026-10-07': { standard: 37 }, '2026-10-08': { standard: 37 } },
    coverIds: [],
    itemIds: ['item-v024', 'item-v105'],
    budgetEur: 3000,
  },
]
```

and `defaultCoverIds: [],`.

In `src/domain/capacity.ts`, replace the `weekFixtureFor` doc comment's "normal demand, R-1 only, and no new items" with "normal demand, no cover, and no new items", add:

```ts
/** A day override wins for the class it names; everything else is the week's. [no pool cover spec D5] */
export function demandOn(week: WeekFixture, date: ISODate, vehicleClass: VehicleClass): number {
  return week.demandByDay?.[date]?.[vehicleClass] ?? week.demand[vehicleClass]
}
```

and in `computeDayCapacity` replace the `const demand = ...` line with `const demand = demandOn(week, date, vehicleClass)`.

- [ ] **Step 4: Run to verify the new tests pass**

Run: `npx vitest run src/domain/fixture.test.ts src/domain/capacity.test.ts -t "demandOn|pool cover|names only covers|lightens|until 6 Oct"`
Expected: PASS. Other tests in these files may still fail; they are reconciled in Task 6.

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc -b
git add src/domain/types.ts src/domain/fixture.ts src/domain/capacity.ts src/domain/fixture.test.ts src/domain/capacity.test.ts
git commit -m "fix: remove all pool cover and add named light days

- empty week 41 and default cover ids, which named a deleted R-1
- restore V-012's release to 6 Oct so the hold carries into week 41
- add per-day demand overrides

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: One booking eligibility predicate

**Files:**
- Modify: `src/domain/replacementBooking.ts:64-80`
- Modify: `src/domain/validation.ts:5,25-26`, `src/domain/costs.ts:2,17-24,43`, `src/domain/commit.ts:3,89,165`, `src/domain/fleetStatus.ts:4,116-123`
- Modify: `src/ui/CapacityBand.tsx:3,22`, `src/ui/ItemDetail.tsx:4,47`
- Test: `src/domain/replacementBooking.test.ts`, `src/domain/costs.test.ts`

**Interfaces:**
- Consumes: `isHeldOn` from `capacity.ts`, `weekFixtureFor`.
- Produces:
  - `canCarryBooking(vehicleId: VehicleId, args: { fixture: Fixture; weekId: WeekId; visits: Visit[] }): boolean`
  - `eligibleBookings(bookings: Record<VehicleId, ReplacementBooking>, args: { fixture: Fixture; weekId: WeekId; visits: Visit[] }): Record<VehicleId, ReplacementBooking>`
  - `bookingsForVisits` is deleted.

- [ ] **Step 1: Write the failing tests.** In `src/domain/replacementBooking.test.ts`, replace the `bookingsForVisits` describe block and its import with:

```ts
describe('eligibleBookings', () => {
  const v103: ReplacementBooking = { vehicleId: 'V-103', startDate: '2026-09-29', days: 1 }
  const v012: ReplacementBooking = { vehicleId: 'V-012', startDate: '2026-10-05', days: 1 }
  const v027: ReplacementBooking = { vehicleId: 'V-027', startDate: '2026-09-29', days: 1 }
  const visitV103: Visit = {
    itemId: 'item-v103',
    vehicleId: 'V-103',
    garageId: 'werkstatt-berg',
    startDate: '2026-09-29',
    days: 1,
    scope: 'suspension',
  }

  it('keeps a booking whose vehicle has a visit this week', () => {
    const kept = eligibleBookings({ 'V-103': v103 }, { fixture, weekId: WEEK_40, visits: [visitV103] })
    expect(kept).toEqual({ 'V-103': v103 })
  })

  it('keeps a booking for a vehicle held this week with no visit', () => {
    const kept = eligibleBookings({ 'V-012': v012 }, { fixture, weekId: '2026-10-05', visits: [] })
    expect(kept).toEqual({ 'V-012': v012 })
  })

  it('drops a booking for a vehicle neither visiting nor held', () => {
    expect(eligibleBookings({ 'V-027': v027 }, { fixture, weekId: WEEK_40, visits: [] })).toEqual({})
  })

  it('drops a held vehicle once its hold has ended before the week', () => {
    const later = { vehicleId: 'V-012', startDate: '2026-10-12', days: 1 }
    expect(eligibleBookings({ 'V-012': later }, { fixture, weekId: '2026-10-12', visits: [] })).toEqual({})
  })
})

describe('canCarryBooking', () => {
  it('is true for V-012 in week 41, on its hold alone', () => {
    expect(canCarryBooking('V-012', { fixture, weekId: '2026-10-05', visits: [] })).toBe(true)
  })
  it('is false for an idle van', () => {
    expect(canCarryBooking('V-027', { fixture, weekId: WEEK_40, visits: [] })).toBe(false)
  })
})
```

Update the import at the top to `canCarryBooking, eligibleBookings` in place of `bookingsForVisits`.

In `src/domain/costs.test.ts`, add:

```ts
it('charges a held-vehicle booking in a week with no visit for it', () => {
  const summary = costSummaryFor({
    fixture,
    weekId: '2026-10-05',
    decisions: {},
    bookings: { 'V-012': { vehicleId: 'V-012', startDate: '2026-10-05', days: 1 } },
  })
  expect(summary.coverCostEur).toBe(140)
  expect(summary.totalEur).toBe(140)
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/domain/replacementBooking.test.ts src/domain/costs.test.ts`
Expected: FAIL, `eligibleBookings` is not exported, and cover cost is 0.

- [ ] **Step 3: Implement.** In `src/domain/replacementBooking.ts`, change the import line to `import { isHeldOn, weekFixtureFor } from './capacity'` (`Fixture`, `Visit` and `WeekId` are already imported from `./types`), and replace `bookingsForVisits` with:

```ts
/**
 * A replacement belongs to an unavailability: a visit this week, or a hold on
 * any day of it. Every reader and the reducer go through here, so a booking
 * that reached storage by any other route, or that outlived its reason, adds
 * neither capacity nor cost. Structural, not trusting. [no pool cover spec D3,
 * superseding scenario spec §5.4]
 */
export function canCarryBooking(
  vehicleId: VehicleId,
  args: { fixture: Fixture; weekId: WeekId; visits: Visit[] },
): boolean {
  const { fixture, weekId, visits } = args
  if (visits.some((v) => v.vehicleId === vehicleId)) return true
  const vehicle = fixture.vehicles.find((v) => v.id === vehicleId)
  if (vehicle === undefined) return false
  return weekFixtureFor(fixture, weekId).days.some((d) => isHeldOn(vehicle, d))
}

export function eligibleBookings(
  bookings: Record<VehicleId, ReplacementBooking>,
  args: { fixture: Fixture; weekId: WeekId; visits: Visit[] },
): Record<VehicleId, ReplacementBooking> {
  return Object.fromEntries(
    Object.entries(bookings).filter(([vehicleId]) => canCarryBooking(vehicleId, args)),
  )
}
```

Then replace every call site. Each already has `fixture` and a week id in scope:

- `validation.ts:26`: `eligibleBookings(bookings, { fixture, weekId, visits })`; update the comment above to "A booking counts as cover only while its vehicle has a visit or a hold. [no pool cover spec D3]".
- `costs.ts:43`: `eligibleBookings(bookings, { fixture, weekId, visits })`. Replace the doc comment's sentence "Cover cost is charged only for a replacement the user actually requested, and only while its vehicle has a visit; the pre-confirmed rentals R-1 and R-2 are fixture inputs, like the budget itself, and never enter this total." with "Cover cost is charged only for a replacement the user actually requested, and only while its vehicle has a visit or a hold. No cover is pre-confirmed. [no pool cover spec D1, D3]".
- `commit.ts:89`: `eligibleBookings(plan.bookings, { fixture, weekId: plan.weekId, visits })`; `commit.ts:165` the same.
- `fleetStatus.ts:119`: `committed === null ? {} : eligibleBookings(committed.bookings, { fixture, weekId: committed.weekId, visits: committedVisits })`; `fleetStatus.ts:123`: `eligibleBookings(bookings, { fixture, weekId: mondayOf(today), visits: draftVisits })`. Import `mondayOf` from `./clock` if it is not already imported. Update both comments from "only while its vehicle has a committed visit" / "filtered to draft visits" to "only while its vehicle has a visit or a hold".
- `CapacityBand.tsx:22`: `eligibleBookings(bookings, { fixture, weekId, visits })`.
- `ItemDetail.tsx:47`: `eligibleBookings(bookingsFor({ state, weekId }), { fixture, weekId, visits: draftVisits })[item.vehicleId] ?? null`.

Update each file's import from `bookingsForVisits` to `eligibleBookings`.

- [ ] **Step 4: Verify**

Run: `npx tsc -b && npx vitest run src/domain/replacementBooking.test.ts src/domain/costs.test.ts`
Expected: tsc clean; both files PASS. `grep -rn bookingsForVisits src` returns nothing.

- [ ] **Step 5: Commit**

```bash
git add src/domain/replacementBooking.ts src/domain/replacementBooking.test.ts src/domain/costs.ts src/domain/costs.test.ts src/domain/validation.ts src/domain/commit.ts src/domain/fleetStatus.ts src/ui/CapacityBand.tsx src/ui/ItemDetail.tsx
git commit -m "feat: let a held van carry a requested replacement

- replace bookingsForVisits with one eligibility predicate
- count a booking while its vehicle has a visit or a hold

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Reducer and persistence

**Files:**
- Modify: `src/state/planReducer.ts:6,22,102,121-128,136-141`
- Modify: `src/state/persistence.ts:15-18`
- Test: `src/domain/planReducer.test.ts`, `src/domain/persistence.test.ts`

**Interfaces:**
- Consumes: `canCarryBooking`, `eligibleBookings` from Task 2.
- Produces: `AppState.version: 3`; `CURRENT_VERSION = 3`.

- [ ] **Step 1: Write the failing tests.** In `src/domain/planReducer.test.ts`, inside `describe('booking a replacement', ...)` add:

```ts
  it('records a booking for a held vehicle with no visit, in week 41', () => {
    let s = reduce(initialState(fixture), { type: 'advance-days', days: 7 })
    const booking = { vehicleId: 'V-012', startDate: '2026-10-05', days: 1 }
    s = reduce(s, { type: 'set-booking', weekId: '2026-10-05', booking })
    expect(bookingsFor({ state: s, weekId: '2026-10-05' })).toEqual({ 'V-012': booking })
  })

  it("keeps a held vehicle's booking when its item is switched to watch", () => {
    const booking = { vehicleId: 'V-012', startDate: '2026-09-28', days: 5 }
    let s = reduce(adoptedState(), { type: 'set-booking', weekId: '2026-09-28', booking })
    s = reduce(s, {
      type: 'set-decision',
      weekId: '2026-09-28',
      decision: { itemId: 'item-v012', treatment: null, slotDate: null, deferral: null },
    })
    expect(bookingsFor({ state: s, weekId: '2026-09-28' })).toEqual({ 'V-012': booking })
  })
```

In `src/domain/persistence.test.ts`, change the version test and the seed-state literal at line 36:

```ts
describe('the persisted state version', () => {
  it('is 3, and the seed carries it', () => {
    expect(CURRENT_VERSION).toBe(3)
    expect(initialState(fixture).version).toBe(CURRENT_VERSION)
  })
})
```

Set `version: 3` in the literal at line 36. In the test `falls back to the seed, with the older-build notice, on the previous build's version`, make sure the stored version is `2`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/domain/planReducer.test.ts src/domain/persistence.test.ts`
Expected: the new reducer tests and the version test FAIL.

- [ ] **Step 3: Implement.** In `planReducer.ts`: import `canCarryBooking, eligibleBookings` in place of `bookingsForVisits`; change `version: 2` to `version: 3` in both `AppState` and `initialState`; in `set-decision` replace the pruning call with

```ts
      // A replacement belongs to a visit or a hold. Whenever the decisions
      // change, the week's bookings are pruned to vehicles that still have
      // one, so a watched or undecided item carries neither cover capacity nor
      // cover cost unless its van is held. [no pool cover spec D3]
      const bookings = eligibleBookings(bookingsFor({ state, weekId: action.weekId }), {
        fixture,
        weekId: action.weekId,
        visits: visitsFromDecisions(draft, fixture.items),
      })
```

and in `set-booking` replace the guard with

```ts
      // Structural: no action sequence can store a booking for a vehicle with
      // neither a visit nor a hold this week. [no pool cover spec D3]
      const visits = visitsFromDecisions(draftFor({ fixture, state, weekId: action.weekId }), fixture.items)
      if (!canCarryBooking(action.booking.vehicleId, { fixture, weekId: action.weekId, visits })) return state
```

In `persistence.ts`:

```ts
// 2 since the backlog opens undecided; 3 since pool cover was removed and a
// hold can carry a booking. A browser holding older state must reset to the
// new seed, and say so. [scenario spec §3.5, no pool cover spec D6]
export const CURRENT_VERSION = 3
```

- [ ] **Step 4: Verify**

Run: `npx tsc -b && npx vitest run src/domain/planReducer.test.ts src/domain/persistence.test.ts`
Expected: tsc clean, both files PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/planReducer.ts src/state/persistence.ts src/domain/planReducer.test.ts src/domain/persistence.test.ts
git commit -m "feat: accept hold-based bookings in the reducer and reset v2 state

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Shortfall chips can target a held vehicle

**Files:**
- Modify: `src/ui/grouping.ts` (`BlockerChip`, `blockerChips`, `itemChip`)
- Test: `src/ui/grouping.test.ts`

**Interfaces:**
- Produces:
  - `export type Selection = { kind: 'item'; itemId: ItemId } | { kind: 'held-vehicle'; vehicleId: VehicleId }` in `grouping.ts`
  - `BlockerChip.target: Selection | null` replaces `targetItemId`.
  - `blockerChips` takes one more argument field, `weekId: WeekId`.

- [ ] **Step 1: Write the failing test** in `src/ui/grouping.test.ts`:

```ts
describe('a shortfall caused only by a hold targets the held vehicle', () => {
  it('points the week 41 Monday chip at V-012', () => {
    const weekId = '2026-10-05'
    const decisions: Record<ItemId, DraftDecision> = {
      'item-v024': { itemId: 'item-v024', treatment: null, slotDate: null, deferral: null },
      'item-v105': { itemId: 'item-v105', treatment: null, slotDate: null, deferral: null },
    }
    const blockers = validatePlan({ fixture, weekId, decisions })
    const chips = blockerChips({ blockers, items: [item('item-v024'), item('item-v105')], decisions, fixture, weekId })
    const monday = chips.find((c) => c.key === 'capacity-2026-10-05-standard')!
    expect(monday.target).toEqual({ kind: 'held-vehicle', vehicleId: 'V-012' })
  })
})
```

Also replace every `targetItemId` expectation in this file: `targetItemId: 'item-x'` becomes `target: { kind: 'item', itemId: 'item-x' }` and `targetItemId: null` becomes `target: null`. Pass `weekId: '2026-09-28'` in every existing `blockerChips` call.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/ui/grouping.test.ts -t "held vehicle"`
Expected: FAIL, `target` is undefined.

- [ ] **Step 3: Implement** in `grouping.ts`:

```ts
export type Selection = { kind: 'item'; itemId: ItemId } | { kind: 'held-vehicle'; vehicleId: VehicleId }

export interface BlockerChip {
  key: string
  label: string
  target: Selection | null
  /** crit for a hard blocker, warn for a decision still waiting. */
  tone: 'crit' | 'warn'
}
```

In `blockerChips`, accept `weekId: WeekId` in `args` (used by callers for symmetry with the panel; drop it from the destructure if unused). In the undisposed branch use `target: target === null ? null : { kind: 'item', itemId: target.id }`. `itemChip` returns `target: { kind: 'item', itemId: b.itemId }`. Replace the capacity branch with:

```ts
    if (b.kind === 'capacity-shortfall') {
      const target = ordered.find((item) => blockersForItem(blockers, item, fixture).includes(b)) ?? null
      // Attribution excludes held vans, so a shortfall caused only by a hold
      // has no item target. Point at the held van's own item when it is
      // queued (V-012 in week 40), otherwise at the held van itself, so its
      // cover can be requested. [no pool cover spec §2.2]
      const heldId =
        target === null
          ? (b.contributors.find((id) => {
              const v = fixture.vehicles.find((x) => x.id === id)
              return v !== undefined && isHeldOn(v, b.date)
            }) ?? null)
          : null
      const heldItem = heldId === null ? undefined : ordered.find((i) => i.vehicleId === heldId)
      const chipTarget: Selection | null =
        target !== null
          ? { kind: 'item', itemId: target.id }
          : heldItem !== undefined
            ? { kind: 'item', itemId: heldItem.id }
            : heldId !== null
              ? { kind: 'held-vehicle', vehicleId: heldId }
              : null
      out.push({
        key: `capacity-${b.date}-${b.vehicleClass}`,
        label: `${formatDay(b.date)} · ${b.vehicleClass} short ${b.shortBy}`,
        target: chipTarget,
        tone: 'crit',
      })
      continue
    }
```

Import `isHeldOn` from `../domain/capacity` and `VehicleId, WeekId` from `../domain/types`. Add a second test for week 40 (import `initialState, draftFor, queueFor` from `../state/planReducer` and `validatePlan` from `../domain/validation` if not already imported):

```ts
  it("points a week 40 cold-open shortfall chip at the held van's own item", () => {
    const weekId = '2026-09-28'
    const s = initialState(fixture)
    const decisions = draftFor({ fixture, state: s, weekId })
    const blockers = validatePlan({ fixture, weekId, decisions })
    const items = queueFor({ fixture, state: s, weekId }).map((e) => e.item)
    const chips = blockerChips({ blockers, items, decisions, fixture, weekId })
    expect(chips.find((c) => c.key === 'capacity-2026-09-28-standard')!.target).toEqual({
      kind: 'item',
      itemId: 'item-v012',
    })
  })
```

- [ ] **Step 4: Verify**

Run: `npx vitest run src/ui/grouping.test.ts -t "held"`
Expected: both new tests PASS. `npx tsc -b` will fail in `PlanHeader.tsx`, which Task 5 fixes; do not commit until Task 5 Step 4 passes, or commit both tasks together.

---

### Task 5: Held-vehicle panel and widened selection

**Files:**
- Create: `src/ui/HeldVehiclePanel.tsx`
- Modify: `src/ui/ReplacementBookingControl.tsx` (gate), `src/App.tsx`, `src/ui/PlanHeader.tsx:13-50`, `src/ui/CapacityBand.tsx`, `src/ui/DecisionQueue.tsx`
- Test: covered by Task 8's live pass; domain behaviour is already tested in Tasks 2 to 4.

**Interfaces:**
- Consumes: `Selection` (Task 4), `canCarryBooking` (Task 2).
- Produces: `HeldVehiclePanel({ vehicleId }: { vehicleId: VehicleId })`; `ReplacementBookingControl` gains `held: boolean`.

- [ ] **Step 1: Widen the booking control's gate.** In `ReplacementBookingControl.tsx`, add prop `held: boolean` (doc: "True when the vehicle is held on some day this week, which alone permits a request. [no pool cover spec D3]"). Change

```ts
  const booking = appliedVisit === null ? null : (state.draftBookingsByWeek[weekId]?.[vehicleId] ?? null)
```

to

```ts
  const canRequest = appliedVisit !== null || held
  const booking = canRequest ? (state.draftBookingsByWeek[weekId]?.[vehicleId] ?? null) : null
```

and `if (appliedVisit === null) {` to `if (!canRequest) {`. Update the component doc's first sentence to "A replacement belongs to a visit or a hold."

In `ItemDetail.tsx`, pass `held={weekFixtureFor(fixture, weekId).days.some((d) => isHeldOn(vehicle, d))}`; import `isHeldOn, weekFixtureFor` from `../domain/capacity`.

- [ ] **Step 2: Create `src/ui/HeldVehiclePanel.tsx`:**

```tsx
import { formatDay } from '../domain/clock'
import type { VehicleId } from '../domain/types'
import { usePlan } from '../state/PlanProvider'
import { ReplacementBookingControl } from './ReplacementBookingControl'

/**
 * A held van with no item this week. There is no treatment to decide, only
 * cover to request, so the pane shows the hold and the booking control and
 * nothing else. Reached from its shortfall chip or band cell. [no pool cover
 * spec D4, §2.2]
 */
export function HeldVehiclePanel({ vehicleId }: { vehicleId: VehicleId }) {
  const { fixture } = usePlan()
  const vehicle = fixture.vehicles.find((v) => v.id === vehicleId)
  if (vehicle === undefined || vehicle.hold === null) {
    return <p className="empty">This vehicle is not held.</p>
  }
  const { hold } = vehicle
  return (
    <div className="detail">
      <div className="head">
        <span className="vid" style={{ fontSize: 15 }}>
          {vehicle.id}
        </span>
        <span className="urg deadline">Held</span>
      </div>
      <div className="sub">No open item this week · {vehicle.vehicleClass} class</div>
      <div className="because">
        {hold.reason}.{' '}
        {hold.releaseRecordedOn === null
          ? 'No release is recorded yet.'
          : `Release recorded for ${formatDay(hold.releaseRecordedOn)}.`}
      </div>
      <ReplacementBookingControl
        key={vehicle.id}
        vehicleId={vehicle.id}
        vehicleClass={vehicle.vehicleClass}
        appliedVisit={null}
        watched={false}
        held
      />
    </div>
  )
}
```

- [ ] **Step 3: Widen selection in the app.** In `App.tsx`:
  - `const [selection, setSelection] = useState<Selection | null>(null)`; import `Selection` from `./ui/grouping`.
  - `const selectedItemId = selection?.kind === 'item' ? selection.itemId : null` and keep every existing read of `selectedItemId` as is.
  - Replace `setSelectedItemId(x)` calls: `setSelectedItemId(null)` becomes `setSelection(null)`; `setSelectedItemId(itemId)` becomes `setSelection({ kind: 'item', itemId })`.
  - `onSelect={(itemId) => setSelection({ kind: 'item', itemId })}` for `DecisionQueue`.
  - `PlanHeader` gets `onSelect={setSelection}` in place of `onSelectItem`.
  - `CapacityBand` gets `onSelectHeld={(vehicleId) => setSelection({ kind: 'held-vehicle', vehicleId })}`.
  - The right pane renders `selection?.kind === 'held-vehicle' ? <HeldVehiclePanel key={selection.vehicleId} vehicleId={selection.vehicleId} /> : selectedItem === null ? <p className="empty">…</p> : <ItemDetail … />`.

In `PlanHeader.tsx`: prop `onSelect: (s: Selection) => void`; pass `weekId` to `blockerChips` (it already has `activeWeekId(state)` or add it via `usePlan`); the chip button becomes `disabled={chip.target === null}` and `onClick={() => chip.target !== null && onSelect(chip.target)}`.

In `CapacityBand.tsx`: add prop `onSelectHeld: (vehicleId: VehicleId) => void`. In the day loop, compute

```ts
          const heldOnly = std.shortfall > 0
            ? std.unavailable.find((id) => {
                const v = fixture.vehicles.find((x) => x.id === id)
                return v !== undefined && isHeldOn(v, date) && !queuedVehicleIds.has(id)
              }) ?? null
            : null
```

where `queuedVehicleIds = new Set(queueFor({ fixture, state, weekId }).map((e) => e.item.vehicleId))`. Render the standard `Cell` inside `<button className="cellbtn" onClick={() => onSelectHeld(heldOnly)} aria-label={\`Request cover for ${heldOnly}\`}>` only when `heldOnly !== null`; otherwise render it as today. Add to `theme.css`:

```css
.cellbtn { all: unset; display: block; cursor: pointer; }
.cellbtn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

(Check `theme.css` for the accent token's real name and use it.)

- [ ] **Step 4: Verify**

Run: `npx tsc -b && npx vitest run src/ui/grouping.test.ts -t "held" && npm run build`
Expected: tsc clean, tests PASS, build succeeds.

- [ ] **Step 5: Commit Tasks 4 and 5 together**

```bash
git add src/ui/grouping.ts src/ui/grouping.test.ts src/ui/HeldVehiclePanel.tsx src/ui/ReplacementBookingControl.tsx src/ui/ItemDetail.tsx src/App.tsx src/ui/PlanHeader.tsx src/ui/CapacityBand.tsx src/ui/DecisionQueue.tsx src/ui/theme.css
git commit -m "feat: request cover for a held van from its shortfall

- shortfall chips and band cells can target a held vehicle
- add a held-vehicle panel that reuses the booking control

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Reconcile the domain suite with the capacity table

**Files:**
- Test: `src/domain/capacity.test.ts`, `validation.test.ts`, `scenarios.test.ts`, `commit.test.ts`, `fleetStatus.test.ts`, `fixture.test.ts`, `src/ui/grouping.test.ts`

One commit per file. For each file:

- [ ] **Step 1:** Run `npx vitest run <file>` and list its failures.
- [ ] **Step 2:** For each failure, classify it per spec §4 and fix the **test**, never the source, using spec §3 as the expected value. If a failure cannot be reconciled with §3, stop and report it; it is a bug or a spec error.
- [ ] **Step 3:** Run `npx vitest run <file>`; expect PASS.
- [ ] **Step 4:** Commit: `git add <file>` then `git commit -m "test: reconcile <file basename> with the no pool cover table" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"`.

Required changes by name (from the current failure list):

**`capacity.test.ts`**
- `the adopted proposals reproduce the scripted scenario`: all three Tuesday visits with no booking. Tuesday standard is `35 / 38`, short 3 (V-012, V-103, V-118 off; no cover). Rename to `leaves Tuesday three standard vans short`. Every other day is `37 / 38` short 1, except Thursday `37 / 37` with shortfall 0; rename `meets demand...` to `leaves every other day one short, except the light Thursday`.
- `the levers behave as the scenario requires`: with V-012 booked Mon x5 (`adHocCovers` from `{ 'V-012': { vehicleId: 'V-012', startDate: '2026-09-28', days: 5 } }`), moving V-118 to Thursday gives Tue `36 + 1 / 38` short 1 and Thu `36 + 1 / 37` shortfall 0. Moving V-118 to Wednesday instead gives Wed `36 + 1 / 38` short 1 (relocates). Rename the Thursday test `moves V-118 to Thursday for free, leaving Tuesday one short`.
- `reproduces a Wednesday shortage when V-103 extends to a second day`: keep the mechanism; expected Wednesday shortfall is 1 with V-012 covered, 2 without.
- `uses the week 41 template, where R-2 does not exist`: replace with `uses the week 41 template, with no cover and the V-012 hold on Monday`: Monday `37 / 38` short 1, Wednesday and Thursday `38 / 37`.
- `falls back to the default template...`: expect `coverIds: []` and flat demand 38.
- `an ad hoc cover clears a shortfall exactly like a pooled one`: rename describe to `an ad hoc cover adds capacity on the days it confirms`; replace pooled-cover expectations with ad hoc only.
- `capacity figures name own vans and rentals separately`: `reads own + rental / demand where rentals are on site` becomes `reads own + cover / demand where a replacement is on site`, built from a V-012 booking: Monday `37 + 1 / 38`.
- The breakdown tooltip test: expect `no replacement on site` / `replacements on site: V-012 replacement` (Task 7 changes that wording; land Task 7's `capacity.ts` wording change in this commit if this test depends on it).

**`validation.test.ts`**
- `the true cold open`: now carries five undisposed blockers plus four standard shortfalls, Mon, Tue, Wed, Fri, each short 1. Rename `carries one undisposed blocker per item and four shortfalls, because V-012 is held with no cover`.
- `the adopted proposals carry exactly two blockers`: the adopted state now has Tuesday short 3, Mon/Wed/Fri short 1, and V-041's undisposed blocker. Rename to `the adopted proposals carry the V-041 decision and the uncovered days`.
- `the journey to a committable plan`: follow spec §3.1 rows exactly: book V-012 Mon x5, move V-118 to Thursday, book V-103 Tue x1, watch V-041. Assert no blockers and `canCommit` true only after all four.
- `blockers are named in plain language`: expected string for adopted Tuesday: `Tue 29 Sep: standard short by 3. Off the road: V-012, V-103, V-118.` Check `formatDay`'s real format in `clock.ts` and match it.
- `a requested booking clears a capacity blocker only for a vehicle with a visit`: rename `...only for a vehicle with a visit or a hold`; keep the V-027 negative case; add V-012 with no visit as a positive case.

**`scenarios.test.ts`**
- `3. Tight day with a feasible alternative`: after V-012 Mon x5 and V-103 Tue x1, moving V-118 to Thursday clears every shortfall and enables commit (with V-041 watched).
- `4. Aggregate capacity hides a specialist gap`: with standard fully covered per §3.1, scheduling V-041 Thursday leaves only the specialist shortfall.
- `5. Multi-day visit overlaps an existing hold`: recompute against no cover: counts each affected day, each vehicle once.

**`commit.test.ts`**
- Any `coverAssumptions` expectation naming R-1 or R-2: the list is now exactly `['No specialist cover is available this week. A standard rental does not substitute.']`. (Task 7 rewords "rental" to "replacement"; if you land that string change first, match it.)
- Availability rows: take from §3.1 final row.
- Bookings: the committed walkthrough plan has `V-012` Mon x5 and `V-103` Tue x1.
- Totals in any cost assertions: EUR 2,280.

**`fleetStatus.test.ts`**
- `fleet overview at cold open`: today Monday 28 Sep standard short 1; tomorrow short 1. Rename `is one standard van short today and tomorrow, because V-012 is held with no cover`.
- `once every proposal is adopted`: Tuesday short 3.
- `after the walkthrough commit` / `on the committed Tuesday`: use the §3.1 walkthrough plan; Tuesday covered with `V-012 replacement` and `V-103 replacement` on site.
- `in week 41`: lands on the review Monday, V-012 still red and held, today short 1.
- `two new week-41 cases collide on Thursday`: both on Thursday gives short 1; moving V-105 to Wednesday clears it; moving V-105 to Monday relocates to Monday short 2 without the V-012 booking, short 1 with it.
- `with a multi-day visit`: replace the R-2 rationale with the same mechanism on a requested booking.
- `next business day`: `previews week 41 from Friday: Monday one short, because V-012 is still held`.
- `shows a committed replacement as a fact about the van`: add a case for a held-only week 41 V-012 booking showing `Replacement on site · day 1 of 1` on 5 Oct.

**`fixture.test.ts`**
- `leaves V-041 undisposed so the cold open carries one shortfall, not two`: rename `leaves V-041 undisposed so the cold open has no specialist shortfall`; assertion unchanged.

**`grouping.test.ts`**
- Cold open now has four red capacity chips plus one amber `5 to decide` chip, in `validatePlan` order. `groupQueue at the true cold open` still puts all five items in `open`: `blockersForItem` excludes a held van from shortfall attribution, so V-012 is not `blocking`. The collapsed amber chip is unchanged; four red capacity chips now precede or follow it in `validatePlan` order (items first, then capacity).
- `once the week is clear`: use the §3.1 walkthrough decisions and bookings.

- [ ] **Final step for the task:** `npm test` shows zero failures. Record the total count for Task 7.

---

### Task 7: Live copy

**Files:**
- Modify: `src/ui/coverNoteContent.ts:83,161`, `src/ui/CapacityBand.tsx:38`, `src/domain/capacity.ts:83-86,126-144`, `src/domain/commit.ts:104`
- Modify: `README.md`, `docs/speaker-script.md`

- [ ] **Step 1: Code copy.**
  - `CapacityBand.tsx:38`: `Week capacity · own + replacement / demand`.
  - `capacity.ts` `capacityBreakdown`: `no replacement on site` / `replacements on site: ${…}`; comment above `capacityFigure`: "Own vans and replacements, stated separately"; comment at `:83-86`: "A requested replacement booking is merged in as an extra cover source, so it clears a shortfall with no second capacity mechanism to keep in sync. [replacement cover spec §4.1, as amended by no pool cover spec D1]".
  - `commit.ts:104`: `'No specialist cover is available this week. A standard replacement does not substitute.'`
  - `coverNoteContent.ts:83`, replace the paragraph with: `'Five decisions wait, and none is taken for you. Each carries the system\'s proposal; adopt it or choose differently. The depot starts one standard van short every day V-012 is held, because no rental is pre-confirmed: cover is a decision with a cost. Take the three Tuesday proposals as they come and Tuesday goes three short. Thursday has one free van, so moving one visit there costs nothing; the rest needs requested cover. V-041, the only specialist van in the queue, has no proposed day at all. No specialist cover exists this week, so scheduling it leaves an assignment uncovered that nothing available can fill.'`
  - `coverNoteContent.ts:161`: replace `rental cover` with `replacement-cover pricing`.
- [ ] **Step 2:** Update any test asserting the old strings (`grep -rn "own + rental\|rental on site\|standard rental" src`), run `npm test`, expect PASS.
- [ ] **Step 3: README.** Replace walkthrough steps 1 to 4 and 9 per spec §3: step 1 "one standard van short today"; step 3 "Request replacement cover from Monday for five days. The band clears except Thursday, which shows one spare, and the Consequence tile shows EUR 700"; step 4 "Apply the proposals for V-103 and V-118, both Tuesday visits. Tuesday goes two short. Move V-118 to Thursday, where the spare van absorbs it at no cost, and request a one-day Tuesday replacement for V-103. The band clears and the weekly total reaches EUR 2,280 against a EUR 3,000 budget."; step 8 total EUR 2,280; step 9 "week 41 opens one standard van short on Monday, because V-012's hold runs until 6 Oct. Its shortfall chip opens the held van, where one day of cover closes it. The two new standard cases both propose Thursday; adopting both leaves Thursday one short, and moving V-105 to Wednesday clears it." Replace the test count with the number from Task 6 and delete the "being re-baselined" paragraph.
- [ ] **Step 4: Speaker script.** Delete the readiness note; replace EUR 2,420 with EUR 2,280; rewrite the step 4 and week 41 passages to match the README; replace "no pre-confirmed-rental fixture has not been brought back to a green automated baseline" with nothing (delete the clause) and the "Next, in order: reconcile..." item. `grep -n "2,420\|re-baselined\|247 of 302" README.md docs/speaker-script.md` returns nothing.
- [ ] **Step 5: Commit**

```bash
git add src/ui/coverNoteContent.ts src/ui/CapacityBand.tsx src/domain/capacity.ts src/domain/commit.ts README.md docs/speaker-script.md
git add <each test file changed in Step 2, by exact path>
git commit -m "docs: rewrite live copy for requested-only cover

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Supersede pointers and acceptance pass

**Files:**
- Modify: `docs/superpowers/specs/2026-09-24-replacement-cover-design.md` (§4.1, §5.4), `docs/superpowers/specs/2026-09-24-scenario-and-cover-accounting-fixes-design.md` (§5.6)
- Modify: `docs/acceptance.md` (append)

- [ ] **Step 1:** Under each named section heading, add one line: `> Superseded by 2026-09-28-no-pool-cover-design.md (D1, D3).` Match the wording other specs use for supersede notes (`grep -n "Superseded" docs/superpowers/specs/*.md`).
- [ ] **Step 2: Live pass.** `npm run dev`, then in the browser follow README steps 1 to 9. Verify via DOM text and `element.click()` (screenshots are unreliable here): band figures per §3.1 and §3.2 at each step, total `EUR 2,280`, week 41 Monday chip opens the V-012 panel, a one-day booking clears Monday. Clear localStorage first, and also load once with a v2 state to see the reset notice.
- [ ] **Step 3:** Append a dated section `## 2026-09-28: no pool cover` to `docs/acceptance.md` listing each step checked and its observed text. Record any deviation plainly.
- [ ] **Step 4: Full verification:** `npx tsc -b && npm test && npm run build`, all clean.
- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-09-24-replacement-cover-design.md docs/superpowers/specs/2026-09-24-scenario-and-cover-accounting-fixes-design.md docs/acceptance.md
git commit -m "docs: point superseded rules at the new spec and record the acceptance pass

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Review and PR

- [ ] **Step 1:** Run the `code-review` skill on the branch diff against `main`. Fix confirmed findings in their own commits.
- [ ] **Step 2:** `git push -u origin remove-preconfirmed-rentals`, then `gh pr create --base main --title "Remove pre-confirmed rentals; cover is always requested"` with a body summarising spec D1 to D7, the new totals, the test count, and the acceptance section, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Confirm with the user before pushing.
