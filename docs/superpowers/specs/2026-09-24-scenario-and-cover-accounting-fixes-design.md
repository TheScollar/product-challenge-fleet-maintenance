# Scenario and Cover Accounting Fixes: Design Spec

Six observations from using the build, resolved as one coherent change: the week opens with an
undecided backlog and the system's proposal is adopted by hand; a replacement booking belongs to a
service visit and is requested only from the weekly plan; cover cost exists only where a replacement
was actually requested; the fleet dashboard shows a committed replacement as a fact about the van; and
the capacity figures show own vans and rentals as separate numbers instead of one total that can
exceed the fleet.

**Status.** Approved in brainstorming on 2026-09-24. Amends four earlier specs at the points stated in
§12; where this document and an earlier spec disagree, this document wins and the earlier spec carries
a dated amendment pointing here, following the precedent of `2026-09-23-cover-note-design.md`.

**Reference convention.** A bare `§n` points into this document. `[RC §n]` points into
`2026-09-24-replacement-cover-design.md`, `[P §n]` into
`2026-09-23-fleet-maintenance-prototype-design.md`, `[D §n]` into
`2026-09-23-guided-queue-declutter-design.md`, `[FO §n]` into `2026-09-23-fleet-overview-design.md`,
`[SD §n]` into `2026-09-24-staged-item-decisions-design.md`, `[C §n]` into
`2026-09-23-cover-note-design.md`, and `[WP §n]` into `fleet-maintenance-work-packages.md`.

**Where each reported point lands.**

| Reported | Section |
| --- | --- |
| The dashboard should only show whether a replacement is running, not request one | §5.1, §6 |
| Thursday 1 Oct reads 39 available | §7 |
| The detail view shows a replacement cover cost before anything was requested | §5.5 |
| A watched item must not add service or cover cost to the budget | §5.3, §5.6 |
| Two items arrive already settled; the backlog should open undecided | §3, §4 |
| V-012 carries EUR 700 of replacement cover nobody requested | §5.5, §5.6 |

---

## 1. Why this exists

Every one of the six observations traces to one of three root causes.

**The fixture decided for the user.** `draftFor` in `src/state/planReducer.ts` seeds each week-40 item
with `item.proposal` as its draft decision, so `V-012` arrives booked for Tuesday and `V-027` arrives
watched with a complete deferral, both sitting in `Settled` before anyone has looked at them. The
work packages store the proposal separately from the user's choice precisely so that "neither
overwrites the other" **[WP §4]**; seeding one into the other blurred that line.

**Cover cost was authored by hand, per item.** `Consequence.coverCostEur` in the fixture holds a number
the author estimated for each item: `700` for `V-012` (five days of R-1 at EUR 140), `140` for the
one-day visits, `0` for `V-027`. `costSummaryFor` added those figures to the weekly total for every
visited item, and `ConsequenceBlock` displayed them, so a "Replacement cover" figure appeared before
any replacement was requested, and `V-012` showed EUR 700 the moment it was opened. The replacement
cover feature **[RC]** then added real, requested bookings on top of those estimates, so the same
tile mixed an authored guess with an actual decision.

**A replacement was a freestanding purchase.** The replacement cover spec made the request "available
for any standard-class vehicle, at any time, independent of whether that vehicle has an open
maintenance item" **[RC §2]**, and mounted the control on every surface a vehicle appears on
**[RC §7.1]**, including the dashboard's attention cards and the inspect popover. In use, that made the
dashboard a place to buy cover rather than a place to see the fleet, and it let a booking outlive the
visit it was meant to cover: watching an item left its booking, and its cost, in place.

The Thursday figure is different: it is not a defect. Thursday has 38 owned standard vans, `V-012`
held, and both R-1 and R-2 confirmed, so 39 drivable vans against a demand of 38 is the truth, and the
prototype design's own cold-open table lists it as "1 spare" **[P §4]**. What the band lacked was a
way to show where a number larger than the fleet comes from.

## 2. What it is, and what it is not

**It is** a scenario that opens honestly undecided, with the system's proposal one click away; a
replacement cover model in which a booking is a consequence of a visit and can be requested only
where the visit is decided; a cost rollup that charges only what was actually requested; a dashboard
that reports a committed replacement as a fact about the van, the same way it reports a hold or a
workshop day; and capacity cells that read `37 + 2 / 38`.

