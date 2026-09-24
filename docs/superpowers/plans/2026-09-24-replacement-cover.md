# Replacement Cover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user request a rented replacement for any standard-class vehicle, for as little as a day, see its downtime and cost live, and see service-plus-cover cost rolled up against a weekly budget on the fleet dashboard and the commit summary.

**Architecture:** A `ReplacementBooking` is a small, vehicle-keyed draft decision that sits alongside (not inside) the existing item-keyed `DraftDecision`, follows the exact same draft → Commit → Reset lifecycle, and is converted into a `Cover`-shaped adapter so the existing capacity engine (`computeDayCapacity`/`computeWeekCapacity`) treats a requested booking exactly like the fixture's own R-1/R-2 rentals. A new `costSummaryFor` function is the single source of service-plus-cover cost totals, called by both the live dashboard and the frozen commit summary.

**Tech Stack:** React 19, TypeScript (strict), Vitest, no new dependencies.

## Global Constraints

- Replacement bookings are standard-class only; specialist vehicles stay uncoverable (spec §2, §8).
- The day rate is one fixture-wide constant, `fixture.replacementDayRateEur`, not a per-booking field (spec §3.1).
- The budget is a fixture input (`WeekFixture.budgetEur`, `Fixture.defaultBudgetEur`), never user-editable (spec §3.1, §12).
- Going over budget warns; it never blocks Commit (spec §2, §6).
- A booking follows the same draft → Commit → Reset lifecycle as a treatment decision (spec §5).
- One active booking per vehicle per week; requesting again replaces the prior draft (spec §8).
- A booking cannot extend outside the active week's authored days (spec §8).
- Operational disruption stays a count, never money, and never enters the cost total (spec §4.2).
- Every new required type field is introduced in the same task that fixes every place that constructs it, so `npm test` and `npm run build` both stay clean after every task.

**Reference:** `docs/superpowers/specs/2026-09-24-replacement-cover-design.md`, referenced below as `[spec §n]`.

---

## File Structure

New files:
- `src/domain/replacementBooking.ts` / `.test.ts`: validation, cost, the `Cover` adapter.
- `src/domain/costs.ts` / `.test.ts`: the one service+cover rollup function both surfaces call.
- `src/ui/ReplacementBookingControl.tsx`: the shared request/summary control, mounted in three places.

Modified files (grouped by the task that touches them): `src/domain/types.ts`, `src/domain/fixture.ts`, `src/domain/fixture.test.ts`, `src/domain/capacity.ts`, `src/domain/capacity.test.ts`, `src/domain/commit.ts`, `src/domain/commit.test.ts`, `src/state/planReducer.ts`, `src/domain/planReducer.test.ts`, `src/state/persistence.ts`, `src/domain/persistence.test.ts`, `src/domain/validation.ts`, `src/domain/validation.test.ts`, `src/domain/fleetStatus.ts`, `src/domain/fleetStatus.test.ts`, `src/ui/ItemDetail.tsx`, `src/ui/InspectPopover.tsx`, `src/ui/FleetView.tsx`, `src/ui/CapacityBand.tsx`, `src/ui/CommitSummary.tsx`, `src/App.tsx`, `src/ui/theme.css`.

---

### Task 1: Domain types, fixture data, and the week-fixture default

**Files:**
- Modify: `src/domain/types.ts:102-107` (after `Cover`), `:125-131` (`WeekFixture`), `:138-148` (`Fixture`)
- Modify: `src/domain/fixture.ts:304-331` (`weeks`, `fixture`)
- Modify: `src/domain/capacity.ts:19-29` (`weekFixtureFor` fallback)
- Modify: `src/domain/fixture.test.ts` (new assertions)
- Modify: `src/domain/capacity.test.ts:163-174` (existing fallback test)

**Interfaces:**
- Produces: `ReplacementBooking { vehicleId: VehicleId; startDate: ISODate; days: number }`; `Fixture.replacementDayRateEur: number`; `Fixture.defaultBudgetEur: number`; `WeekFixture.budgetEur: number`.

- [ ] **Step 1: Add the type fields**

In `src/domain/types.ts`, add `ReplacementBooking` right after the existing `Cover` interface:

```ts
export interface Cover {
  id: string
  vehicleClass: VehicleClass
  confirmedDates: ISODate[]
  dayRateEur: number
}

export interface ReplacementBooking {
  vehicleId: VehicleId
  startDate: ISODate
  days: number
}
```

Add `budgetEur` to `WeekFixture`:

```ts
export interface WeekFixture {
  weekId: WeekId
  days: ISODate[]
  demand: Demand
  coverIds: string[]
  itemIds: ItemId[]
  budgetEur: number
}
```

Add `replacementDayRateEur` and `defaultBudgetEur` to `Fixture`:

```ts
export interface Fixture {
  depot: string
  vehicles: Vehicle[]
  items: OpenItem[]
  covers: Cover[]
  garages: Garage[]
  weeks: WeekFixture[]
  defaultDemand: Demand
  defaultCoverIds: string[]
  events: ScheduledEvent[]
  replacementDayRateEur: number
  defaultBudgetEur: number
}
```

- [ ] **Step 2: Author the fixture values**

In `src/domain/fixture.ts`, add `budgetEur: 3000` to both entries of the `weeks` array:

```ts
const weeks: WeekFixture[] = [
  {
    weekId: '2026-09-28',
    days: WEEK_40,
    demand: { standard: 38, specialist: 7 },
    coverIds: ['R-1', 'R-2'],
    itemIds: items.map((i) => i.id),
    budgetEur: 3000,
  },
  {
    weekId: '2026-10-05',
    days: WEEK_41,
    demand: { standard: 38, specialist: 7 },
    coverIds: ['R-1'],
    itemIds: [],
    budgetEur: 3000,
  },
]
```

Add `replacementDayRateEur` and `defaultBudgetEur` to the `fixture` export:

```ts
export const fixture: Fixture = {
  depot: 'Depot Nord',
  vehicles,
  items,
  covers,
  garages,
  weeks,
  defaultDemand: { standard: 38, specialist: 7 },
  defaultCoverIds: ['R-1'],
  events,
  replacementDayRateEur: 140,
  defaultBudgetEur: 3000,
}
```

- [ ] **Step 3: Fix the one other place a `WeekFixture` is built**

In `src/domain/capacity.ts`, `weekFixtureFor`'s fallback branch must also carry `budgetEur`, or `tsc` fails on a missing required property:

```ts
export function weekFixtureFor(fixture: Fixture, weekId: WeekId): WeekFixture {
  const authored = fixture.weeks.find((w) => w.weekId === weekId)
  if (authored) return authored
  return {
    weekId,
    days: weekDays(weekId),
    demand: fixture.defaultDemand,
    coverIds: fixture.defaultCoverIds,
    itemIds: [],
    budgetEur: fixture.defaultBudgetEur,
  }
}
```

- [ ] **Step 4: Write the new fixture assertions**

Add to `src/domain/fixture.test.ts`, inside the existing `describe('fixture integrity', ...)` block (after the `defaultDemand` test):

```ts
  it('prices a standard replacement at a single fixture-wide day rate', () => {
    expect(fixture.replacementDayRateEur).toBe(140)
  })

  it('sets a weekly budget for both authored weeks and a default for the rest', () => {
    expect(fixture.weeks.find((w) => w.weekId === '2026-09-28')!.budgetEur).toBe(3000)
    expect(fixture.weeks.find((w) => w.weekId === '2026-10-05')!.budgetEur).toBe(3000)
    expect(fixture.defaultBudgetEur).toBe(3000)
  })
```

Extend the existing fallback test in `src/domain/capacity.test.ts`:

```ts
  it('falls back to the default template for weeks the fixture does not author', () => {
    const week = weekFixtureFor(fixture, '2026-11-02')
    expect(week.itemIds).toEqual([])
    expect(week.coverIds).toEqual(['R-1'])
    expect(week.budgetEur).toBe(fixture.defaultBudgetEur)
    expect(week.days).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
    ])
  })
```

- [ ] **Step 5: Run the full suite and the build**

Run: `npm test`
Expected: all existing tests still pass, plus the new fixture assertions.

Run: `npm run build`
Expected: succeeds. This is the step that catches a missing `budgetEur` on any `WeekFixture` literal; `npm test` alone would not.

- [ ] **Step 6: Commit**

```bash
git add src/domain/types.ts src/domain/fixture.ts src/domain/capacity.ts src/domain/fixture.test.ts src/domain/capacity.test.ts
git commit -m "feat: add replacement-cover fixture data (day rate, weekly budget)"
```

---

### Task 2: `replacementBooking.ts`, validation and the `Cover` adapter

**Files:**
- Create: `src/domain/replacementBooking.ts`
- Test: `src/domain/replacementBooking.test.ts`

**Interfaces:**
- Consumes: `ReplacementBooking`, `Fixture`, `Cover`, `VehicleId`, `WeekId` (Task 1). `weekFixtureFor` (`src/domain/capacity.ts`). `addDays` (`src/domain/clock.ts`).
- Produces: `replacementBookingErrors(draft, args): string[]`; `isReplacementBookingComplete(draft, args): boolean`; `bookingCostEur(booking, dayRateEur): number`; `bookingAsCover(booking, dayRateEur): Cover`; `adHocCoversFrom(bookings, dayRateEur): Cover[]`.

- [ ] **Step 1: Write the failing tests**

