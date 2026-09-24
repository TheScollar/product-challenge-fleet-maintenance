# M4 — Bundle vs. Split: Technical Design

**Date:** 2026-09-24
**Status:** Approved for implementation planning
**Extends:** `fleet-maintenance-prototype-design.md` (the M0 design) and implements the M4 candidate named in
`fleet-maintenance-work-packages.md` §6.3 and §7, E5.3: *"Bundle or split: the trade-off shown honestly."*

## 0. What this document is

E5.3 was deferred out of the M0–M3 committed scope: *"E7 (interruption) and E5.3 (bundle versus split) stay
as stated future work, walked through verbally"* [prototype-design.md §1]. The prototype has since reached
M3. This document designs the M4 slice: bundle becomes a real, chooseable treatment with an honest
bundle-vs-split comparison at decision time, and its outcome is visible on the fleet dashboard once the
committed date is reached.

Nothing here changes the M0–M3 behaviour for `act-now` or `watch`. Every change is additive to the existing
domain model and fixture — no existing item, week, or record is edited (§2).

## 1. Scope

**In scope:**
- A real bundle-vs-split comparison, computed and shown honestly, at the point the user picks a treatment.
- Two or more open items on the same vehicle can share one visit when the user deliberately links them.
- The fleet dashboard (`FleetView`) shows a bundled visit distinctly, both before and during the visit.
- One concrete, fully-authored scenario that exercises this: `V-027`'s existing "service already booked for
  2 Nov" narrative becomes literal.