**It is not** a change to what blocks a commit. `validatePlan` is untouched: an undecided item still
blocks Commit, a capacity shortfall still blocks Commit, and a blocked plan is still a legitimate
outcome **[WP E2.5]**. It is not a change to the budget figure, the day rate, or the pre-confirmed
cover R-1 and R-2, which stay fixture inputs. It is not a change to the demand counts or to any
vehicle, item or hold in the fixture beyond deleting the hand-authored cover cost.

**Rejected alternatives**, each considered in brainstorming and not taken:

- *Cap a day's available count at the owned fleet size.* A rental would then only ever backfill an
  outage, and Thursday would read `38 / 38`. Rejected because it hides a true fact (two rentals are on
  site) and removes the green candidate-day cue that points at Thursday as the day to move a visit
  to. This is what the parallel Codex attempt built; its patch is kept for reference (§13).
- *Pre-stage the proposal into the detail pane, with the draft left open.* One click per item, but the
  user would have to notice that the form arrived filled in. Rejected in favour of an explicit
  `Use proposal` action, so adoption is visible and deliberate.
- *Show draft (uncommitted) bookings on the dashboard.* Rejected: the dashboard's per-van facts come
  from operational reality, a hold or a committed visit **[FO §4]**, and a request nobody has
  committed is a plan, not a fact. The cost tiles keep reading the draft, as they already do, because
  they are explicitly labelled as this week's live cost.
- *Keep bookings freestanding but exclude them from cost while the item is watched.* Rejected as a
  half-measure: the booking would linger with no visit to cover, and the user would have to remember
  it exists. A booking belongs to a visit, so it goes when the visit goes.
- *Two specs (cover v2, and the scenario) or starting from the Codex patch.* Rejected in favour of one
  spec and one plan, because the two topics share the detail pane, the fixture and most of the tests.

## 3. The backlog opens undecided

### 3.1 Seeding (`src/state/planReducer.ts`)

`draftFor` seeds every queue entry, authored or resurfaced, as
`{ itemId, treatment: null, slotDate: null, deferral: null }`. The `existing` overlay from
`state.draftByWeek` is unchanged, so anything the user has applied still wins. The distinction the
function currently draws between authored items (seeded from the proposal) and resurfaced items
(seeded open) disappears: both open undecided, and a resurfaced item's earlier rationale stays visible
through `QueueEntry.priorDecision` exactly as today **[WP E6.4]**.

### 3.2 Adopting a proposal (`src/domain/recommendation.ts`, `src/ui/TreatmentForm.tsx`)

A new pure function:

```ts
export function adoptProposal(item: OpenItem): DraftDecision
// { itemId, treatment: proposal.treatment, slotDate: proposal.slotDate,
//   deferral: proposal.treatment === 'watch' ? proposal.deferral : null }
```

The `Proposed: …` line moves out of `AssumptionBlock` and into the top of the Treatment block, where
the action it recommends is taken, with a ghost button `Use proposal` beside it. `AssumptionBlock`
keeps the assumption text and its null-assumption paragraph unchanged. Clicking `Use proposal` calls
`onChange(adoptProposal(item))` and resets the form's local deferral fields to
`item.proposal.deferral ?? {}`, so a watch proposal (`V-027`) arrives with rationale, review date and
trigger filled in and editable. Nothing reaches the plan until `Apply to draft`, per the staging
model **[SD §2]**. The button is disabled, with the existing `watchUnavailableReason()` as its title,
in the structural case where a proposal names a treatment the item does not allow; no fixture item
triggers that today.

For `V-041` the proposal has no slot (`Assess. A diagnostic visit is proposed, and a slot has not
been chosen yet.`). `Use proposal` selects Act now and leaves the day to the user; `Apply to draft`
stays disabled until one is chosen, which is the existing rule **[SD §2]**.

### 3.3 Staging guards

Three guards that the seeding used to mask:

- `SlotPicker` renders only when the staged treatment is `act-now` or `bundle`. Today it renders
  whenever the treatment is not `watch`, including `null`, so a day could be picked before any
  treatment was chosen.