Create `src/domain/replacementBooking.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  adHocCoversFrom,
  bookingAsCover,
  bookingCostEur,
  isReplacementBookingComplete,
  replacementBookingErrors,
} from './replacementBooking'
import { fixture } from './fixture'
import type { ReplacementBooking } from './types'

const WEEK_40 = '2026-09-28'

describe('replacementBookingErrors', () => {
  it('requires a vehicle', () => {
    expect(replacementBookingErrors(null, { fixture, weekId: WEEK_40 })).toEqual(['A vehicle is required'])
  })

  it('rejects an unknown vehicle', () => {
    expect(
      replacementBookingErrors(
        { vehicleId: 'V-999', startDate: '2026-09-29', days: 1 },
        { fixture, weekId: WEEK_40 },
      ),
    ).toEqual(['Unknown vehicle'])
  })

  it('rejects a specialist vehicle', () => {
    const errors = replacementBookingErrors(
      { vehicleId: 'V-041', startDate: '2026-09-29', days: 1 },
      { fixture, weekId: WEEK_40 },
    )
    expect(errors).toContain('No specialist replacement cover exists')
  })

  it('names a missing start date and a missing day count separately', () => {
    const errors = replacementBookingErrors({ vehicleId: 'V-027' }, { fixture, weekId: WEEK_40 })
    expect(errors).toContain('A start date is required')
    expect(errors).toContain('At least one day is required')
  })

  it('rejects a start date outside the active week', () => {
    const errors = replacementBookingErrors(
      { vehicleId: 'V-027', startDate: '2026-10-05', days: 1 },
      { fixture, weekId: WEEK_40 },
    )
    expect(errors).toContain('Start date must fall within the active week')
  })

  it('rejects a range that overruns the week', () => {
    const errors = replacementBookingErrors(
      { vehicleId: 'V-027', startDate: '2026-10-02', days: 2 },
      { fixture, weekId: WEEK_40 },
    )
    expect(errors).toContain('The booking cannot extend beyond the active week')
  })

  it('accepts a valid one-day booking', () => {
    const booking = { vehicleId: 'V-027', startDate: '2026-09-29', days: 1 }
    expect(replacementBookingErrors(booking, { fixture, weekId: WEEK_40 })).toEqual([])
    expect(isReplacementBookingComplete(booking, { fixture, weekId: WEEK_40 })).toBe(true)
  })

  it('accepts a booking that fills the whole week', () => {
    const booking = { vehicleId: 'V-027', startDate: '2026-09-28', days: 5 }
    expect(replacementBookingErrors(booking, { fixture, weekId: WEEK_40 })).toEqual([])
  })
})

describe('bookingCostEur', () => {
  it('multiplies days by the day rate', () => {
    const booking: ReplacementBooking = { vehicleId: 'V-027', startDate: '2026-09-29', days: 3 }
    expect(bookingCostEur(booking, fixture.replacementDayRateEur)).toBe(3 * fixture.replacementDayRateEur)
  })
})

describe('bookingAsCover', () => {
  it('expands into one confirmed date per day, always standard class', () => {
    const booking: ReplacementBooking = { vehicleId: 'V-027', startDate: '2026-09-29', days: 2 }
    const cover = bookingAsCover(booking, 140)
    expect(cover.vehicleClass).toBe('standard')
    expect(cover.confirmedDates).toEqual(['2026-09-29', '2026-09-30'])
    expect(cover.dayRateEur).toBe(140)
    expect(cover.id).toBe('V-027 replacement')
  })
})

describe('adHocCoversFrom', () => {
  it('converts every booking in the map', () => {
    const covers = adHocCoversFrom(
      {
        'V-027': { vehicleId: 'V-027', startDate: '2026-09-29', days: 1 },
        'V-105': { vehicleId: 'V-105', startDate: '2026-09-30', days: 1 },
      },
      140,
    )
    expect(covers).toHaveLength(2)
    expect(covers.map((c) => c.confirmedDates[0]).sort()).toEqual(['2026-09-29', '2026-09-30'])
  })

  it('returns an empty array for no bookings', () => {
    expect(adHocCoversFrom({}, 140)).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- replacementBooking`
Expected: FAIL, `Cannot find module './replacementBooking'`.

- [ ] **Step 3: Write the implementation**

Create `src/domain/replacementBooking.ts`:

```ts
import { weekFixtureFor } from './capacity'
import { addDays } from './clock'
import type { Cover, Fixture, ReplacementBooking, VehicleId, WeekId } from './types'

/**
 * Structural, not trusting: the standard-only rule is checked here too, not
 * only by the control that disables itself. [spec §8]
 */
export function replacementBookingErrors(
  draft: Partial<ReplacementBooking> | null,
  args: { fixture: Fixture; weekId: WeekId },
): string[] {
  const { fixture, weekId } = args
  if (!draft || !draft.vehicleId) return ['A vehicle is required']

  const vehicle = fixture.vehicles.find((v) => v.id === draft.vehicleId)
  if (!vehicle) return ['Unknown vehicle']

  const errors: string[] = []
  if (vehicle.vehicleClass !== 'standard') errors.push('No specialist replacement cover exists')
  if (!draft.startDate) errors.push('A start date is required')
  if (draft.days === undefined || draft.days === null || draft.days < 1) {
    errors.push('At least one day is required')
  }

  if (draft.startDate && draft.days !== undefined && draft.days !== null && draft.days >= 1) {
    const week = weekFixtureFor(fixture, weekId)
    const startIndex = week.days.indexOf(draft.startDate)
    if (startIndex === -1) {
      errors.push('Start date must fall within the active week')
    } else if (startIndex + draft.days > week.days.length) {
      errors.push('The booking cannot extend beyond the active week')
    }
  }

  return errors
}

export function isReplacementBookingComplete(
  draft: Partial<ReplacementBooking> | null,
  args: { fixture: Fixture; weekId: WeekId },
): boolean {
  return replacementBookingErrors(draft, args).length === 0
}

/** Only the decision is stored; cost and downtime are both derived. [spec §3.1] */
export function bookingCostEur(booking: ReplacementBooking, dayRateEur: number): number {
  return booking.days * dayRateEur
}

/**
 * A `Cover`-shaped view of one booking, so the capacity engine never has to
 * know a second kind of cover exists. [spec §3.2, §4.1]
 */
export function bookingAsCover(booking: ReplacementBooking, dayRateEur: number): Cover {
  return {
    id: `${booking.vehicleId} replacement`,
    vehicleClass: 'standard',
    confirmedDates: Array.from({ length: booking.days }, (_, n) => addDays(booking.startDate, n)),
    dayRateEur,
  }
}

export function adHocCoversFrom(
  bookings: Record<VehicleId, ReplacementBooking>,
  dayRateEur: number,
): Cover[] {
  return Object.values(bookings).map((b) => bookingAsCover(b, dayRateEur))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- replacementBooking`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add src/domain/replacementBooking.ts src/domain/replacementBooking.test.ts