**Out of scope (unchanged from the M0 design's non-goals):**
- A general "propose the best bundle automatically" optimiser. E5.3 is explicitly *"a judgement package, not
  an optimiser"* [work-packages.md §7, E5.3] — the product must never silently stack items onto one visit.
- Bundling across more than two items, or across different garages/vehicles.
- Changing how `watch` or plain `act-now` behave.

## 2. Scenario and fixture changes

`V-027`'s evidence already states *"Next scheduled service 2 Nov 2026"* and its consequence text already
says *"Bundling this into the service already booked for 2 Nov avoids a separate visit"* — but today that
service is prose, not a modelled item. This design makes it real.

**New item**, `item-v027-service`, on the existing vehicle `V-027`:

| Field | Value | Why |
| --- | --- | --- |
| `title` | "Scheduled service" | Matches the existing evidence text on `item-v027`. |
| `garageId` | `werkstatt-berg` | Same garage as every other seed item; no new garage introduced. |
| `urgency.kind` | `deadline` | A known calendar date, not a discovered defect — the one case `UrgencyKind` already models for this. |
| `urgency.relevantDate` | `2026-11-02` | Matches `item-v027`'s own `relevantDate`. |
| `safetyClass` | `false` | Routine service, not a safety finding. |
| `parts` | `null` | Kept simple; the "might run long" risk is carried as stated text in the comparison (§4), not by a parts constraint. |
| `visitDays` | `1` | Routine service. |
| `proposal` | `{ treatment: 'act-now', slotDate: '2026-11-02', deferral: null }` | System default: book the known date. |
| `consequence.serviceCostEur` | `320` | A standalone routine-service figure, distinct from the €95 *bundled* figure already on `item-v027`; in the same range as `item-v118`'s own service-interval item (€340), the closest existing analogue. Gives the "split" side of the comparison a real number instead of a placeholder. |

**No edit to the existing `item-v027` is needed.** `V-103` sets `canExtendToDays: 2` on its own item, but
nothing in the current codebase reads that field anywhere — it has no consumer today (confirmed by
searching the source), and the design spec's own commentary ties it to the multi-day arithmetic case that's
*"retained as a test even though E7 is out of scope."* Wiring it up here would mean building new logic that
belongs to E7 (interruption), which this design does not include. The "may run long" risk is instead stated
as plain text in the comparison (§4) — honest, but not a claim that any visit's day count changes
automatically. This also means `V-027`, the one deferral the docs call out as staying defensible to the
end, needs zero edits: every change in this design is additive.

**New week**, `weekId: '2026-11-02'` (confirmed a Monday — exactly five weeks after the `2026-09-28` cold
open, on the same Monday-boundary pattern as `WEEK_40`/`WEEK_41`):

```
{
  weekId: '2026-11-02',
  days: weekDays('2026-11-02'),
  demand: fixture.defaultDemand,   // 38 standard / 7 specialist, matching WEEK_41
  coverIds: ['R-1'],               // matching WEEK_41
  itemIds: ['item-v027-service'],
}
```

When the user clicks the existing "Advance to next review date" control, the demo clock jumps straight to
`2026-11-02`. `item-v027` resurfaces through the existing, unmodified E6.4 mechanism (`resurfacedItems`,
driven by `deferralHistory`); `item-v027-service` enters the queue through this week's `itemIds`, the same
way every other seed item does. Both land in the same week's queue, on the same vehicle, with no change to
`queueFor` or the resurfacing logic.

**Two supporting-data gaps this scenario would otherwise fall into**, found by reading `feasibility.ts` and
the existing garage/cover data:

1. `freeBaysOn` treats a date with no `GarageDay` entry as *"no opening hours"* — a hard infeasibility
   reason (`feasibility.ts:25-28,54-56`). Werkstatt Berg's `days` array currently ends at `WEEK_41`. Without
   new entries for `2026-11-02` through `2026-11-06`, every slot in the new week — including the service
   item's own seeded proposal — would be infeasible. **Fix:** extend `garages[0].days` with five new
   `{ date, freeBays: 2 }` entries, matching `WEEK_41`'s uniform pattern.
2. Cover `R-1`'s `confirmedDates` currently only lists `WEEK_40`/`WEEK_41` dates. Left as-is, the new week
   would show zero confirmed cover even though `coverIds: ['R-1']` names it, which risks an incidental
   capacity shortfall that has nothing to do with bundling. **Fix:** extend `R-1.confirmedDates` with the
   same five dates.

## 3. Domain model changes

**Types** (`src/domain/types.ts`):
- `Proposal` and `DraftDecision` each gain `bundleWith: ItemId | null`, populated only when
  `treatment === 'bundle'`.
- `Visit` gains `bundledItemIds: ItemId[]` (empty in the ordinary case).

**New module** `src/domain/bundle.ts`:
- `bundleTargets(item, queueItems, decisions): OpenItem[]` — other open items on the same vehicle that
  currently hold a live, dated, non-watch decision. Mirrors `watchAvailable`'s shape in `recommendation.ts`.
  Empty when there's nothing to bundle with, which is what disables the button (§4).
- `bundleComparison(item, target, fixture, decisions)` — returns the bundled and split figures shown in §4,
  each shaped like the existing `ConsequenceView` (`qualitative`, `serviceCost`, `coverCost`, `disruption`,
  formatted with `consequence.ts`'s own `eur()`/`'not available'`/`'not stated'` conventions) plus a visit
  count. Built the same way `SlotPicker`'s existing `effectOf`/`shortfallsUnder` trial computation already
  works: compute both draft variants and diff them, rather than a new ad hoc estimate. The extension risk is
  a stated sentence, not a computed figure — see §2's note on `canExtendToDays`.

**`visitsFromDecisions` (`src/domain/visits.ts`):** a decision with `treatment === 'bundle'` and a non-null
`bundleWith` no longer emits its own `Visit`. Instead it's folded into its target's `Visit`:
`bundledItemIds` gains the bundled item's id, and `scope` becomes the joined titles (e.g. *"Wiper linkage
noise reported by driver + Scheduled service"*). `days` comes from the anchor (the target item); the
extension is a fact about `canExtendToDays`, not about `days` itself, so nothing here needs to guess a
combined duration.

**Why the bundled decision still carries its own `slotDate`.** It's set automatically (copied from the
target) when the link is made, never edited independently. This means every existing per-item feasibility
and blocker check in `validation.ts` and `feasibility.ts` keeps working completely unmodified — `bundleWith`
is the one new structural fact; it doesn't replace anything those modules already check.

## 4. Decision-time UI

In `TreatmentForm.tsx`, "Bundle" is enabled only when `bundleTargets(...)` is non-empty, following the exact
pattern `watchAvailable`/`allowWatch` already uses for `Watch`: disabled with a stated reason
("No other open item on this vehicle to bundle with") when there's nothing to attach to.

Selecting "Bundle" swaps the `SlotPicker` (which today already only mounts when `treatment !== 'watch'`,
`ItemDetail.tsx:59-66`) for a new `BundlePicker`: radio-style buttons — visually consistent with
`SlotPicker`'s own buttons — listing each candidate target's title, date and garage. Choosing one sets both
`slotDate` and `bundleWith` in the draft decision.

Below the picker, a comparison block states the two options honestly, rendering `bundleComparison`'s two
`ConsequenceView`-shaped results through `ConsequenceBlock`'s existing cost-tile markup (the `.costs`/`.cost`
service/cover/disruption row), shown twice rather than once — no new number formatting, just the existing
tile style used for two options instead of one.

