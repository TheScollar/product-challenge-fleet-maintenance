# Replacement Cover: Design Spec

A working flow to decide whether a vehicle gets a rented replacement, request it, see its downtime
and cost, and see that cost rolled up against a weekly budget on both the dashboard and the
committed plan.

**Status.** Approved in brainstorming on 2026-09-24. Scope beyond the build contract in
`docs/fleet-maintenance-work-packages.md`, accepted deliberately. Where this document and the work
packages disagree, the divergence is stated at the point it occurs, following the precedent set by
`2026-09-23-cover-note-design.md` and `2026-09-23-fleet-overview-design.md`.

**Reference convention.** A bare `§n` points into this document. `[WP §n]` points into
`fleet-maintenance-work-packages.md`. `[C §n]` points into `2026-09-23-cover-note-design.md`.

---

## 1. Why this exists

Replacement cover exists in the built product exactly once, as a fact rather than a decision:
`V-012` happens to be held for dates that R-1 already covers, so its consequence reads "None. R-1
covers this van for the whole week." Nobody chose that. No screen ever asks whether to get a
replacement, shows what it would cost, or shows what it would cost against anything.

The original work packages cut this on purpose: "Cover is a fixed, confirmed, pre-approved fixture
input. Obtaining it is a different job with a different user" **[WP §5]**, and "no rental-purchasing
UI exists" is stated twice **[WP §5, §4]**. This spec reverses that cut. The evaluation now wants the
decision in the loop, not just its outcome, for any vehicle, not only the one the fixture already
resolved.

## 2. What it is, and what it is not

**It is** a small, freestanding "request a replacement" action available for any standard-class
vehicle, at any time, for as little as a single day, independent of whether that vehicle has an open
maintenance item. It is a cost rollup, service cost plus cover cost combined into one total, shown
live on the fleet dashboard as decisions are made and frozen in the commit summary once committed,
measured against a per-week virtual budget.

**It is not** a route to specialist cover. `V-041`'s scenario, no compatible cover exists at any
price, is unchanged; this spec deliberately limits requests to standard-class vehicles, because
resolving that shortfall on demand would remove the one scenario in this build that has no lever at
all **[C §3.6]**. It is not a hard spending cap: going over budget warns, it never blocks Commit,
because a budget is a judgment call in a way a capacity shortfall or a missing part is not. It is not
a new kind of capacity resource: a requested booking is admitted into the exact same pool R-1 and R-2
already occupy, not a parallel mechanism the capacity engine has to learn twice.

**Rejected alternatives**, all considered and not taken:

- *A dedicated replacement-cover tab.* One place to see and manage every booking. Rejected because a
  third nav surface cuts against this app's existing one-entry-point stance; the control travels to
  wherever the vehicle already appears instead of vehicles travelling to it.
- *A modal booking dialog.* Rejected on the same grounds the cover note rejected an overlay
  elsewhere **[C §4]**: it would also lose the contextual "I am already looking at this van" flow,
  forcing a vehicle picker for what should be a one-click action from an already-open card.
  Everything else on this codebase's changed surfaces stays a card the user already has open.
- *An editable budget.* Considered, because the demo bar already exposes Reset and date-advance as
  controls. Rejected to keep the budget a scenario input like day rates and demand, authored once and
  legible from the fixture, not a setting a reviewer has to discover.
- *Specialist replacement cover*, and *a hard block on Commit when over budget*: both addressed in
  §2 above.

## 3. Domain model

### 3.1 Types (`src/domain/types.ts`)

```ts
export interface ReplacementBooking {
  vehicleId: VehicleId
  startDate: ISODate
  days: number   // 1..5, must fit inside the active week's authored days
}
```

Only the decision is stored. Cost and downtime are both derived from `days`, not stored redundantly,
matching the existing principle in `README.md`: "Decisions are stored, everything else is derived."
`days` **is** the downtime figure the request asks about: how long the replacement is needed for. It
is not computed from a hold or a visit, because §1's scope decision (any vehicle, freestanding, dates
picked by hand) means no such source of truth necessarily exists for a given request.

`Fixture` gains `replacementDayRateEur: number`, proposed **EUR 140**, matching R-1 and R-2's existing
rate rather than inventing a second number for the same kind of vehicle. `WeekFixture` gains
`budgetEur: number`; `Fixture` gains `defaultBudgetEur: number` for unauthored weeks, following the
exact fallback `weekFixtureFor` already applies to `demand` and `coverIds`.

Proposed **EUR 3,000 for week 40's `budgetEur`, and the same for `defaultBudgetEur`.** The canonical
walkthrough's committed total, `V-012`, `V-103` and `V-118` each contributing service and cover cost,
`V-041` and `V-027` contributing nothing this week because they end up watched, is EUR 2,420. That
default sits comfortably under budget, and one or two ad hoc bookings (EUR 140 to EUR 700 apiece) are
enough to demonstrate going over it. The figure is a fixture edit if a tighter or looser default is
wanted later.

### 3.2 `src/domain/replacementBooking.ts`