git commit -m "feat: validate replacement bookings and adapt them into capacity cover"
```

---

### Task 3: `computeDayCapacity`/`computeWeekCapacity` accept ad hoc cover

**Files:**
- Modify: `src/domain/capacity.ts` (imports, `computeDayCapacity`, `computeWeekCapacity`)
- Modify: `src/domain/capacity.test.ts` (new tests)

**Interfaces:**
- Consumes: `Cover` (Task 1). `bookingAsCover`/nothing else directly; this task only adds the parameter, it does not call `replacementBooking.ts`.
- Produces: `computeDayCapacity(args: { ...; adHocCovers?: Cover[] })`; `computeWeekCapacity(args: { ...; adHocCovers?: Cover[] })`. Both existing signatures stay call-compatible: the new parameter is optional and defaults to `[]`.

- [ ] **Step 1: Write the failing tests**

Add to `src/domain/capacity.test.ts` (add `Cover` to the `type` import from `./types`, currently `import type { ItemId, Visit } from './types'` becomes `import type { Cover, ItemId, Visit } from './types'`), appended after the `describe('computeWeekCapacity', ...)` block:

```ts
describe('an ad hoc cover clears a shortfall exactly like a pooled one', () => {
  it('adds to the standard count on the days it confirms', () => {
    const visits = visitsFromDecisions(coldOpenDecisions(), fixture.items)
    const tue = standardFor(visits, '2026-09-29')
    expect(tue.shortfall).toBe(1)

    const extra: Cover = {
      id: 'V-027 replacement',
      vehicleClass: 'standard',
      confirmedDates: ['2026-09-29'],
      dayRateEur: 140,
    }
    const week = weekFixtureFor(fixture, WEEK_40)
    const tueWithBooking = computeDayCapacity({
      date: '2026-09-29',
      vehicleClass: 'standard',
      fixture,
      visits,
      week,
      adHocCovers: [extra],
    })
    expect(tueWithBooking.cover).toBe(3)
    expect(tueWithBooking.available).toBe(38)
    expect(tueWithBooking.shortfall).toBe(0)
  })

  it('never contributes to a class it was not confirmed for', () => {
    const week = weekFixtureFor(fixture, WEEK_40)
    const specOnly: Cover = {
      id: 'x',
      vehicleClass: 'specialist',
      confirmedDates: ['2026-09-29'],
      dayRateEur: 140,
    }
    const tue = computeDayCapacity({
      date: '2026-09-29',
      vehicleClass: 'standard',
      fixture,
      visits: [],
      week,
      adHocCovers: [specOnly],
    })
    expect(tue.cover).toBe(2) // R-1 and R-2 only
  })

  it('defaults to no ad hoc cover when the argument is omitted', () => {
    const week = weekFixtureFor(fixture, WEEK_40)
    const tue = computeDayCapacity({ date: '2026-09-29', vehicleClass: 'standard', fixture, visits: [], week })
    expect(tue.cover).toBe(2)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- capacity`
Expected: FAIL, `Property 'adHocCovers' does not exist` (TS) or a wrong `cover` count at runtime.

- [ ] **Step 3: Implement `adHocCovers`**

In `src/domain/capacity.ts`, add `Cover` to the type import (alphabetically first):

```ts
import { weekDays } from './clock'
import type {
  Cover,
  DayCapacity,
  Fixture,
  ISODate,
  Vehicle,
  VehicleClass,
  VehicleId,
  Visit,
  WeekFixture,
  WeekId,
} from './types'
import { visitCoversDate } from './visits'
```

Replace `computeDayCapacity`:

```ts
export function computeDayCapacity(args: {
  date: ISODate
  vehicleClass: VehicleClass
  fixture: Fixture
  visits: Visit[]
  week: WeekFixture
  adHocCovers?: Cover[]
}): DayCapacity {
  const { date, vehicleClass, fixture, visits, week, adHocCovers = [] } = args
  const inClass = fixture.vehicles.filter((v) => v.vehicleClass === vehicleClass)
  const unavailableAll = unavailableOn(date, fixture.vehicles, visits)
  const unavailable = inClass.filter((v) => unavailableAll.has(v.id)).map((v) => v.id)

  // Cover carries its own class, so a standard rental can never close a
  // specialist gap. The data model does not allow it. [S 3.1]
  const poolCover = fixture.covers.filter(
    (c) =>
      week.coverIds.includes(c.id) &&
      c.vehicleClass === vehicleClass &&
      c.confirmedDates.includes(date),
  ).length
  // A requested replacement booking is merged in as an indistinguishable
  // extra cover source, so it clears a shortfall exactly like R-1 or R-2
  // does, with no second capacity mechanism to keep in sync. [replacement
  // cover spec §4.1]
  const extraCover = adHocCovers.filter(
    (c) => c.vehicleClass === vehicleClass && c.confirmedDates.includes(date),
  ).length
  const cover = poolCover + extraCover

  const owned = inClass.length
  const available = owned - unavailable.length + cover
  const demand = vehicleClass === 'standard' ? week.demand.standard : week.demand.specialist

  return {
    date,
    vehicleClass,
    owned,
    unavailable,
    cover,
    available,
    demand,
    shortfall: Math.max(0, demand - available),
  }
}
```

Replace `computeWeekCapacity`:

```ts
export function computeWeekCapacity(args: {
  fixture: Fixture
  weekId: WeekId
  visits: Visit[]
  adHocCovers?: Cover[]
}): DayCapacity[] {
  const { fixture, weekId, visits, adHocCovers = [] } = args
  const week = weekFixtureFor(fixture, weekId)
  const classes: VehicleClass[] = ['standard', 'specialist']
  return week.days.flatMap((date) =>
    classes.map((vehicleClass) =>
      computeDayCapacity({ date, vehicleClass, fixture, visits, week, adHocCovers }),
    ),
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- capacity`
Expected: PASS, all cases, including the pre-existing ones (the default `[]` keeps every current caller's numbers unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/domain/capacity.ts src/domain/capacity.test.ts
git commit -m "feat: let ad hoc replacement cover clear a capacity shortfall"
```

---

### Task 4: `costs.ts`, the one service+cover rollup

**Files:**
- Create: `src/domain/costs.ts`
- Test: `src/domain/costs.test.ts`

**Interfaces:**
- Consumes: `weekFixtureFor` (`src/domain/capacity.ts`), `visitsFromDecisions` (`src/domain/visits.ts`), `Fixture`, `DraftDecision`, `ItemId`, `ReplacementBooking`, `VehicleId`, `WeekId` (Task 1).
- Produces: `CostSummary { serviceCostEur, coverCostEur, totalEur, budgetEur, overByEur }`; `costSummaryFor(args): CostSummary`.

- [ ] **Step 1: Write the failing tests**

Create `src/domain/costs.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { costSummaryFor } from './costs'
import { fixture } from './fixture'
import { coldOpenDecisions } from './testSupport'
import type { ReplacementBooking, VehicleId } from './types'

const WEEK_40 = '2026-09-28'

describe('costSummaryFor', () => {
  it('sums service and cover cost only for items with a scheduled visit', () => {
    const summary = costSummaryFor({ fixture, weekId: WEEK_40, decisions: coldOpenDecisions(), bookings: {} })
    // Visited at cold open: V-012 (480+700), V-103 (620+140), V-118 (340+140).
    // V-041 is undisposed and V-027 is watched, so neither contributes.
    expect(summary.serviceCostEur).toBe(480 + 620 + 340)
    expect(summary.coverCostEur).toBe(700 + 140 + 140)
    expect(summary.totalEur).toBe(summary.serviceCostEur + summary.coverCostEur)
  })

  it('adds a booking cost on top of the item-level cover cost', () => {
    const bookings: Record<VehicleId, ReplacementBooking> = {
      'V-027': { vehicleId: 'V-027', startDate: '2026-09-29', days: 2 },
    }
    const withBooking = costSummaryFor({ fixture, weekId: WEEK_40, decisions: coldOpenDecisions(), bookings })
    const without = costSummaryFor({ fixture, weekId: WEEK_40, decisions: coldOpenDecisions(), bookings: {} })
    expect(withBooking.coverCostEur).toBe(without.coverCostEur + 2 * fixture.replacementDayRateEur)
    expect(withBooking.serviceCostEur).toBe(without.serviceCostEur)
  })

  it('reports no overage under budget, and the exact overage above it', () => {
    const under = costSummaryFor({ fixture, weekId: WEEK_40, decisions: coldOpenDecisions(), bookings: {} })
    expect(under.overByEur).toBeNull()
    expect(under.budgetEur).toBe(3000)

    const bigBookings: Record<VehicleId, ReplacementBooking> = {
      'V-001': { vehicleId: 'V-001', startDate: '2026-09-28', days: 5 },
      'V-002': { vehicleId: 'V-002', startDate: '2026-09-28', days: 5 },
    }
    const over = costSummaryFor({ fixture, weekId: WEEK_40, decisions: coldOpenDecisions(), bookings: bigBookings })
    expect(over.overByEur).toBe(over.totalEur - over.budgetEur)
    expect(over.overByEur).toBeGreaterThan(0)
  })

  it('never counts an item that is watched or undecided', () => {
    const summary = costSummaryFor({ fixture, weekId: WEEK_40, decisions: {}, bookings: {} })
    expect(summary.serviceCostEur).toBe(0)
    expect(summary.coverCostEur).toBe(0)
    expect(summary.totalEur).toBe(0)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- costs`
Expected: FAIL, `Cannot find module './costs'`.

- [ ] **Step 3: Write the implementation**

Create `src/domain/costs.ts`:

```ts
import { weekFixtureFor } from './capacity'
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
 * Operational disruption is not part of this total: it stays a count,
 * never money, per the cover note's "three cost figures stay apart"
 * [C §3.6]. This function deliberately narrows that principle to combine
 * only service cost and cover cost, which are both spend.
 */
export function costSummaryFor(args: {
  fixture: Fixture
  weekId: WeekId
  decisions: Record<ItemId, DraftDecision>
  bookings: Record<VehicleId, ReplacementBooking>
}): CostSummary {
  const { fixture, weekId, decisions, bookings } = args
  const week = weekFixtureFor(fixture, weekId)
  const visitedItemIds = new Set(visitsFromDecisions(decisions, fixture.items).map((v) => v.itemId))

  let serviceCostEur = 0
  let coverCostEur = 0
  for (const item of fixture.items) {
    if (!visitedItemIds.has(item.id)) continue
    serviceCostEur += item.consequence.serviceCostEur ?? 0
    coverCostEur += item.consequence.coverCostEur ?? 0
  }
  for (const booking of Object.values(bookings)) {
    coverCostEur += booking.days * fixture.replacementDayRateEur
  }

  const totalEur = serviceCostEur + coverCostEur
  const overByEur = totalEur > week.budgetEur ? totalEur - week.budgetEur : null

  return { serviceCostEur, coverCostEur, totalEur, budgetEur: week.budgetEur, overByEur }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- costs`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add src/domain/costs.ts src/domain/costs.test.ts
git commit -m "feat: roll service and cover cost into one weekly total against budget"
```

---

### Task 5: State lifecycle: draft bookings, commit snapshot, reset

**Files:**
- Modify: `src/domain/types.ts` (`CommittedPlan`)
- Modify: `src/domain/commit.ts:21-32` (`commitPlan`)
- Modify: `src/state/planReducer.ts` (`AppState`, `PlanAction`, `initialState`, `bookingsFor`, reducer cases)
- Modify: `src/domain/commit.test.ts` (new tests)
- Modify: `src/domain/planReducer.test.ts` (new tests)

**Interfaces:**
- Consumes: `ReplacementBooking`, `VehicleId` (Task 1).
- Produces: `CommittedPlan.bookings: Record<VehicleId, ReplacementBooking>`; `commitPlan(args: { ...; bookings?: Record<VehicleId, ReplacementBooking> })` (defaults to `{}`, always returns a populated `bookings` field); `AppState.draftBookingsByWeek: Record<WeekId, Record<VehicleId, ReplacementBooking>>`; `bookingsFor(args: { state: AppState; weekId: WeekId }): Record<VehicleId, ReplacementBooking>`; actions `{ type: 'set-booking'; weekId: WeekId; booking: ReplacementBooking }` and `{ type: 'clear-booking'; weekId: WeekId; vehicleId: VehicleId }`.

- [ ] **Step 1: Write the failing tests**

Add to `src/domain/commit.test.ts`, after the `describe('committing', ...)` block:

```ts
describe('bookings travel with the commit', () => {
  it('snapshots a booking', () => {
    const bookings = { 'V-027': { vehicleId: 'V-027', startDate: '2026-09-29', days: 2 } }
    const plan = commitPlan({ weekId: WEEK_40, decisions: committable(), bookings, demoDate: '2026-09-28' })
    expect(plan.bookings['V-027']).toEqual(bookings['V-027'])
  })

  it('defaults to no bookings when none are given', () => {
    const plan = commitPlan({ weekId: WEEK_40, decisions: committable(), demoDate: '2026-09-28' })
    expect(plan.bookings).toEqual({})
  })

  it('leaves the committed booking intact when the draft is edited afterwards', () => {
    const bookings = { 'V-027': { vehicleId: 'V-027', startDate: '2026-09-29', days: 1 } }
    const plan = commitPlan({ weekId: WEEK_40, decisions: committable(), bookings, demoDate: '2026-09-28' })
    bookings['V-027'] = { vehicleId: 'V-027', startDate: '2026-09-30', days: 3 }
    expect(plan.bookings['V-027'].startDate).toBe('2026-09-29')
  })
})
```

Add to `src/domain/planReducer.test.ts`. First widen the import line:

```ts
import {
  activeWeekId,
  bookingsFor,
  draftFor,
  initialState,
  planReducer,
  queueFor,
} from '../state/planReducer'
```

Then append a new `describe` block at the end of the file:

```ts
describe('booking a replacement', () => {
  it('records a draft booking, scoped to its own week', () => {
    const s = reduce(initialState(fixture), {
      type: 'set-booking',
      weekId: '2026-09-28',
      booking: { vehicleId: 'V-027', startDate: '2026-09-29', days: 1 },
    })
    expect(bookingsFor({ state: s, weekId: '2026-09-28' })).toEqual({
      'V-027': { vehicleId: 'V-027', startDate: '2026-09-29', days: 1 },
    })
    expect(bookingsFor({ state: s, weekId: '2026-10-05' })).toEqual({})
  })

  it('replaces a prior draft booking for the same vehicle rather than accumulating', () => {
    let s = reduce(initialState(fixture), {
      type: 'set-booking',
      weekId: '2026-09-28',
      booking: { vehicleId: 'V-027', startDate: '2026-09-29', days: 1 },
    })
    s = reduce(s, {
      type: 'set-booking',
      weekId: '2026-09-28',
      booking: { vehicleId: 'V-027', startDate: '2026-09-30', days: 3 },
    })
    expect(bookingsFor({ state: s, weekId: '2026-09-28' })).toEqual({
      'V-027': { vehicleId: 'V-027', startDate: '2026-09-30', days: 3 },
    })
  })

  it('clears a booking', () => {
    let s = reduce(initialState(fixture), {
      type: 'set-booking',
      weekId: '2026-09-28',
      booking: { vehicleId: 'V-027', startDate: '2026-09-29', days: 1 },
    })
    s = reduce(s, { type: 'clear-booking', weekId: '2026-09-28', vehicleId: 'V-027' })
    expect(bookingsFor({ state: s, weekId: '2026-09-28' })).toEqual({})
  })

  it('snapshots the booking on commit and survives a later draft edit', () => {
    let s = reduce(initialState(fixture), {
      type: 'set-booking',
      weekId: '2026-09-28',
      booking: { vehicleId: 'V-027', startDate: '2026-09-29', days: 1 },
    })
    s = reduce(s, { type: 'commit', weekId: '2026-09-28' })
    expect(s.committedByWeek['2026-09-28']!.bookings['V-027']).toEqual({
      vehicleId: 'V-027',
      startDate: '2026-09-29',
      days: 1,
    })

    s = reduce(s, {
      type: 'set-booking',
      weekId: '2026-09-28',
      booking: { vehicleId: 'V-027', startDate: '2026-09-30', days: 2 },
    })
    expect(s.committedByWeek['2026-09-28']!.bookings['V-027'].startDate).toBe('2026-09-29')
  })

  it('clears every booking on reset', () => {
    let s = reduce(initialState(fixture), {
      type: 'set-booking',
      weekId: '2026-09-28',
      booking: { vehicleId: 'V-027', startDate: '2026-09-29', days: 1 },
    })
    s = reduce(s, { type: 'reset' })
    expect(s).toEqual(initialState(fixture))
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- commit planReducer`
Expected: FAIL. `commitPlan` rejects an unknown `bookings` argument (TS) and `bookingsFor`/`set-booking`/`clear-booking` do not exist yet.

- [ ] **Step 3: Add `CommittedPlan.bookings`**

In `src/domain/types.ts`:

```ts
export interface CommittedPlan {
  weekId: WeekId
  committedOn: ISODate
  decisions: Record<ItemId, DraftDecision>
  bookings: Record<VehicleId, ReplacementBooking>
}
```

- [ ] **Step 4: Update `commitPlan`**

In `src/domain/commit.ts`, add `ReplacementBooking` and `VehicleId` to the type import (already imports `VehicleId`; add `ReplacementBooking` alphabetically):

```ts
import { computeDayCapacity, computeWeekCapacity, isHeldOn, unavailableOn, weekFixtureFor } from './capacity'
import { formatDay, formatLongDay } from './clock'
import type {
  CommittedPlan,
  DayCapacity,
  DeferralRecord,
  DraftDecision,
  Fixture,
  ISODate,
  ItemId,
  ReplacementBooking,
  VehicleClass,
  VehicleId,
  WeekId,
} from './types'
import { visitCoversDate, visitsFromDecisions } from './visits'
```

Replace `commitPlan`:

```ts
/**
 * The snapshot is a deep copy, so editing the draft afterwards leaves the
 * last committed plan intact until recommit. [S 2.3] `bookings` defaults to
 * empty so every existing caller keeps compiling unchanged. [replacement
 * cover spec §5]
 */
export function commitPlan(args: {
  weekId: WeekId
  decisions: Record<ItemId, DraftDecision>
  bookings?: Record<VehicleId, ReplacementBooking>
  demoDate: ISODate
}): CommittedPlan {
  const { weekId, decisions, bookings = {}, demoDate } = args
  return {
    weekId,
    committedOn: demoDate,
    decisions: JSON.parse(JSON.stringify(decisions)) as Record<ItemId, DraftDecision>,
    bookings: JSON.parse(JSON.stringify(bookings)) as Record<VehicleId, ReplacementBooking>,
  }
}
```

- [ ] **Step 5: Add booking state to the reducer**

In `src/state/planReducer.ts`, widen the type import:

```ts
import { commitPlan, deferralRecordsFrom } from '../domain/commit'
import { addDays, mondayOf } from '../domain/clock'
import { nextResurfaceDate, resurfacedItems } from '../domain/deferral'
import { weekFixtureFor } from '../domain/capacity'
import { SEED_DATE } from '../domain/fixture'
import type {
  CommittedPlan,
  DeferralRecord,
  DraftDecision,
  Fixture,
  ISODate,
  ItemId,
  OpenItem,
  ReplacementBooking,
  VehicleId,
  WeekId,
} from '../domain/types'
```

Add `draftBookingsByWeek` to `AppState`:

```ts
export interface AppState {
  version: 1
  demoDate: ISODate
  draftByWeek: Record<WeekId, Record<ItemId, DraftDecision>>
  draftBookingsByWeek: Record<WeekId, Record<VehicleId, ReplacementBooking>>
  committedByWeek: Record<WeekId, CommittedPlan | null>
  deferralHistory: Record<ItemId, DeferralRecord[]>
  storageNotice: string | null
}
```

Add the two new actions to `PlanAction`:

```ts
export type PlanAction =
  | { type: 'set-decision'; weekId: WeekId; decision: DraftDecision }
  | { type: 'set-booking'; weekId: WeekId; booking: ReplacementBooking }
  | { type: 'clear-booking'; weekId: WeekId; vehicleId: VehicleId }
  | { type: 'commit'; weekId: WeekId }
  | { type: 'advance-days'; days: number }
  | { type: 'advance-to-next-review' }
  | { type: 'reset' }
  | { type: 'dismiss-notice' }
```

Add `bookingsFor`, right after `draftFor`:

```ts
export function bookingsFor(args: {
  state: AppState
  weekId: WeekId
}): Record<VehicleId, ReplacementBooking> {
  return args.state.draftBookingsByWeek[args.weekId] ?? {}
}
```

Add `draftBookingsByWeek: {}` to `initialState`:

```ts
export function initialState(_fixture: Fixture): AppState {
  return {
    version: 1,
    demoDate: SEED_DATE,
    draftByWeek: {},
    draftBookingsByWeek: {},
    committedByWeek: {},
    deferralHistory: {},
    storageNotice: null,
  }
}
```

Add the two new cases to `planReducer`, and pass bookings through `commit`:

```ts
    case 'set-booking': {
      const current = bookingsFor({ state, weekId: action.weekId })
      return {
        ...state,
        draftBookingsByWeek: {
          ...state.draftBookingsByWeek,
          [action.weekId]: { ...current, [action.booking.vehicleId]: action.booking },
        },
      }
    }

    case 'clear-booking': {
      const current = { ...bookingsFor({ state, weekId: action.weekId }) }
      delete current[action.vehicleId]
      return {
        ...state,
        draftBookingsByWeek: { ...state.draftBookingsByWeek, [action.weekId]: current },
      }
    }

    case 'commit': {
      const decisions = draftFor({ fixture, state, weekId: action.weekId })
      const bookings = bookingsFor({ state, weekId: action.weekId })
      const plan = commitPlan({ weekId: action.weekId, decisions, bookings, demoDate: state.demoDate })
      // Rebuild history only for items this plan actually decided. An item
      // decided away from a deferral must lose its old record, or it resurfaces
      // forever on a stale rationale. An item still undisposed has decided
      // nothing, so its history must survive untouched.
      const history = { ...state.deferralHistory }
      const newRecords = new Map(deferralRecordsFrom(plan).map((r) => [r.itemId, r]))
      for (const [itemId, decision] of Object.entries(plan.decisions)) {
        if (decision.treatment === null) continue
        const others = (history[itemId] ?? []).filter((r) => r.weekId > plan.weekId)
        const record = newRecords.get(itemId)
        const next = record ? [...others, record] : others
        if (next.length === 0) delete history[itemId]
        else history[itemId] = next
      }
      return {
        ...state,
        draftByWeek: { ...state.draftByWeek, [action.weekId]: decisions },
        draftBookingsByWeek: { ...state.draftBookingsByWeek, [action.weekId]: bookings },
        committedByWeek: { ...state.committedByWeek, [action.weekId]: plan },
        deferralHistory: history,
      }
    }
```

The other cases (`advance-days`, `advance-to-next-review`, `reset`, `dismiss-notice`) are unchanged; `reset` already returns `initialState(fixture)`, which now includes the empty `draftBookingsByWeek`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- commit planReducer`
Expected: PASS, all cases, including the pre-existing ones.

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/domain/types.ts src/domain/commit.ts src/state/planReducer.ts src/domain/commit.test.ts src/domain/planReducer.test.ts
git commit -m "feat: draft, commit and reset replacement bookings alongside decisions"
```

---

### Task 6: `persistence.ts` validates the new fields

**Files:**
- Modify: `src/state/persistence.ts`
- Modify: `src/domain/persistence.test.ts`

**Interfaces:**
- Consumes: `AppState.draftBookingsByWeek`, `CommittedPlan.bookings`, `ReplacementBooking` (Task 1, 5).
- Produces: `loadState` now rejects (falls back to seed, with a notice) any stored state missing or malforming either field.

- [ ] **Step 1: Write the failing tests**

In `src/domain/persistence.test.ts`, update `validEnvelope`'s defaults to include the new field, so every existing "valid" case stays valid:

```ts
function validEnvelope(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 1,
    demoDate: '2026-09-28',
    draftByWeek: {},
    draftBookingsByWeek: {},
    committedByWeek: {},
    deferralHistory: {},
    storageNotice: null,
    ...overrides,
  })
}
```

Update `expectSeedEquivalent` to also check the new field:

```ts
function expectSeedEquivalent(actual: AppState) {
  const seed = initialState(fixture)
  expect(actual.version).toBe(seed.version)
  expect(actual.demoDate).toBe(seed.demoDate)
  expect(actual.draftByWeek).toEqual(seed.draftByWeek)
  expect(actual.draftBookingsByWeek).toEqual(seed.draftBookingsByWeek)
  expect(actual.committedByWeek).toEqual(seed.committedByWeek)
  expect(actual.deferralHistory).toEqual(seed.deferralHistory)
}
```

Add new entries to the `CORRUPT_PAYLOADS` array (after the existing `'demoDate is not a real date'` entry):

```ts
  {
    name: 'draftBookingsByWeek is a string instead of a map',
    payload: validEnvelope({ draftBookingsByWeek: 'garbage' }),
  },
  {
    name: 'a draft booking has a non-integer day count',
    payload: validEnvelope({
      draftBookingsByWeek: {
        '2026-09-28': { 'V-027': { vehicleId: 'V-027', startDate: '2026-09-29', days: 1.5 } },
      },
    }),
  },
  {
    name: 'a draft booking has a calendar-invalid start date',
    payload: validEnvelope({
      draftBookingsByWeek: {
        '2026-09-28': { 'V-027': { vehicleId: 'V-027', startDate: '2026-02-30', days: 1 } },
      },
    }),
  },
  {
    name: 'a committed plan is missing bookings entirely',
    payload: validEnvelope({
      committedByWeek: {
        '2026-09-28': { weekId: '2026-09-28', committedOn: '2026-09-28', decisions: {} },
      },
    }),
  },
```

Add a round-trip test for a real booking, inside the existing `describe('loadState', ...)` block (after the `'round-trips a real committed state'` test). First add a helper near `committedRealState`:

```ts
function committedRealStateWithBooking(): AppState {
  let s = reduce(initialState(fixture), {
    type: 'set-booking',
    weekId: '2026-09-28',
    booking: { vehicleId: 'V-027', startDate: '2026-09-29', days: 2 },
  })
  s = reduce(s, {
    type: 'set-decision',
    weekId: '2026-09-28',
    decision: {
      itemId: 'item-v041',
      treatment: 'watch',
      slotDate: null,
      deferral: {
        reason: 'No specialist cover this week.',
        reviewDate: '2026-10-05',
        trigger: { kind: 'event', eventId: 'v041-dtc-recurs', label: 'DTC P0300 recurs' },
      },
    },
  })
  return reduce(s, { type: 'commit', weekId: '2026-09-28' })
}
```

Then the test:

```ts
  it('round-trips a real committed booking through saveState', () => {
    withStoredValue(null, () => {
      const real = committedRealStateWithBooking()
      saveState(real)
      const loaded = loadState(fixture)
      expect(loaded).toEqual(real)
      expect(loaded.storageNotice).toBeNull()
    })
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- persistence`
Expected: FAIL. The new corrupt payloads currently pass validation (loaded as valid instead of falling back), and the round-trip test fails because `draftBookingsByWeek` and `bookings` are not yet checked.

- [ ] **Step 3: Extend the validator**

In `src/state/persistence.ts`, add `ReplacementBooking` and `VehicleId` to the type import:

```ts
import { parseISO, toISO } from '../domain/clock'
import { initialState, type AppState } from './planReducer'
import type {
  CommittedPlan,
  Deferral,
  DeferralRecord,
  DraftDecision,
  Fixture,
  ISODate,
  ReplacementBooking,
  Trigger,
  VehicleId,
} from '../domain/types'
```

Add `isReplacementBooking` and `isBookingsMap` after `isDecisionsMap`:

```ts
function isReplacementBooking(value: unknown): value is ReplacementBooking {
  if (!isPlainObject(value)) return false
  const { vehicleId, startDate, days } = value
  return (
    typeof vehicleId === 'string' &&
    isISODate(startDate) &&
    typeof days === 'number' &&
    Number.isInteger(days) &&
    days > 0
  )
}

function isBookingsMap(value: unknown): value is Record<VehicleId, ReplacementBooking> {
  return isPlainObject(value) && Object.values(value).every(isReplacementBooking)
}
```

Update `isCommittedPlan` to also require `bookings`:

```ts
function isCommittedPlan(value: unknown): value is CommittedPlan {
  if (!isPlainObject(value)) return false
  const { weekId, committedOn, decisions, bookings } = value
  return (
    isISODate(weekId) && isISODate(committedOn) && isDecisionsMap(decisions) && isBookingsMap(bookings)
  )
}
```

Update `isValidState` to also require `draftBookingsByWeek`:

```ts
function isValidState(value: Partial<AppState>): value is AppState {
  const { version, demoDate, draftByWeek, draftBookingsByWeek, committedByWeek, deferralHistory } = value
  return (
    version === CURRENT_VERSION &&
    isISODate(demoDate) &&
    isPlainObject(draftByWeek) &&
    Object.values(draftByWeek).every(isDecisionsMap) &&
    isPlainObject(draftBookingsByWeek) &&
    Object.values(draftBookingsByWeek).every(isBookingsMap) &&
    isPlainObject(committedByWeek) &&
    Object.values(committedByWeek).every((v) => v === null || isCommittedPlan(v)) &&
    isPlainObject(deferralHistory) &&
    Object.values(deferralHistory).every((v) => Array.isArray(v) && v.every(isDeferralRecord))
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- persistence`
Expected: PASS, all cases.

Run: `npm test && npm run build`
Expected: full suite and build both succeed. This is a good checkpoint since Tasks 1 through 6 complete the entire domain and state layer.

- [ ] **Step 5: Commit**

```bash
git add src/state/persistence.ts src/domain/persistence.test.ts
git commit -m "fix: validate stored replacement bookings, falling back to the seed on corruption"
```

---

### Task 7: `validatePlan` sees a booking as a lever

**Files:**
- Modify: `src/domain/validation.ts`
- Modify: `src/domain/validation.test.ts`

**Interfaces:**
- Consumes: `adHocCoversFrom` (Task 2), `computeWeekCapacity` with `adHocCovers` (Task 3).
- Produces: `validatePlan(args: { ...; bookings?: Record<VehicleId, ReplacementBooking> })`, defaults to `{}` so every existing call site is unchanged.

- [ ] **Step 1: Write the failing test**

Add to `src/domain/validation.test.ts`, after the `describe('cold open carries exactly two blockers', ...)` block:

```ts
describe('a requested booking clears a capacity blocker', () => {
  it('removes the Tuesday shortfall once a standard booking covers it', () => {
    const bookings = { 'V-027': { vehicleId: 'V-027', startDate: '2026-09-29', days: 1 } }
    const blockers = validatePlan({ fixture, weekId: WEEK_40, decisions: coldOpen(), bookings })
    expect(blockers.some((b) => b.kind === 'capacity-shortfall')).toBe(false)
  })

  it('does nothing for a booking on a different day', () => {
    const bookings = { 'V-027': { vehicleId: 'V-027', startDate: '2026-09-30', days: 1 } }
    const blockers = validatePlan({ fixture, weekId: WEEK_40, decisions: coldOpen(), bookings })
    expect(blockers.some((b) => b.kind === 'capacity-shortfall')).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- validation`
Expected: FAIL. `validatePlan` does not accept `bookings` yet (TS), or the shortfall is still reported.

- [ ] **Step 3: Thread bookings through `validatePlan`**

In `src/domain/validation.ts`, widen the imports:

```ts
import { computeWeekCapacity, isHeldOn } from './capacity'
import { formatDay } from './clock'
import { isDeferralComplete } from './deferral'
import { slotBlockers } from './feasibility'
import { adHocCoversFrom } from './replacementBooking'
import type { Blocker, DraftDecision, Fixture, ItemId, OpenItem, ReplacementBooking, VehicleId, WeekId } from './types'
import { visitsFromDecisions } from './visits'
```

Replace `validatePlan`:

```ts
export function validatePlan(args: {
  fixture: Fixture
  weekId: WeekId
  decisions: Record<ItemId, DraftDecision>
  bookings?: Record<VehicleId, ReplacementBooking>
}): Blocker[] {
  const { fixture, weekId, decisions, bookings = {} } = args
  // Every item the caller has a decision slot for, which is the week's queue.
  // Filtering on week.itemIds would skip resurfaced items entirely, since weeks
  // after the first author none of their own.
  const items = fixture.items.filter((i) => decisions[i.id] !== undefined)
  const visits = visitsFromDecisions(decisions, fixture.items)
  const adHocCovers = adHocCoversFrom(bookings, fixture.replacementDayRateEur)
  const out: Blocker[] = []

  for (const item of items) {
    const decision = decisions[item.id]
    if (!decision || decision.treatment === null) {
      out.push({ kind: 'undisposed-item', itemId: item.id })
      continue
    }
    if (decision.treatment === 'watch') {
      if (!isDeferralComplete(decision.deferral)) {
        out.push({ kind: 'undisposed-item', itemId: item.id })
      }
      continue
    }
    if (decision.slotDate === null) {
      out.push({ kind: 'undisposed-item', itemId: item.id })
      continue
    }
    out.push(...slotBlockers({ item, date: decision.slotDate, fixture, visits }))
  }

  for (const day of computeWeekCapacity({ fixture, weekId, visits, adHocCovers })) {
    if (day.shortfall > 0) {
      out.push({
        kind: 'capacity-shortfall',
        date: day.date,
        vehicleClass: day.vehicleClass,
        shortBy: day.shortfall,
        contributors: day.unavailable,
      })
    }
  }
  return out
}
```

The rest of the file (`canCommit`, `blockersForItem`, `describeBlocker`, `titleOf`) is unchanged.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- validation`
Expected: PASS, all cases, including every pre-existing one.

- [ ] **Step 5: Commit**

```bash
git add src/domain/validation.ts src/domain/validation.test.ts
git commit -m "feat: let a requested replacement clear a capacity blocker"
```

---

### Task 8: `fleetOverview` sees a booking as cover on site

**Files:**
- Modify: `src/domain/fleetStatus.ts`
- Modify: `src/domain/fleetStatus.test.ts`

**Interfaces:**
- Consumes: `adHocCoversFrom` (Task 2), `computeDayCapacity` with `adHocCovers` (Task 3).
- Produces: `fleetOverview(args: { ...; bookings?: Record<VehicleId, ReplacementBooking> })`, defaults to `{}`.

- [ ] **Step 1: Write the failing test**

Add to `src/domain/fleetStatus.test.ts`, after the `describe('fleet overview at cold open', ...)` block:

```ts
describe('a booking is reflected in tomorrow\'s coverage', () => {
  it('clears the Tuesday shortfall and lists the booking as cover on site', () => {
    const s = initialState(fixture)
    const weekId = activeWeekId(s)
    const decisions = draftFor({ fixture, state: s, weekId })
    const bookings = { 'V-027': { vehicleId: 'V-027', startDate: '2026-09-29', days: 1 } }
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
    expect(o.nextBusinessDay.coverOnSite).toContain('V-027 replacement')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- fleetStatus`
Expected: FAIL. `fleetOverview` does not accept `bookings` yet.

- [ ] **Step 3: Thread bookings through `fleetOverview`**

In `src/domain/fleetStatus.ts`, widen the imports:

```ts
import { computeDayCapacity, isHeldOn, weekFixtureFor } from './capacity'
import { addDays, daysBetween, formatDay, mondayOf } from './clock'
import { latestRecord } from './deferral'
import { adHocCoversFrom } from './replacementBooking'
import type {
  Blocker,
  CommittedPlan,
  Cover,
  DayCapacity,
  DeferralRecord,
  DraftDecision,
  Fixture,
  ISODate,
  ItemId,
  OpenItem,
  ReplacementBooking,
  Vehicle,
  VehicleClass,
  VehicleId,
  Visit,
} from './types'
import { orderQueue } from './urgency'
import { visitCoversDate, visitsFromDecisions } from './visits'
```

Replace `coverageFor`:

```ts
function coverageFor(date: ISODate, fixture: Fixture, visits: Visit[], adHocCovers: Cover[]): CoverageFacts {
  const week = weekFixtureFor(fixture, mondayOf(date))
  const classes: VehicleClass[] = ['standard', 'specialist']
  const days = classes.map((vehicleClass) =>
    computeDayCapacity({ date, vehicleClass, fixture, visits, week, adHocCovers }),
  )
  return {
    date,
    covered: days.every((d) => d.shortfall === 0),
    shortfalls: days.filter((d) => d.shortfall > 0),
    coverOnSite: [
      ...fixture.covers
        .filter((c) => week.coverIds.includes(c.id) && c.confirmedDates.includes(date))
        .map((c) => c.id),
      ...adHocCovers.filter((c) => c.confirmedDates.includes(date)).map((c) => c.id),
    ],
  }
}
```

Update `fleetOverview`'s signature and body (only the parts shown change; everything else in the function is unchanged):

```ts
export function fleetOverview(args: {
  fixture: Fixture
  today: ISODate
  queueItems: OpenItem[]
  decisions: Record<ItemId, DraftDecision>
  blockers: Blocker[]
  committed: CommittedPlan | null
  deferralHistory: Record<ItemId, DeferralRecord[]>
  bookings?: Record<VehicleId, ReplacementBooking>
}): FleetOverview {
  const { fixture, today, queueItems, decisions, blockers, committed, deferralHistory, bookings = {} } = args
  const adHocCovers = adHocCoversFrom(bookings, fixture.replacementDayRateEur)

  // A van turns red only for an operational fact: a hold, or a committed
  // visit. Coverage is a different question, and both its lines read the
  // draft, exactly as the band does, so no day of the active week can have a
  // second capacity semantics. [spec 4, 7]
  const committedVisits =
    committed === null ? [] : visitsFromDecisions(committed.decisions, fixture.items)
  const draftVisits = visitsFromDecisions(decisions, fixture.items)
```

(The `queueByVehicle`, `statusOf`, `statuses`, `attention`, `quiet`, `counts`, `awaitingDecision` sections below this are all unchanged.) Update the return statement's two `coverageFor` calls:

```ts
  return {
    attention,
    quiet,
    counts,
    onRoad: fixture.vehicles.length - counts.offRoad,
    awaitingDecision,
    today: coverageFor(today, fixture, draftVisits, adHocCovers),
    nextBusinessDay: coverageFor(nextBusinessDay(fixture, today), fixture, draftVisits, adHocCovers),
    committed: committed !== null,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- fleetStatus`
Expected: PASS, all cases, including every pre-existing one (the default `{}` keeps `overviewFor`'s existing calls in the test file numerically identical).

- [ ] **Step 5: Commit**

```bash
git add src/domain/fleetStatus.ts src/domain/fleetStatus.test.ts
git commit -m "feat: reflect a requested replacement in today and tomorrow's coverage"
```

---

### Task 9: `ReplacementBookingControl`, the shared request/summary component

**Files:**
- Create: `src/ui/ReplacementBookingControl.tsx`
- Modify: `src/ui/theme.css` (append)

**Interfaces:**
- Consumes: `usePlan` (`src/state/PlanProvider.tsx`), `activeWeekId` (`src/state/planReducer.ts`), `weekFixtureFor` (`src/domain/capacity.ts`), `replacementBookingErrors`/`bookingCostEur` (`src/domain/replacementBooking.ts`), `formatDay` (`src/domain/clock.ts`).
- Produces: `ReplacementBookingControl({ vehicleId: VehicleId; vehicleClass: VehicleClass })`, a self-contained component with no other required props: it reads the current draft booking from context and dispatches `set-booking`/`clear-booking` itself.

- [ ] **Step 1: Write the component**

Create `src/ui/ReplacementBookingControl.tsx`:

```tsx
import { useState } from 'react'
import { weekFixtureFor } from '../domain/capacity'
import { formatDay } from '../domain/clock'
import { bookingCostEur, replacementBookingErrors } from '../domain/replacementBooking'
import type { ReplacementBooking, VehicleClass, VehicleId } from '../domain/types'
import { usePlan } from '../state/PlanProvider'
import { activeWeekId } from '../state/planReducer'

/**
 * Freestanding from the maintenance queue: any standard-class vehicle can be
 * booked here, any time, for as little as a day. Mounted wherever a single
 * vehicle is already shown, rather than behind a new screen. [replacement
 * cover spec §2, §7.1]
 */
export function ReplacementBookingControl({
  vehicleId,
  vehicleClass,
}: {
  vehicleId: VehicleId
  vehicleClass: VehicleClass
}) {
  const { state, dispatch, fixture } = usePlan()
  const weekId = activeWeekId(state)
  const week = weekFixtureFor(fixture, weekId)
  const booking = state.draftBookingsByWeek[weekId]?.[vehicleId] ?? null
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<ReplacementBooking>>(
    booking ?? { vehicleId, startDate: week.days[0], days: 1 },
  )

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

  const errors = replacementBookingErrors(draft, { fixture, weekId })
  const previewDays = draft.days !== undefined && draft.days !== null && draft.days >= 1 ? draft.days : 0
  const previewCost = previewDays * fixture.replacementDayRateEur
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
        {editing && (
          <button className="ghost" onClick={() => setEditing(false)}>
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add its CSS**

Append to `src/ui/theme.css`:

```css
/* Replacement cover: the shared booking control, mounted per vehicle. */
.block .bookinginfo { font-size: 12px; color: var(--text); margin: 0 0 8px; }
```

- [ ] **Step 3: Verify it type-checks**

Run: `npm run build`
Expected: succeeds. The component is not yet mounted anywhere, so there is nothing to click yet; Task 10 wires it in.

- [ ] **Step 4: Commit**

```bash
git add src/ui/ReplacementBookingControl.tsx src/ui/theme.css
git commit -m "feat: add the replacement-cover request/summary control"
```

---

### Task 10: Mount the control, and thread bookings to capacity-aware UI

**Files:**
- Modify: `src/ui/ItemDetail.tsx`
- Modify: `src/ui/InspectPopover.tsx`
- Modify: `src/ui/FleetView.tsx` (`AttentionCard`)
- Modify: `src/ui/CapacityBand.tsx`
- Modify: `src/App.tsx`
- Modify: `src/ui/theme.css` (append)

**Interfaces:**
- Consumes: `ReplacementBookingControl` (Task 9); `bookingsFor` (Task 5); `adHocCoversFrom` (Task 2).
- Produces: every existing capacity-consuming UI surface (`CapacityBand`, `FleetView` via `validatePlan`/`fleetOverview`) now reflects live draft bookings; every vehicle-specific card gets the booking control.

- [ ] **Step 1: Mount in `ItemDetail`**

In `src/ui/ItemDetail.tsx`, add the import:

```ts
import { ReplacementBookingControl } from './ReplacementBookingControl'
```

Add the control after `<TreatmentForm ... />`, as the last line inside the returned `<div className="detail">`:

```tsx
      <TreatmentForm item={item} vehicle={vehicle} decision={decision} onChange={onChange} />

      <ReplacementBookingControl vehicleId={item.vehicleId} vehicleClass={vehicle.vehicleClass} />
    </div>
  )
}
```

- [ ] **Step 2: Mount in `InspectPopover`**

In `src/ui/InspectPopover.tsx`, add the import:

```ts
import { ReplacementBookingControl } from './ReplacementBookingControl'
```

Add the control between the closing `</dl>` and the `{itemId !== null ? ... : ...}` footer:

```tsx
      </dl>
      <ReplacementBookingControl vehicleId={vehicle.id} vehicleClass={vehicle.vehicleClass} />
      {itemId !== null ? (
```

- [ ] **Step 3: Restructure `AttentionCard` and mount there too**

In `src/ui/FleetView.tsx`, add the import:

```ts
import { ReplacementBookingControl } from './ReplacementBookingControl'
```

Replace the `AttentionCard` function. It stops being a `<button>` (a form cannot nest inside one); the navigation affordance becomes its own inner button:

```tsx
function AttentionCard({
  status,
  onOpenPlan,
}: {
  status: VanStatus
  onOpenPlan: (itemId: ItemId | null) => void
}) {
  const { fixture } = usePlan()
  const itemId = status.itemId
  const item = fixture.items.find((i) => i.id === itemId) ?? null
  const className = `acard ${status.kind === 'off-road' ? 'crit' : 'warn'}`

  return (
    <div className={className}>
      <div className="row1">
        <span className="vid">{status.vehicleId}</span>
        {item !== null && item.safetyClass && <span className="badge safety">Safety · hard stop</span>}
        {status.kind === 'off-road' && <span className="badge">Off the road</span>}
        {status.vehicleClass === 'specialist' && <span className="badge specialist">Specialist</span>}
        {item !== null && (
          <span className={`urg ${item.urgency.kind}`}>{urgencyLabel(item.urgency.kind)}</span>
        )}
      </div>
      {item !== null && <div className="title">{item.title}</div>}
      <div className="why">
        {status.kind === 'off-road' ? status.facts.join(' · ') : item !== null ? item.urgency.because : ''}
      </div>
      {itemId !== null && (
        <button className="go" onClick={() => onOpenPlan(itemId)}>
          Open in week plan →
        </button>
      )}
      <ReplacementBookingControl vehicleId={status.vehicleId} vehicleClass={status.vehicleClass} />
    </div>
  )
}
```

Update the CSS in `src/ui/theme.css`. Find this existing block:

```css
.acard {
  display: block; text-align: left; background: var(--surface);
  border: 1px solid var(--border); border-left-width: 4px; border-radius: var(--r);
  padding: 9px 11px 9px 13px;
}
/* Only the navigating cards are buttons. An informational card must not
   offer a hover affordance it cannot honour. */
button.acard:hover { border-color: var(--border-strong); }
.acard.crit { border-left-color: var(--crit); }
.acard.warn { border-left-color: var(--warn); }
.acard .row1 { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-bottom: 3px; }
.acard .title { font-size: 12.5px; margin-bottom: 5px; }
.acard .why { font-size: 11.5px; color: var(--muted); }
.acard .go { margin-top: 6px; font-size: 11px; font-weight: 600; color: var(--accent); }
```

Replace it with:

```css
.acard {
  display: block; text-align: left; background: var(--surface);
  border: 1px solid var(--border); border-left-width: 4px; border-radius: var(--r);
  padding: 9px 11px 9px 13px;
}
/* Every card now carries the booking control, so every card has some
   interactive content; the hover affordance is no longer conditional on
   being a button. */
.acard:hover { border-color: var(--border-strong); }
.acard.crit { border-left-color: var(--crit); }
.acard.warn { border-left-color: var(--warn); }
.acard .row1 { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-bottom: 3px; }
.acard .title { font-size: 12.5px; margin-bottom: 5px; }
.acard .why { font-size: 11.5px; color: var(--muted); }
.acard .go {
  display: block; margin: 6px 0 0; padding: 0; background: none; border: none;
  font-size: 11px; font-weight: 600; color: var(--accent); text-align: left;
}
.acard .block { margin-top: 8px; }
```

- [ ] **Step 4: Thread `bookings` through `CapacityBand`**

In `src/ui/CapacityBand.tsx`, update the imports:

```tsx
import { computeWeekCapacity, weekFixtureFor } from '../domain/capacity'
import { formatDay } from '../domain/clock'
import { adHocCoversFrom } from '../domain/replacementBooking'
import type { DayCapacity, DraftDecision, ISODate, ItemId, ReplacementBooking, VehicleId } from '../domain/types'
import { visitsFromDecisions } from '../domain/visits'
import { usePlan } from '../state/PlanProvider'
import { activeWeekId } from '../state/planReducer'
```

Update the component signature and the capacity call:

```tsx
export function CapacityBand({
  decisions,
  selectedItemId,
  bookings,
}: {
  decisions: Record<ItemId, DraftDecision>
  selectedItemId: ItemId | null
  bookings: Record<VehicleId, ReplacementBooking>
}) {
  const { state, fixture } = usePlan()
  const weekId = activeWeekId(state)
  const week = weekFixtureFor(fixture, weekId)
  const visits = visitsFromDecisions(decisions, fixture.items)
  const adHocCovers = adHocCoversFrom(bookings, fixture.replacementDayRateEur)
  const rows = computeWeekCapacity({ fixture, weekId, visits, adHocCovers })
```

The rest of `CapacityBand` (the `cellFor`, `selected`, `shortDays`, `spareDays`, `covers`, `hasSpecialistCover`, and the whole JSX return) is unchanged.

- [ ] **Step 5: Wire `bookings` through `App.tsx`**

In `src/App.tsx`, update the imports:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { validatePlan } from './domain/validation'
import type { ItemId } from './domain/types'
import { hasSeenCoverNote, markCoverNoteSeen } from './state/coverNoteSeen'
import { usePlan } from './state/PlanProvider'
import { activeWeekId, bookingsFor, draftFor } from './state/planReducer'
import { CapacityBand } from './ui/CapacityBand'
import { CommitSummary } from './ui/CommitSummary'
import { CoverNote } from './ui/CoverNote'
import { DecisionQueue } from './ui/DecisionQueue'
import { DemoBar } from './ui/DemoBar'
import { FleetView } from './ui/FleetView'
import { ItemDetail } from './ui/ItemDetail'
import { NavTabs } from './ui/NavTabs'
import { PlanHeader } from './ui/PlanHeader'
```

Add a `bookings` memo next to the existing `decisions` memo, and thread it into `blockers`:

```tsx
  const decisions = useMemo(() => draftFor({ fixture, state, weekId }), [fixture, state, weekId])
  const bookings = useMemo(() => bookingsFor({ state, weekId }), [state, weekId])
  const blockers = useMemo(
    () => validatePlan({ fixture, weekId, decisions, bookings }),
    [fixture, weekId, decisions, bookings],
  )
```

Pass `bookings` to `FleetView` and `CapacityBand`:

```tsx
      {tab === 'fleet' ? (
        <FleetView decisions={decisions} blockers={blockers} bookings={bookings} onOpenPlan={openPlan} />
      ) : (
        <>
          <PlanHeader
            blockers={blockers}
            decisions={decisions}
            onCommit={() => {
              dispatch({ type: 'commit', weekId })
              setPlanView('summary')
            }}
            onSelectItem={setSelectedItemId}
          />
          <CapacityBand decisions={decisions} selectedItemId={selectedItemId} bookings={bookings} />
```

Everything else in `App.tsx` is unchanged.

Update `FleetView`'s own signature to accept the new prop. This project builds with `noUnusedParameters`, so `bookings` cannot merely be accepted, it must be read immediately: thread it into the existing `overview` memo's `fleetOverview` call right here, in the same step (Task 11 adds a second, new memo for cost; it does not need to touch this one again). In `src/ui/FleetView.tsx`:

```tsx
export function FleetView({
  decisions,
  blockers,
  bookings,
  onOpenPlan,
}: {
  decisions: Record<ItemId, DraftDecision>
  blockers: Blocker[]
  bookings: Record<VehicleId, ReplacementBooking>
  onOpenPlan: (itemId: ItemId | null) => void
}) {
```

Add `ReplacementBooking` and `VehicleId` to `FleetView.tsx`'s existing type import:

```ts
import type { Blocker, DraftDecision, ItemId, ReplacementBooking, VehicleId } from '../domain/types'
```

Update the existing `overview` memo to pass `bookings` through to `fleetOverview` (Task 8's new optional parameter) and add it to the dependency array:

```tsx
  const overview = useMemo(
    () =>
      fleetOverview({
        fixture,
        today: state.demoDate,
        queueItems: queueFor({ fixture, state, weekId }).map((e) => e.item),
        decisions,
        blockers,
        committed: state.committedByWeek[weekId] ?? null,
        deferralHistory: state.deferralHistory,
        bookings,
      }),
    [fixture, state, weekId, decisions, blockers, bookings],
  )
```

- [ ] **Step 6: Verify manually**

Run: `npm run dev`, then in the browser:

1. Open the fleet view. Click a quiet (green) van. Confirm the popover now shows a "Replacement cover" block with a start-date select and a days input.
2. Pick Tuesday (29 Sep), 1 day, click "Request replacement". Confirm the popover switches to "Booked 1 day from Tue 29 Sep · EUR 140".
3. Switch to the week plan tab. Confirm the capacity band's Tuesday standard cell now reads one higher than before (38/38, not short), and the "short by 1" flag is gone.
4. Open an attention card (e.g. `V-041`). Confirm it still opens the week plan on click, and also shows its own "Replacement cover" block below the "why" line.
5. Click a specialist van (e.g. any `V-039`..`V-045`). Confirm its block reads "No specialist replacement cover exists" and offers no form.

Run: `npm test && npm run build`
Expected: both succeed.

- [ ] **Step 7: Commit**

```bash
git add src/ui/ItemDetail.tsx src/ui/InspectPopover.tsx src/ui/FleetView.tsx src/ui/CapacityBand.tsx src/App.tsx src/ui/theme.css
git commit -m "feat: mount the replacement-cover control on every vehicle surface"
```

---

### Task 11: Dashboard cost section

**Files:**
- Modify: `src/ui/FleetView.tsx`
- Modify: `src/ui/theme.css` (append)

**Interfaces:**
- Consumes: `costSummaryFor` (Task 4), `activeWeekId` (already imported), `bookings` prop (Task 10).
- Produces: a "This week's cost" section on the fleet dashboard, reading the live draft.

- [ ] **Step 1: Add the section**

In `src/ui/FleetView.tsx`, add the import:

```ts
import { costSummaryFor } from '../domain/costs'
```

Inside `FleetView`, add a second memo right after the existing `overview` one (which Task 10 already threaded `bookings` through):

```tsx
  const cost = useMemo(
    () => costSummaryFor({ fixture, weekId, decisions, bookings }),
    [fixture, weekId, decisions, bookings],
  )
```

Add a new `fleetsection` after the existing "In service today" section, immediately before the closing `</>` of the component's return:

```tsx
      <div className="fleetsection">
        <h2>This week's cost</h2>
        <div className="costs">
          <div className="cost">
            <div className="n">EUR {cost.serviceCostEur.toLocaleString('en-GB')}</div>
            <div className="l">Service cost</div>
          </div>
          <div className="cost">
            <div className="n">EUR {cost.coverCostEur.toLocaleString('en-GB')}</div>
            <div className="l">Replacement cover</div>
          </div>
          <div className={`cost${cost.overByEur !== null ? ' over' : ''}`}>
            <div className="n">EUR {cost.totalEur.toLocaleString('en-GB')}</div>
            <div className="l">
              {cost.overByEur !== null
                ? `EUR ${cost.overByEur.toLocaleString('en-GB')} over the EUR ${cost.budgetEur.toLocaleString('en-GB')} budget`
                : `Of a EUR ${cost.budgetEur.toLocaleString('en-GB')} weekly budget`}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Add the over-budget CSS**

Append to `src/ui/theme.css`:

```css
.cost.over { border-color: #e8bdb9; background: var(--crit-soft); }
.cost.over .n { color: var(--crit); }
```

- [ ] **Step 3: Verify manually**

Run: `npm run dev`. On the fleet view, confirm "This week's cost" shows EUR 0 / EUR 0 / EUR 0 of a EUR 3,000 budget at cold open (nothing is visited in the draft's proposed state before any decision is applied... note: the seeded proposals do place three items as `act-now` with a slot, so confirm the actual seeded number instead of assuming zero, and record it). Book two or three replacements from different vans (from Task 10's popovers) until the total figure turns red and reads "EUR _ over the EUR 3,000 budget". Confirm Commit is still clickable while over budget.

Run: `npm test && npm run build`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add src/ui/FleetView.tsx src/ui/theme.css
git commit -m "feat: show this week's cost against budget on the fleet dashboard"
```

---

### Task 12: Commit summary cost section

**Files:**
- Modify: `src/ui/CommitSummary.tsx`

**Interfaces:**
- Consumes: `costSummaryFor` (Task 4), `bookingCostEur` (Task 2), `plan.bookings` (Task 5).
- Produces: a "Cost against budget" section on the committed-plan summary, frozen at commit time, plus a list of requested bookings.

- [ ] **Step 1: Add the section**

In `src/ui/CommitSummary.tsx`, add the imports:

```ts
import { formatDay } from '../domain/clock'
import { costSummaryFor } from '../domain/costs'
import { bookingCostEur } from '../domain/replacementBooking'
import { summaryFor } from '../domain/commit'
import { usePlan } from '../state/PlanProvider'
import { activeWeekId } from '../state/planReducer'
import { DailyConfirmation } from './DailyConfirmation'
```

Compute the cost summary and the booking list inside `CommitSummary`, right after `const summary = summaryFor({ fixture, plan })`:

```tsx
  const summary = summaryFor({ fixture, plan })
  const cost = costSummaryFor({ fixture, weekId: plan.weekId, decisions: plan.decisions, bookings: plan.bookings })
  const bookingRows = Object.values(plan.bookings).sort((a, b) => a.vehicleId.localeCompare(b.vehicleId))
```

Add a new `<section>` after the existing "Cover assumptions" section and before "Deferred follow-ups":

```tsx
      <section>
        <h3>Cost against budget</h3>
        <div className="costs">
          <div className="cost">
            <div className="n">EUR {cost.serviceCostEur.toLocaleString('en-GB')}</div>
            <div className="l">Service cost</div>
          </div>
          <div className="cost">
            <div className="n">EUR {cost.coverCostEur.toLocaleString('en-GB')}</div>
            <div className="l">Replacement cover</div>
          </div>
          <div className={`cost${cost.overByEur !== null ? ' over' : ''}`}>
            <div className="n">EUR {cost.totalEur.toLocaleString('en-GB')}</div>
            <div className="l">
              {cost.overByEur !== null
                ? `EUR ${cost.overByEur.toLocaleString('en-GB')} over the EUR ${cost.budgetEur.toLocaleString('en-GB')} budget`
                : `Of a EUR ${cost.budgetEur.toLocaleString('en-GB')} weekly budget`}
            </div>
          </div>
        </div>
        {bookingRows.length > 0 && (
          <ul>
            {bookingRows.map((b) => (
              <li key={b.vehicleId}>
                {b.vehicleId}: {b.days} {b.days === 1 ? 'day' : 'days'} from {formatDay(b.startDate)}, EUR{' '}
                {bookingCostEur(b, fixture.replacementDayRateEur).toLocaleString('en-GB')}
              </li>
            ))}
          </ul>
        )}
      </section>
```

No new CSS is needed: `.costs`/`.cost`/`.cost.over` come from Task 11, and `.summary ul`/`.summary section > h3` already exist.

- [ ] **Step 2: Verify manually**

Run: `npm run dev`. Book a replacement for a quiet van, go to the week plan, resolve the two seeded blockers (move `V-118` to Thursday, defer `V-041`), commit. Confirm the commit summary shows "Cost against budget" with the three figures and a line listing the booked vehicle, its days and its cost.

Run: `npm test && npm run build`
Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add src/ui/CommitSummary.tsx
git commit -m "feat: show cost against budget and requested bookings in the commit summary"
```

---

### Task 13: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Full automated suite**

Run: `npm test`
Expected: PASS, every suite, domain and state layers included.

Run: `npm run build`
Expected: succeeds, writes `dist/`.

- [ ] **Step 2: Manual walkthrough, from the spec's own checklist [spec §10]**

Run: `npm run dev`, fresh profile (clear site storage first), then:

1. Request a replacement from all three entry points: the fleet grid (a quiet van's popover), an attention card, and the plan surface (`ItemDetail`).
2. Confirm a requested booking clears a real shortfall: book a standard van for Tuesday, confirm the capacity band and the fleet dashboard's tomorrow line both clear.
3. Confirm cost appears on the dashboard before commit and updates live as bookings are added or cancelled.
4. Resolve the two seeded blockers, commit, and confirm the commit summary shows the frozen total and the booking list.
5. Book enough replacements to push the total over the EUR 3,000 budget and confirm Commit stays enabled, with the over-budget figure shown in both the dashboard (pre-commit) and the commit summary (post-commit).
6. Click Reset in the demo bar and confirm every draft and committed booking clears, on both the fleet and plan tabs.
7. Confirm a specialist vehicle's control stays disabled with its reason throughout, and that requesting one is impossible from any of the three entry points.

- [ ] **Step 3: Confirm no regressions in the existing five-minute walkthrough**

Follow `README.md`'s existing walkthrough (fleet view → week plan → move `V-118` → schedule and defer `V-041` → commit → advance the clock → reset) once more, end to end, to confirm nothing in this feature disturbed it.

- [ ] **Step 4: Record what changed**

No commit for this task; it is verification only. If any step above surfaces a defect, open a follow-up task (fix, add a regression test if the defect was domain-layer, re-run this task's steps) rather than folding an undiagnosed fix into this checklist.