**What actually differs, and what doesn't.** The repair cost is the same either way — bundling doesn't make
the linkage fix cheaper, and the comparison says so rather than implying it does: both tiles show the same
combined service cost (`item-v027`'s €95 plus `item-v027-service`'s €320 = €415). What genuinely differs is
visit count and its consequences, computed the same way `SlotPicker`'s existing trial mechanism already
computes "what picking this day changes" — one shared visit carries one van-day of disruption/cover cost;
two visits carry two, whatever that trial resolves to for the second, otherwise-unneeded visit. The
extension risk is stated as a caution on the bundled side, not folded into either number:

```
Bundled — 1 visit, 2 Nov, Werkstatt Berg
  Service EUR 415 (combined) · Cover EUR 0 · one van-day of disruption
  Caution: combining adds risk — if the linkage needs more than expected once they're
  in there, the visit may run long.

Split — 2 visits
  Service EUR 415 (combined, unchanged) · Cover and disruption for a second,
  otherwise-unneeded visit — computed for the actual day the wiper item would take instead
```

This is what makes it *"the trade-off shown honestly"* rather than a label: the product states a real
comparison and lets the user decide, and it does not choose for them.

"Apply to draft" behaves exactly as it does today.

## 5. Dashboard follow-through

Two changes in `fleetStatus.ts`, one general fix this scenario exposes and one bundle-specific addition:

**General fix.** The "In workshop" fact today renders only `In workshop · day X of Y` — no title at all,
bundled or not (`fleetStatus.ts:121-123`). `visit.scope` is already computed and already used elsewhere
(`CommitSummary.tsx`, `commit.ts`) but never reaches this line. Fixed to
`In workshop · ${visit.scope} · day X of Y`, unconditionally.

**Bundle-specific.** When `visit.bundledItemIds.length > 0`, `visit.scope` is already the joined title
(§3), so this fact line reads correctly with no extra branching:
`In workshop · Wiper linkage noise reported by driver + Scheduled service · day 1 of 1`. The pre-visit
`Booked` fact (`fleetStatus.ts:130-138`) gets the same scope treatment.

No new `FleetStatusKind` is introduced. A bundled van is still the existing red "off-road" card during the
visit — just with a fact line that now states what it's actually in for.

**A gap that would otherwise undercut the showcase.** Today, once a visit's covered dates are in the past,
`fleetStatus.ts` still renders a stale `Booked <past date>` fact — the condition at `fleetStatus.ts:130-138`
only excludes the *current* visit, not a *finished* one. Advancing the clock through and past `2026-11-02`
would end the walkthrough on a visibly wrong note (a "Booked" van, weeks after its visit). Fixed by dropping
the fact once `today` is past the visit's last covered day. This isn't bundle-specific, but bundling is what
surfaces it, since it's the scenario this design walks all the way through to completion.