- `replacementBookingErrors(draft, args): string[]`: missing vehicle or start date, non-positive
  `days`, a range that overruns the active week, or a vehicle whose class is not `standard`. The
  class check is structural, not just a UI affordance: see §8.
- `bookingAsCover(booking, dayRateEur): Cover`: a `Cover`-shaped view of one booking (`vehicleClass:
  'standard'`, `confirmedDates` expanded from `startDate`/`days`, `dayRateEur`), so `capacity.ts`
  never has to know a second kind of cover exists.

## 4. Capacity and cost calculation

### 4.1 Capacity (`src/domain/capacity.ts`)

`computeDayCapacity` and `computeWeekCapacity` gain an optional `adHocCovers: Cover[]` parameter,
default `[]`, merged with `fixture.covers` before the existing class-and-date filter runs. The filter
itself does not change. A requested booking clears a shortfall exactly the way R-1 or R-2 already do,
because after the merge it is indistinguishable from them to every downstream computation.

### 4.2 Cost rollup (`src/domain/costs.ts`, new)

```ts
export interface CostSummary {
  serviceCostEur: number    // sum over items with a scheduled visit this week
  coverCostEur: number      // item-level coverCostEur (visited items only) + booking costs
  totalEur: number
  budgetEur: number
  overByEur: number | null  // totalEur - budgetEur when positive, else null
}

export function costSummaryFor(args: {
  fixture: Fixture
  weekId: WeekId
  decisions: Record<ItemId, DraftDecision>
  bookings: Record<VehicleId, ReplacementBooking>
}): CostSummary
```

"Visited items only" reuses `visitsFromDecisions` directly, the same source `summaryFor` already
reads, so an item watched or left undecided never contributes a cost it has not yet incurred.

One function serves both call sites: the fleet dashboard, over the live draft, and the commit
summary, over the committed plan. This repo has already paid once for two surfaces computing the
same fact two different ways (`5bbdec1`, `25dee47`, one capacity semantics for the fleet overview).
Costs get one function from the start rather than a second copy to reconcile later.

Operational disruption stays exactly as it is: a count, never money, never part of this total
**[C §3.6]**. This spec combines service cost and cover cost into one budget figure, a deliberate,
narrower departure from "the three cost figures stay apart" **[C §3.6]**, made because the budget's
subject is spend, and disruption is not spend.

## 5. State lifecycle

`AppState` gains `draftBookingsByWeek: Record<WeekId, Record<VehicleId, ReplacementBooking>>`.
`CommittedPlan` gains `bookings: Record<VehicleId, ReplacementBooking>`. Two new actions,
`set-booking` and `clear-booking`, parallel to `set-decision`. `commitPlan` snapshots bookings the
same deep-copy way it already snapshots decisions, so editing the draft afterwards leaves the last
committed booking set untouched until recommit, matching `commit.ts`'s existing guarantee for
decisions.

`reset` already returns `initialState`, so bookings clear for free. `App.tsx` threads bookings down
exactly as it threads `decisions`: a direct read of `state.draftBookingsByWeek[weekId] ?? {}`, no
seeding needed, since no booking has a default the way a treatment has a proposal.

`src/state/persistence.ts`'s structural validator gains the two new fields. Missing or malformed data
defaults to an empty record, the same safe-default behaviour the validator already applies elsewhere;
it never throws on a shape it does not recognise.

## 6. Behaviour

| Trigger | Result |
| --- | --- |
| Vehicle shown (fleet grid, attention card, or plan surface), no draft booking this week, standard class | Inline form: start date, number of days, live "Downtime: N days · EUR X" preview |
| Vehicle is specialist class | Control shown disabled, with a stated reason. No form |
| Submit a valid form | Draft booking stored. Capacity and cost recalculate live everywhere they're shown |
| Vehicle already has a draft booking this week | Compact summary line, plus **Change** (reopens the form, prefilled) and **Cancel booking** |
| Cancel booking | Draft booking removed. Capacity and cost recalculate live |
| Commit | Draft bookings snapshot into the committed plan, same moment as decisions |
| Edit plan, after commit | Draft bookings return to their committed values, editable again |
| Reset | All draft and committed bookings clear, same as decisions |
| Live or committed total exceeds `budgetEur` | Cost section shows an explicit EUR-over figure, warning-styled. Commit stays enabled |

## 7. UI

### 7.1 `src/ui/ReplacementBookingControl.tsx` (new)

One component, taking a vehicle, its current draft booking if any, the active week, and an
`onChange`/`onClear` pair. Renders the states in §6. Mounted in three places:

1. **`InspectPopover.tsx`**, below the existing vehicle facts. Covers every van reachable from the
   fleet grid.
2. **`AttentionCard`** inside `FleetView.tsx`, for off-road and needs-decision vans. This card is
   currently a single `<button>` that navigates to the plan; a form cannot nest inside a button, so
   the card becomes a `<div>` with "Open in week plan" as its own inner button and the booking
   control as a sibling. The only markup change this spec makes to an existing component.
3. **`ItemDetail.tsx`**, alongside `TreatmentForm`, for vehicles reached through the plan surface.