- `TreatmentForm`'s `canApply` additionally requires `decision.treatment !== null`. Today a picked
  slot alone enables Apply, which would dispatch a decision with a slot and no treatment.
- `visitsFromDecisions` in `src/domain/visits.ts` counts a decision as a visit only when its
  treatment is `act-now` or `bundle` and its slot is set. Today it excludes only `watch`, so a
  treatment-less decision with a slot would already be a visit in every capacity computation.
  Structural, not trusting, as `deferralRecordsFrom` already is.

### 3.4 The cold open that results

Nothing is planned. Every day is covered: standard reads `37 + 1 / 38` on Monday, Wednesday and
Friday, `37 + 2 / 38` with `+1` on Tuesday and Thursday (§7), specialist `7 / 7` throughout. The
flagline reads "Every day is covered. Spare capacity on Tue 29 Sep, Thu 1 Oct". The queue is one
group, `To decide · 5` (§4); the header carries one amber chip, `5 to decide`; Commit is disabled.
The dashboard is unchanged at cold open: one red van (`V-012`, held), four amber, "5 items waiting
for week 40", and cost tiles at EUR 0 against the EUR 3,000 budget, because nothing is decided.

Adopting the three Tuesday proposals (`V-012`, `V-103`, `V-118`) reproduces the scripted conflict:
Tuesday reads `35 + 2 / 38`, short by 1, `V-103` and `V-118` move to `Blocking the week`, `V-012`
settles (a held van is never blamed for a shortfall its visit cannot affect, `blockersForItem`
**[P §4.5]**), and the walkthrough continues exactly as before from "move `V-118` to Thursday". The
story is intact; the user now produces it.

### 3.5 Persisted state

A browser that ran the current build holds week-40 drafts seeded from the proposals, so without
intervention it would keep showing two settled items after this change. `CURRENT_VERSION` in
`src/state/persistence.ts` moves from `1` to `2`, and `AppState.version` with it. `loadState` already
handles a version mismatch by returning the seed with the demo-bar notice "Saved state was written by
an older build. Reset to the seed." **[P §5.2]**, which is the honest outcome here. The storage key
is unchanged.

## 4. Queue grouping and header chips

The declutter spec reserved a third group for exactly this case: "a future relaxation of validation
gets a third group for free" **[D §4]**. Validation is not relaxed, but the classification is.

**`classifyItem`** (`src/ui/grouping.ts`) considers only capacity, slot and parts blockers as
"blocking". An item with a hard blocker is `blocking`. An item with no treatment, a watch without a
complete deferral, or a visit treatment without a slot is `open`. Everything else is `settled`.
Groups render in the order blocking, open, settled, with labels `Blocking the week`, `To decide`,
`Settled`. Within a group the order is `orderQueue`'s, which already ranks undecided items above
shortfall contributors and below safety-class items, unchanged.

**Tone.** `To decide` uses the amber the dashboard already defines for "a decision still waiting"
(`--warn`): an amber group header, an amber left border on `.card.open`, and amber rather than red for
the statuses `No decision`, `No slot chosen` and `Watch, incomplete` in `dispositionLabel`. Red keeps
meaning a hard blocker: `Causes Tue shortfall`, `Slot not bookable`. Green and muted are unchanged
**[D §3, §6]**.

**Chips** (`blockerChips`, `PlanHeader`). Hard blockers keep one red chip each, unchanged. Undisposed
blockers collapse into one amber chip when there are two or more: `5 to decide`, targeting the first
undecided item in queue order. With exactly one, the chip reads `V-041 · no decision` as today.
`BlockerChip` gains `tone: 'crit' | 'warn'`; the collapsed chip takes the position of the first
undisposed blocker in `validatePlan`'s order. Commit stays disabled while any chip is showing, because
`canCommit` is unchanged.

## 5. A replacement belongs to a visit

### 5.1 Where the control lives

`ReplacementBookingControl` is mounted in one place, `ItemDetail`, and only when the item's applied
decision is a visit: treatment `act-now` or `bundle` with a slot, read from `decisions[item.id]`, not
from the staged decision. It is removed from `InspectPopover` and from `AttentionCard` in
`FleetView`. The card stays a `<div>` with its `Open in week plan` button; only the control and its
`.acard .block` spacing go. The popover returns to the read-only inspection it was specified as
**[FO §6]**.