## 6. Error handling and invariants

**A bundle link only ever points at a live target.** If the target's own decision changes such that it's no
longer a valid attachment point — its date moves, or its treatment changes away from a dated, non-watch
state — the dependent decision is reset rather than left pointing at a stale target. This is implemented at
the same normalisation site `planReducer.ts`'s `set-decision` already uses for the analogous watch/deferral
case (*"A deferral is meaningful only under watch. Normalising at the write site keeps a decision moved off
watch from carrying a stale follow-up,"* `planReducer.ts:107-109`): a bundle link is meaningful only while
its target stays live, normalised the same way, at the same single site.

**Commit validation needs no new rule.** Because the bundled decision still carries a real `slotDate`
(§3), `validatePlan` continues to check it exactly as it checks any other dated decision. The only new
failure mode — a bundle pointing at a target that no longer exists as a live decision — is already
prevented structurally by the rule above, not by an added validation check.

## 7. Testing

- New `src/domain/bundle.test.ts`: `bundleTargets` (present/absent cases) and `bundleComparison` (figures
  match the fixture's authored numbers).
- New `src/domain/visits.test.ts` (no file exists today for this module): the merge case — two decisions,
  one `bundleWith`-linked to the other, produce one `Visit` with joined `scope` and correct
  `bundledItemIds`.
- `fleetStatus.test.ts`: a bundled, in-progress visit renders the joined scope; a finished visit (bundled or
  not) renders no stale `Booked` fact.
- `planReducer.test.ts`: changing the target's decision resets a dependent bundle link.
- `validation.test.ts`, `commit.test.ts`: one bundled-decision case alongside the existing
  act-now/watch cases, confirming no new blocker type is needed.

## 8. Walkthrough (verification script)

1. Cold open, week of `2026-09-28`. Commit the week's plan with `item-v027` left on `watch` (unchanged from
   today's script).
2. Click "Advance to next review date." The clock jumps to `2026-11-02`. The queue for that week shows
   `item-v027` (resurfaced, prior watch rationale visible per E6.4, unchanged) and `item-v027-service`
   (freshly authored, proposed `act-now`).
3. Open `item-v027`. "Bundle" is enabled; selecting it offers "Scheduled service · 2 Nov" as the only
   target. The comparison block states the bundled and split figures side by side.
4. Choose Bundle, apply, commit. `CommitSummary` shows one visit on `V-027` scoped to both titles.
5. On the dashboard, `V-027` shows "Booked 2 Nov · Wiper linkage noise reported by driver + Scheduled
   service."
6. Advance the clock into `2026-11-02`. `V-027` is off-road, red, with the joined scope in its fact line.
7. Advance past the visit. `V-027` returns to a plain in-service tile with no stale `Booked` fact.

## 9. Non-goals, explicitly not built

Unchanged from the M0 design's own non-goals, plus, specific to this slice: no general "any two same-vehicle
items may bundle automatically" behaviour, no bundling proposed by the system rather than chosen by the
user, and no comparison UI for more than two items or more than one candidate target (the one authored
scenario has exactly one target; `BundlePicker` supports a list because `bundleTargets` can return more than
one, but nothing in this design requires authoring a second candidate).

## 10. Open items

- **Capacity arithmetic for the week of `2026-11-02`, run for real.** §2's fixes (garage days, `R-1` cover
  dates) are designed to reproduce `WEEK_41`'s clean, shortfall-free pattern, and §4's split-side cover and
  disruption figures are designed to come from the same trial mechanism `SlotPicker` already uses. Neither
  is hand-verified in this document — both should be checked against the real fleet/demand numbers once
  implemented, not assumed from the prose here.