### 7.2 Dashboard (`src/ui/FleetView.tsx`)

A new `fleetsection`, "This week's cost": service cost plus cover cost, the total, against
`budgetEur`, reusing the existing `.crit`/`.warn` stat styling for the over-budget state rather than
introducing new colours. Reads the live draft, via `costSummaryFor`, so it updates as decisions and
bookings change, before anything is committed.

### 7.3 Commit summary (`src/ui/CommitSummary.tsx`)

A new section, "Cost against budget": the same shape, frozen at commit time, plus a short list of
which vehicles carry a requested booking (vehicle, dates, cost), styled like the existing deferrals
and holds lists.

## 8. Edge cases and validation

- A booking for a vehicle already fully covered by R-1 for those dates is still allowed. Redundant
  spend is a judgment call for the user, not a system error, consistent with §2's stance on budget.
- One active booking per vehicle per week, not a list. Requesting again replaces the draft, the same
  behaviour `set-decision` already has for a treatment choice.
- A booking cannot extend outside the active week's authored days; `replacementBookingErrors` rejects
  a range that overruns it. Bookings are not modelled across a week boundary.
- Specialist exclusion is enforced twice: the control disables itself, and
  `replacementBookingErrors` also rejects a non-standard vehicle class structurally, so the rule does
  not rely on the UI alone. This matches the existing "structural, not trusting" pattern in
  `deferralRecordsFrom`.
- A booking is never garage-bay constrained. A rental replacement does not occupy Werkstatt Berg's
  bays; only the depot's own visits do.

## 9. Architecture summary

| File | Responsibility |
| --- | --- |
| `src/domain/types.ts` | `ReplacementBooking`; new fields on `Fixture`, `WeekFixture`, `CommittedPlan` |
| `src/domain/replacementBooking.ts` | Validation, the `Cover` adapter |
| `src/domain/capacity.ts` | Gains `adHocCovers` parameter on both compute functions |
| `src/domain/costs.ts` | `costSummaryFor`, the one function both surfaces call |
| `src/domain/fixture.ts` | `replacementDayRateEur`, `budgetEur`, `defaultBudgetEur` |
| `src/state/planReducer.ts` | `draftBookingsByWeek`, `set-booking`, `clear-booking`, commit/reset coverage |
| `src/state/persistence.ts` | Validates and defaults the two new fields |
| `src/ui/ReplacementBookingControl.tsx` | New. The form/summary control, all three states in §6 |
| `src/ui/InspectPopover.tsx` | Mounts the control |
| `src/ui/FleetView.tsx` | `AttentionCard` restructured to mount the control; new cost section |
| `src/ui/ItemDetail.tsx` | Mounts the control |
| `src/ui/CommitSummary.tsx` | New cost-against-budget section |
| `src/App.tsx` | Threads `bookings` alongside `decisions` |

## 10. Testing

Following the split already established in this repo, Vitest over the domain and state layers, UI
verified manually:

- `src/domain/replacementBooking.test.ts`: every validation error, the `Cover` adapter's shape, the
  standard-only guard.
- `src/domain/capacity.test.ts`: extended so an ad hoc cover clears a shortfall exactly like R-1 or
  R-2 does.
- `src/domain/costs.test.ts`: sums are visit-gated, over-budget arithmetic is correct, one function
  produces the same figure for both call sites given the same inputs.
- `src/domain/planReducer.test.ts`: set/clear, commit snapshot, reset, all extended for bookings.
- `src/domain/persistence.test.ts`: absent and malformed booking data both default safely.

**Manual checks at the end of the task:**

1. Request a replacement from all three entry points: the fleet grid, an attention card, and the
   plan surface.
2. Confirm a requested booking clears a real shortfall (Tuesday, per the existing scenario).
3. Confirm cost appears on the dashboard before commit and updates live as bookings change.
4. Confirm the commit summary shows the frozen total and booking list after Commit.
5. Push the total over `budgetEur` and confirm Commit stays enabled, with the over-budget figure
   shown.
6. Confirm Reset clears every draft and committed booking.
7. Confirm a specialist vehicle's control stays disabled throughout.

## 11. Build placement

Sits after the fleet overview work. Every file it touches already exists; nothing here is blocked on
unbuilt work. Exact task numbering is resolved in the implementation plan, not here.

## 12. Not built

| Not building | Reason |
| --- | --- |
| Specialist replacement cover | Preserves `V-041`'s existing "no lever closes it" scenario, per §2 |
| An editable or configurable budget | Kept as a fixture input, consistent with day rates and demand |
| A hard block on Commit when over budget | A judgment call, not an operational impossibility, per §2 |
| A dedicated replacement-cover tab | A third surface against this app's one-entry-point stance, per §2 |
| A modal booking dialog | This app has avoided modals elsewhere; the contextual flow is worth more |
| Multiple concurrent bookings per vehicle per week | One active booking keeps the model simple; a second request replaces the first |
| Booking cover beyond the active week's days | Bookings stay inside one week's grid, matching how the rest of the plan is scoped |
| Garage-bay constraints on a booking | A rental van does not occupy the depot's own bays |