### 5.2 The control's states

| State | Rendering |
| --- | --- |
| No applied visit, item not watched | One line in the block: `Apply a visit before requesting a replacement.` |
| No applied visit, item watched | One line: `Not needed while this vehicle is watched.` |
| Applied visit, specialist vehicle | `No specialist replacement cover exists.` (unchanged copy) |
| Applied visit, no booking | Collapsed: `No replacement requested.` and a primary `Request replacement` button |
| Form (after `Request replacement`, or `Change`) | Start date defaults to the applied slot date, days to `item.visitDays`, both editable within the week; live `Downtime: N days · EUR X`; errors from `replacementBookingErrors`; `Request replacement` submits, `Cancel` returns to the previous state |
| Applied visit, booking exists | Summary `Booked N days from <day> · EUR X` with `Change` and `Cancel booking` (unchanged) |

The control receives the applied visit's slot date as a prop for its defaults. A held van still gets
week-long cover by editing the days: `V-012`, held Monday to Friday, can be booked for five days from
Monday even though its visit is one day.

### 5.3 The reducer drops a booking that lost its visit (`src/state/planReducer.ts`)

`set-decision` already normalises a decision (a deferral is dropped when the treatment is not watch).
It gains a second normalisation: when the incoming decision is not a visit (treatment is `null` or
`watch`, or the slot is `null`), the vehicle's entry in `draftBookingsByWeek[weekId]` is deleted.
`set-booking` ignores a booking for a vehicle whose current draft has no visit, returning the state
unchanged, so no action sequence can store a booking without a visit. Switching an item to watch
therefore removes both its service cost (already true: no visit, no cost) and its cover cost (the
booking is gone).

### 5.4 Every reader filters structurally (`src/domain/replacementBooking.ts`)

```ts
export function bookingsForVisits(
  bookings: Record<VehicleId, ReplacementBooking>,
  visits: Visit[],
): Record<VehicleId, ReplacementBooking>
```

keeps only bookings whose vehicle has a visit in the given list. Every consumer of bookings passes
through it before doing anything else: `costSummaryFor`, `validatePlan`, `CapacityBand`, the coverage
lines and the new per-van facts in `fleetOverview` (§6), `summaryFor` and `dailyConfirmation`
(§6). A stale booking in persisted state, or one that arrives by any route other than the reducer,
adds neither capacity nor cost. Same principle as `deferralRecordsFrom`: structural, not trusting.

### 5.5 The Consequence tile (`src/domain/types.ts`, `fixture.ts`, `consequence.ts`, `ItemDetail.tsx`)

`Consequence.coverCostEur` is deleted from the type and from all seven fixture items.
`coverUnavailable` stays: it is what makes `V-041` read `not available` rather than a number, the
point the cover note defends **[C §3.6]**. `consequenceView(item, requestedCoverCostEur)` renders the
Replacement cover figure as:

- `not available` when `coverUnavailable` is true;
- `not requested` when no booking exists for the item's vehicle in the applied draft;
- `EUR n`, the booking's cost via `bookingCostEur`, otherwise.

`ItemDetail` supplies the figure from `bookingsForVisits(draftBookings, draftVisits)[item.vehicleId]`.
Service cost is unchanged: it stays the fixture's estimate, shown before any decision, because it is
the number the decision is weighed against. Operational disruption stays a count **[C §3.6]**.
`V-012`'s EUR 700 therefore appears only if the user books five days for it.

### 5.6 The weekly total (`src/domain/costs.ts`)

```
serviceCostEur = Σ item.consequence.serviceCostEur over items with a visit this week
coverCostEur   = Σ bookingCostEur(b) over bookingsForVisits(bookings, visits)
```

R-1 and R-2 never appear in the total. They are pre-approved, pre-confirmed fixture cover
**[WP §5]**, the way the budget itself is a fixture input; the weekly budget measures what this
week's plan adds. The replacement cover spec's sizing rationale, a canonical committed total of EUR
2,420 **[RC §3.1]**, still holds if the user requests the same cover the old fixture assumed (five
days for `V-012`, one each for `V-103` and `V-118`); it is no longer automatic. `budgetEur` stays EUR
3,000. Both call sites, the dashboard and the commit summary, keep using this one function
**[RC §4.2]**.

## 6. The dashboard shows a committed replacement as a fact

`fleetOverview` in `src/domain/fleetStatus.ts` gains one more source of per-van facts, read from the
committed plan only: `bookingsForVisits(committed.bookings, committedVisits)`. For a van with such a
booking:

| Relation of `today` to the booking | Fact |
| --- | --- |
| Inside `[startDate, startDate + days)` | `Replacement on site · day n of m` |
| Before `startDate` | `Replacement booked <day> · m days` |
| After the last day | No fact |

The fact is appended to `planFacts`, so a red van shows it after `Held · …` or
`In workshop · …` on its attention card, a green van shows it as the tile sub-label when it is the
first fact and in the popover's Status line in full, and an amber van shows nothing, as amber vans
carry no facts by construction **[FO §4]**. A draft request never produces a fact: the dashboard
reports what has been committed, the rule `In workshop` and `Booked` already follow.

The today and tomorrow coverage lines, and the header's `on site` list, keep reading the draft,
filtered to visiting vehicles, so they agree with the band **[FO §4, §7]**. That split is the one the
fleet overview already makes for visits: coverage arithmetic from the draft, operational facts from
the committed plan.

**Commit summary and daily confirmation** (`src/domain/commit.ts`). `summaryFor`'s forward
availability and `dailyConfirmation`'s rows pass the committed plan's visit-bound bookings into
`computeWeekCapacity` and `computeDayCapacity` as `adHocCovers`, and `coverInUse` lists them beside
R-1 and R-2. Today both ignore bookings, so a committed replacement that cleared Tuesday in the band
vanished from the summary's availability table.

## 7. Capacity figures: own vans and rentals, separately

`DayCapacity` already carries `owned`, `unavailable`, `cover`, `available` and `demand`, so the
domain does not change. One formatter joins them:

```ts
export function capacityFigure(day: DayCapacity): string
// own = owned - unavailable.length
// cover > 0  → `${own} + ${cover} / ${demand}`   e.g. 37 + 2 / 38
// cover = 0  → `${own} / ${demand}`              e.g. 7 / 7
```

in `src/domain/capacity.ts`, next to the computation it describes, tested like the rest of the file.
Three surfaces use it: the band's `Cell`, the commit summary's forward availability, and the daily
confirmation row. The band's caption becomes `Week capacity · own + rental / demand`. The `+1` and
`short 1` sub-lines, the red and green cell fills, and the impacted and candidate day outlines all
still key off `available` against `demand` **[D §6]**, so Thursday keeps its `+1` and its green
outline, and the flagline's wording is unchanged. Each cell gains a `title` tooltip naming the parts:
`38 owned · off the road: V-012 · rentals on site: R-1, R-2`.

The header's cover legend is unchanged: `R-1 Mon to Fri · R-2 Tue and Thu only · V-118 replacement
Tue only · no specialist cover`.

## 8. Behaviour

| Trigger | Result |
| --- | --- |
| Cold open, or reset | Five items in `To decide`, nothing planned, every day covered, `5 to decide` chip, Commit disabled, cost tiles at EUR 0 |
| Saved state from an older build is found | Seed loads, demo bar shows the older-build notice |
| Open an item | Treatment block shows `Proposed: …` with `Use proposal`; no treatment selected; no slot picker |
| `Use proposal` | Treatment, slot and deferral fields stage from the proposal; band previews; `Apply to draft` enabled if the proposal is complete |
| Choose Act now or Bundle | Slot picker appears |
| `Apply to draft` with a visit | Item moves to `Settled` or `Blocking the week`; Replacement cover block collapses to `No replacement requested · Request replacement` |
| `Request replacement`, submit | Booking stored; band, coverage lines, cost tiles and the Consequence tile's cover figure update live |
| Apply Watch, or clear the treatment, on an item with a booking | Booking removed; block reads `Not needed while this vehicle is watched.` or `Apply a visit before requesting a replacement.`; cost drops accordingly |
| Commit | Decisions and visit-bound bookings snapshot; summary's availability and daily confirmation include the bookings; dashboard shows `Replacement booked …` or `Replacement on site …` on the van |
| Advance the clock past a booking's last day | The van's replacement fact disappears |
| Inspect a van on the dashboard | Popover shows facts only; no request control anywhere on the dashboard |

## 9. Architecture summary

| File | Responsibility |
| --- | --- |
| `src/state/planReducer.ts` | `draftFor` seeds every entry open; `set-decision` drops a lost visit's booking; `set-booking` ignores a vehicle without a visit; `AppState.version: 2` |
| `src/state/persistence.ts` | `CURRENT_VERSION = 2`; validator accepts the new version literal |
| `src/domain/recommendation.ts` | `adoptProposal`; `recommendationFor(item, requestedCoverCostEur)` |
| `src/domain/consequence.ts` | Cover figure from the requested booking: `not available`, `not requested`, or `EUR n` |
| `src/domain/types.ts` | Removes `Consequence.coverCostEur` |
| `src/domain/fixture.ts` | Removes the seven `coverCostEur` values; nothing else changes |
| `src/domain/visits.ts` | A visit requires `act-now` or `bundle` and a slot |
| `src/domain/replacementBooking.ts` | `bookingsForVisits` |
| `src/domain/costs.ts` | Service from visited items; cover from visit-bound bookings only |
| `src/domain/validation.ts` | Filters bookings through `bookingsForVisits` before computing capacity |
| `src/domain/fleetStatus.ts` | Per-van replacement facts from the committed plan; coverage lines filter draft bookings |
| `src/domain/commit.ts` | `summaryFor` and `dailyConfirmation` include committed visit-bound bookings as cover |
| `src/domain/capacity.ts` | `capacityFigure` |
| `src/ui/grouping.ts` | Three groups; undisposed blockers are `open`, not `blocking`; chip collapse and tone |
| `src/ui/ItemCard.tsx` | Amber tone for undecided and incomplete states; `.card.open` border |
| `src/ui/PlanHeader.tsx` | Renders chip tone |
| `src/ui/TreatmentForm.tsx` | `Proposed: …` line and `Use proposal`; `canApply` requires a treatment |
| `src/ui/AssumptionBlock.tsx` | Loses the `Proposed:` line |
| `src/ui/ItemDetail.tsx` | Slot picker only for a visit treatment; mounts the booking control only for an applied visit; supplies the requested cover figure |
| `src/ui/ReplacementBookingControl.tsx` | Collapsed state; defaults from the applied visit; `Cancel` in the form |
| `src/ui/InspectPopover.tsx`, `src/ui/FleetView.tsx` | Control removed; `AttentionCard` shows its facts as today |
| `src/ui/CapacityBand.tsx`, `src/ui/CommitSummary.tsx`, `src/ui/DailyConfirmation.tsx` | Render `capacityFigure`; band caption and cell tooltip |
| `src/ui/theme.css` | `.card.open`, `.grouptitle.warn`, `.bchip.warn`, `.status.warn`; drops `.acard .block` |

## 10. Edge cases

- **A resurfaced item** opens undecided, shows `Previously: watch, decided …` with its rationale, and
  offers `Use proposal` for the fixture's original proposal. The two are different things and are
  shown as such.
- **A proposal without a slot** (`V-041`) stages Act now only; Apply waits for a day.
- **Moving a visit's slot after booking cover** keeps the booking as the user set it. The booking's
  dates are the user's decision; the visit moving does not silently rewrite them. The band and the
  legend show where the cover actually falls.
- **Watching, then returning to a visit** does not restore the earlier booking. It was removed when
  the visit went; the user requests again if still needed.
- **A booking for a held van** is allowed for any days in the week, not just the visit day, because
  the hold is what takes the van off the road. `V-012` is the case.
- **Committed booking, draft later edited to watch.** The dashboard keeps showing the committed
  replacement fact until recommit, matching how `Booked` persists for a committed visit **[FO §4]**;
  the cost tile, reading the draft, drops the cost at once. This is the existing draft-versus-committed
  split, not a new inconsistency.
- **Stale or hand-edited persisted bookings** are filtered by `bookingsForVisits` at every read, and a
  wrong version literal resets to the seed with the notice.
- **`bundle`** is a visit treatment in every rule above, identical to `act-now`.
- **Specialist rows** never show a `+ n` term because no specialist cover exists in the fixture; if
  one were authored, the formatter would show it without change.

## 11. Testing

Vitest over the domain and state layers, the UI verified live, as everywhere in this repo.

- `planReducer.test.ts`: every seeded entry is open, authored and resurfaced alike; `set-decision` to
  watch or to no treatment removes the vehicle's booking; `set-booking` for a vehicle without a visit
  is a no-op; commit snapshots only what the draft holds; `version` is 2.
- `persistence.test.ts`: a stored `version: 1` payload loads the seed with the older-build notice.
- `recommendation.test.ts`: `adoptProposal` for a visit proposal, a watch proposal and the slotless
  `V-041`; `consequenceView` reads `not requested` with no booking, `EUR 280` with a two-day booking,
  `not available` for `V-041` regardless of booking.
- `visits.ts` (new cases in `capacity.test.ts` or a small `visits.test.ts`): a slot with no treatment
  is not a visit; `bundle` is.
- `replacementBooking.test.ts`: `bookingsForVisits` keeps visiting vehicles only.
- `costs.test.ts`: cold open totals zero; adopting every proposal yields service EUR 1,440 and cover
  EUR 0; a booking for a visiting vehicle adds its cost; a booking for a watched vehicle adds nothing;
  the over-budget arithmetic is unchanged.
- `validation.test.ts`: a booking clears the Tuesday shortfall only when its vehicle has a visit.
- `fleetStatus.test.ts`: cold-open counts unchanged (1 red, 4 amber, 5 awaiting); a committed
  five-day booking on `V-012` reads `Replacement on site · day 1 of 5` on Monday and `day 2 of 5`
  on Tuesday; a committed Thursday booking reads `Replacement booked Thu 1 Oct · 1 day` on Monday;
  a draft booking produces no fact; a booking whose last day has passed produces no fact.
- `commit.test.ts`: forward availability and the daily confirmation include a committed booking as
  cover, and `coverInUse` lists it.
- `capacity.test.ts`: `capacityFigure` renders `37 + 2 / 38` and `7 / 7`; the Thursday `available`
  of 39 is unchanged and now asserted alongside its figure.
- `grouping.test.ts`: cold open renders a single `To decide` group of five and one `5 to decide` chip
  targeting `V-012`; after adopting the four adoptable proposals the groups are `Blocking the week`
  (`V-103`, `V-118`), `To decide` (`V-041`), `Settled` (`V-012`, `V-027`) and the chips are
  `Tue 29 Sep · standard short 1` and `V-041 · no decision`; the cleared week renders `Settled` alone.
- `scenarios.test.ts`: `resolvedState()` adopts every proposal through `adoptProposal`, then moves
  `V-118` and defers `V-041` as today; scenario 2 asserts the deferral after adoption; scenario 3's
  "before" state is the adopted one. The ten scenarios keep their meaning.
- `testSupport.ts`: `coldOpenDecisions()` is replaced by `proposedDecisions()`, built from
  `adoptProposal` over the week's authored items, so the tests and the button share one definition of
  adoption.

**Live browser checks at the end of the task**, against `npm run dev`:

1. Cold open: five undecided items, `5 to decide`, band cells reading `37 + 1 / 38` and
   `37 + 2 / 38`, Thursday and Tuesday green, cost tiles at EUR 0, no booking control on any dashboard
   surface.
2. `Use proposal` then `Apply to draft` on `V-012`, `V-103`, `V-118`: Tuesday turns red at
   `35 + 2 / 38`, chips read `Tue 29 Sep · standard short 1` and `V-041 · no decision`.
3. Open `V-012`: Consequence reads `not requested`; the block reads `No replacement requested`;
   request five days from Monday; Consequence reads `EUR 700`; dashboard cost tile reads EUR 700 cover.
4. Switch `V-118` to Watch and apply: its booking, if any, is gone and the tiles drop; return it to
   Act now Thursday.
5. Complete the walkthrough and commit: the summary's forward availability shows the booking as cover;
   the dashboard shows `Replacement on site · day 1 of 5` on `V-012`'s red card and in no other place.
6. Reload with the old build's saved state present: the older-build notice appears and the seed loads.

## 12. Documentation updates

Each amendment is a dated paragraph in place, in the convention `2026-09-23-cover-note-design.md`
already uses (`**Amended 2026-09-24 for …**`), pointing here.

- `2026-09-24-replacement-cover-design.md`: §2 (no longer freestanding; a booking belongs to a
  visit), §6 (behaviour rows for the dashboard surfaces are superseded), §7.1 (one mount point, not
  three), §3.1 (the EUR 2,420 sizing rationale is conditional on the user requesting that cover),
  §12 (the dashboard control joins the not-built list).
- `2026-09-23-fleet-maintenance-prototype-design.md` §4: the cold-open capacity table now describes
  the state after adopting every proposal; the true cold open has no visits.
- `2026-09-23-guided-queue-declutter-design.md` §4: the third group now occurs, with its tone and the
  collapsed chip.
- `2026-09-23-fleet-overview-design.md` §4 and §6: the replacement facts; the popover no longer
  carries a control.
- `2026-09-23-cover-note-design.md` §3.5 and `src/ui/coverNoteContent.ts`, which is canonical for the
  app and mirrors that section: the paragraph beginning "Two things block the week" is replaced by
  one that describes the open backlog, along the lines of: *Five decisions wait, and none is taken
  for you. Each carries the system's proposal; adopt it or choose differently. Take the three Tuesday
  proposals as they come and Tuesday goes one van short, because three standard vans would be off the
  road at once and the rental cover only stretches to two of them: moving one visit clears it. V-041,
  the only specialist van in the queue, has no proposed day at all. No specialist cover exists this
  week, so scheduling it leaves an assignment uncovered that nothing available can fill.* The closing
  line becomes "The plan cannot be committed until every item is decided and the blockers are
  cleared."
- `README.md`: walkthrough steps 1 to 3 (the dashboard no longer flags tomorrow's shortfall at cold
  open; the week opens with five decisions and none taken; the user adopts the three Tuesday
  proposals and watches Tuesday turn red), a new step requesting five days of cover for `V-012` and
  seeing the cost tile and, after commit, the dashboard fact; the test count; a "Decisions taken"
  bullet, *The system proposes, the user decides*, stating that the backlog opens undecided and a
  replacement is a consequence of a visit.
- `docs/acceptance.md`: an addendum in the existing form, recording the live checks of §11 and the
  new test count, and noting that G1's cold-open evidence (the band flagging Tuesday at cold open) now
  applies after adoption rather than before.
- `src/domain/costs.ts`'s header comment: cover cost is requested cost only.

## 13. Build placement

Built in a worktree branched from `main` at `ba6ef6d`, which is clean. The parallel Codex attempt's
uncommitted diff, reverted when that session was paused, is preserved at
`.superpowers/sdd/codex-fleet-scenario-fixes-2026-09-24.patch` (an ignored path, local only). It is
reference material for mechanics that match this spec (removing the control from the dashboard,
deleting `coverCostEur`, `bookingsForVisits`, the committed-plan availability fix) and is not applied
as a whole: it caps available at owned, which §2 rejects, and it lacks `Use proposal`, the
`capacityFigure` split, the committed-only dashboard fact and the amber `To decide` tone. Exact task
order is resolved in the implementation plan.

## 14. Not built

| Not building | Reason |
| --- | --- |
| Capping a day's available count at the owned fleet | Hides a true fact and the candidate-day cue; the split figure explains instead (§2, §7) |
| Draft bookings on the dashboard | The dashboard reports committed facts; the cost tiles already show the live draft (§2, §6) |
| Freestanding bookings for vans without a visit | A replacement is a consequence of a visit; the held van is covered through its visit's item (§5) |
| Pool cover R-1 and R-2 in the weekly total | Pre-approved fixture inputs, like the budget itself (§5.6) |
| Automatic adoption of the proposal | The point of the change is that the user decides (§3) |
| Relaxing what blocks Commit | An undecided item still blocks; only its grouping and tone change (§4) |
| Restoring a booking when a watched item returns to a visit | The booking went with the visit; requesting again is one click (§10) |
| A second per-vehicle booking, an editable budget, specialist cover | Unchanged from the replacement cover spec's not-built list **[RC §12]** |
