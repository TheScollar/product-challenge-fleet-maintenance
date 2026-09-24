# Week 41: two new authored cases

Two new maintenance items, authored into week 41 rather than resurfaced from week 40, so the
fleet keeps producing new work after the first week instead of only replaying old decisions.

**Status.** Approved in brainstorming on 2026-09-24.

**Reference convention.** `[FO §n]` points into `2026-09-23-fleet-overview-design.md`. `[S §n]`
points into `2026-09-23-fleet-maintenance-prototype-design.md`. A bare `§n` points into
`fleet-maintenance-work-packages.md`.

---

## 1. Why this exists

Today only week 40 authors items. `weekFixtureFor` (`src/domain/capacity.ts`) falls back to an
empty-itemIds template for any week the fixture does not explicitly author, and week 41 is
explicitly authored with `itemIds: []`. The only things that can appear from week 41 on are items
resurfacing from a week-40 deferral (`resurfacedItems`, `src/domain/deferral.ts`). This is a
recorded, deliberate limitation (README, "Limitations" §1; `docs/acceptance.md` §1), not a defect.

The gap it leaves: a fresh evaluator who advances the clock past week 40 sees the fleet only ever
replay old business. Nothing new is ever highlighted on the fleet overview, and the weekly plan
never asks a fresh question after the first week. This spec adds two new cases, authored into week
41, so the dashboard and the weekly plan both keep doing their job past the first week.

## 2. Scope

**A one-time wave, decided over an ongoing pattern.** Two items are authored into week 41's
`itemIds`. Week 42 onward keeps using `weekFixtureFor`'s empty-itemIds fallback, unchanged: no new
`WeekFixture` entries are added beyond the existing two (week 40, week 41). An ongoing per-week
generator was considered and rejected (§9): it would mean authoring fixture content indefinitely,
which is disproportionate to "a few more cases" and outside what was asked.

**Two cases, both standard class.** A specialist case was considered and rejected (§9): week 41 has
no specialist cover (`fixture.weeks[1].coverIds = ['R-1']`, standard only), so any specialist visit
that week reproduces the exact "no specialist cover" lesson V-041 already teaches when it
resurfaces. Two standard-class cases are additive without duplicating that lesson.

## 3. The two cases

Both are previously-quiet vans (no existing item), both proposed `act-now` by default, both
`garageId: 'werkstatt-berg'` (the fixture's only garage), both `safetyClass: false`, both
`visitDays: 1`, `canExtendToDays: null`.

### `item-v105`: V-105, Hauptuntersuchung (HU) due

A *deadline*-urgency case that is not a safety hold: the van stays on the road until booked, unlike
V-012. This is the first deadline item that is not also a UVV off-road hold, which shows the
"deadline" urgency kind is not synonymous with "off the road."

| Field | Value |
| --- | --- |
| `title` | Hauptuntersuchung (HU) due |
| `evidence.observation` | "HU sticker expires 31 Oct 2026. No test slot booked yet." |
| `evidence.source` | Fleet registration record |
| `evidence.receivedOn` | 2026-10-05 |
| `urgency.kind` | `deadline` |
| `urgency.because` | Legally required roadworthiness test (HU) must be completed before the sticker expires; driving past that date without a valid HU is an administrative offence. |
| `urgency.relevantDate` | 2026-10-31 |
| `assumption` | `null` (a known deadline, not an estimate) |
| `parts` | `null` |
| `consequence.qualitative` | A missed HU deadline is an administrative offence and can affect insurance cover if the van is stopped without a valid test. Booking now, well ahead of 31 Oct, avoids a last-minute scramble if the test finds a defect needing a follow-up visit before the sticker expires. |
| `consequence.serviceCostEur` | 120 |
| `consequence.coverCostEur` | 140 |
| `consequence.coverUnavailable` | `false` |
| `consequence.uncoveredAssignmentsNote` | "Depends on the day chosen. Thursday leaves one assignment uncovered." |
| `proposal` | `act-now`, slot 2026-10-08 |
| `triggerOptions` | One event trigger, `v105-hu-reminder`, label "Registration office sends the final HU reminder." No corresponding entry is added to `fixture.events`, so, like V-027's trigger, it is available to pick if the user defers, but never fires in the fixture. |

### `item-v024`: V-024, front tyre tread approaching the legal minimum

An *estimate*-urgency case, same urgency kind as V-103, V-118 and V-027, but with **no projected
`relevantDate`**. V-118's interval date is a real computation over a stored field
(`odometerKm`/`weeklyRateKm`). Tread depth is not a field this fixture tracks anywhere, so a
projected replacement date would be invented precision dressed as a computation, not a derived
fact. Following V-103's precedent instead (an inspection finding, `relevantDate: null`, the
urgency carried by the assumption text alone) keeps faith with the project's own rule: no number is
invented where the evidence supports none (README, "Decisions taken").

| Field | Value |
| --- | --- |
| `title` | Front tyre tread approaching the legal minimum |
| `evidence.observation` | "Front-axle tread depth read at 2.1 mm, telematics-linked. Statutory minimum under StVZO is 1.6 mm." |
| `evidence.source` | Telematics tread-depth feed |
| `evidence.receivedOn` | 2026-10-05 |
| `urgency.kind` | `estimate` |
| `urgency.because` | Tread read 2.1 mm on 5 Oct against a 1.6 mm legal minimum under StVZO. |
| `urgency.relevantDate` | `null` |
| `assumption` | A single tread reading does not establish a wear rate, so no replacement date is projected; the finding alone is evidence enough to book the visit this week rather than wait for a second reading. |
| `parts` | Front tyre pair, ready 2026-10-07 |
| `consequence.qualitative` | Tread continues toward the legal minimum with each week driven. No regulatory deadline applies yet, and replacing now avoids a rushed booking once the margin closes. |
| `consequence.serviceCostEur` | 240 |
| `consequence.coverCostEur` | 140 |
| `consequence.coverUnavailable` | `false` |
| `consequence.uncoveredAssignmentsNote` | "Depends on the day chosen. Thursday leaves one assignment uncovered." |
| `proposal` | `act-now`, slot 2026-10-08 |
| `triggerOptions` | One odometer trigger, framed as a recheck point rather than a failure prediction: `{ vehicleId: 'V-024', thresholdKm: 64_000, label: 'Odometer passes 64,000 km' }`, computed against V-024's ordinary fixture-default odometer (no `NAMED_ODOMETER` override needed; tread is not cited against an odometer figure in the evidence, so none is implied). |

`fixture.weeks[1].itemIds` moves from `[]` to `['item-v024', 'item-v105']` (order does not affect
display order, which `orderQueue` computes fully; see §4).

## 4. Why both land on Thursday, and what that triggers

Week 41's standard class has exactly one spare unit of capacity on an ordinary day: 38 owned, 38
demand, +1 from R-1's cover (`fixture.weeks[1].coverIds = ['R-1']`, confirmed every day of week
41). Monday is the exception: V-012's hold (`releaseRecordedOn: '2026-10-06'`) already consumes
that day's one spare unit, so Monday sits at exactly 0 shortfall with no margin. Monday is
deliberately left alone: `fleetStatus.test.ts`'s "fleet overview reads today from the draft"
block pins Monday of week 41 at exactly covered, specifically to isolate the one-capacity-semantics
fix from every other variable [FO §4]. Landing a new visit there would silently break that
regression test's premise.

Both new items instead default their slot to **Thursday, 2026-10-08**, a day with no pre-existing
unavailability. Two visits there exhausts the one spare unit:

```
owned 38, unavailable {V-024, V-105} = 2, cover (R-1) = 1
available = 38 - 2 + 1 = 37 < demand 38  →  shortfall 1
```

This is visible in the capacity band and blocks commit from the moment week 41 becomes the active
week, the same mechanism that makes V-118's week-40 Tuesday conflict visible at cold open. Nothing
new is computed: `computeWeekCapacity` already reads the whole week regardless of which day is
"today." It clears by moving either item off Thursday, though not to the same set of days: V-105
carries no parts requirement and can move to Tuesday, Wednesday or Friday, while V-024's parts
(§3) are not ready until Wednesday, so only Wednesday or Friday clear it for that item. Moving
either one to Monday instead does not clear it (Monday has none to give), which mirrors, unplanned,
the same "the shortage lands elsewhere" lesson V-103 already teaches in
week 40.

**Effect on the weekly plan.** `groupQueue` (`src/ui/grouping.ts`) puts any item behind a
`capacity-shortfall` blocker into "Blocking the week" regardless of whether it otherwise has a
complete decision. Both new items land there by default. If V-041 is also still undisposed that
week (its own resurfacing is unchanged by this spec), "Blocking the week" shows three items, not
one: a real planning moment, not a single leftover follow-up.

## 5. Architecture

No new code paths. This is fixture data plus one array change:

| Change | File |
| --- | --- |
| Two new `OpenItem` entries (§3) | `src/domain/fixture.ts`, `items` array |
| `weeks[1].itemIds`: `[]` → `['item-v024', 'item-v105']` | `src/domain/fixture.ts`, `weeks` array |

Every consuming layer already operates generically over whatever a week authors: `queueFor` (week's
authored items plus resurfacing), `fleetOverview` (per-van status and attention ordering),
`groupQueue`/`blockerChips` (blocking/open/settled grouping), `validatePlan`/`computeWeekCapacity`
(capacity and blockers), `orderQueue` (priority ordering). None of them reference specific item ids
or week ids. This is the identical mechanism already rendering week 40's five items and resurfacing
V-041 and V-027; it was simply never exercised for a week-41-authored item before. No change to
`types.ts`, no new UI component, no new persistence concern.

## 6. Edge cases

- **Left undecided into week 42.** If the user advances past week 41 without committing a decision
  on either new item, it simply drops out of the queue (not authored in week 42, not in
  `deferralHistory` since nothing was ever committed). This is existing, pre-existing behavior for
  *any* undecided authored item carried past its week, not a new edge case this spec introduces,
  so it is not addressed here.
- **V-041 manually booked onto Thursday too.** `werkstatt-berg` has 2 free bays on 2026-10-08, and
  the two new items already use both. If the user disposes V-041 (specialist, undisposed at
  resurfacing) onto Thursday as well, the existing `slotBlockers` feasibility check
  (`src/domain/feasibility.ts`) names the bay conflict, the same mechanism that already produces
  scenario 6 in week 40. Nothing new to build.
- **Reset.** Both items are static fixture content, identical in kind to the existing five; reset
  restores them exactly as it restores V-012, V-103, V-118, V-041 and V-027 today.

## 7. Testing and verification

**Tests requiring a deliberate update**: the new, correct behavior, not incidental breakage.
Every other test touching a week-41 date was checked and does not derive its item list from
`fixture.weeks[1].itemIds` (confirmed for `persistence.test.ts`, `deferral.test.ts`,
`commit.test.ts`, `capacity.test.ts`, `validation.test.ts`, `grouping.test.ts`, and the rest of
`planReducer.test.ts`/`fleetStatus.test.ts` beyond what is listed below), so they are left alone.

1. `src/domain/scenarios.test.ts`, scenario 8 ("Review date arrives or trigger fires"), one of the
   ten canonical scenarios the README cites as run end to end. `queueFor(...)` for week 41 currently
   asserts exactly `['item-v041']`; it becomes `['item-v024', 'item-v105', 'item-v041']` (authored
   items first, in `itemIds` order, then resurfaced). V-041's own assertions (`priorDecision`,
   `resurfacedBecause`) are unaffected.
2. `src/domain/planReducer.test.ts`: the mirrored queue assertion, same change.
3. `src/domain/fixture.test.ts`: "authors two weeks, the second carrying no new items":
   `itemIds` length for week 41 goes from `toHaveLength(0)` to `toHaveLength(2)`, and the test title
   is reworded since the claim it makes is no longer true.
4. `src/domain/fleetStatus.test.ts`: the Tuesday-of-week-41 counts test ("releases the held van
   once the recorded release date passes") goes from `{offRoad: 0, needsDecision: 1, inService: 44}`
   to `{offRoad: 0, needsDecision: 3, inService: 42}`.

**New coverage** to add alongside the above, in `fleetStatus.test.ts` and/or `scenarios.test.ts`:
the Thursday shortfall (standard, short by 1) appearing in an uncommitted week 41 without any user
action; V-024 and V-105 both amber (`needs-decision`) with `itemId` set, from the moment week 41 is
reached; the shortfall clearing when either item's slot moves to Tuesday, Wednesday or Friday, and
persisting (relocated, not resolved) if moved to Monday instead.

**Manual verification**, following the project's browser-verified-UI precedent [S §1]: reach week
41 (via repeated "Advance 1 day" and via "Advance to next review date"); confirm V-024 and V-105
both appear as attention cards on the fleet overview with their urgency chip and because-text;
confirm the week plan shows three items in "Blocking the week"; move one item's slot and watch the
Thursday shortfall clear in the capacity band; commit and confirm both vans show `Booked Thu 8 Oct`
on the fleet overview; `npm test`, `npx tsc --noEmit`, `npm run build`.

## 8. Documentation updates

- **README.** Limitation #1 ("Week 41 and later carry only resurfaced items. No new work is
  authored for them.") is corrected: week 41 also carries two newly authored cases; week 42 onward
  still carries only resurfaced items, per the one-time-wave scope (§2). The five-minute walkthrough
  step that reaches week 41 (currently: "Advance the clock to the next review date. V-041 returns
  with its rationale intact.") gains a sentence noting the two new cases and the Thursday shortfall.
- **`docs/acceptance.md`.** Its mirrored limitation #1, and the "Week 41" verified-checks bullets, get
  a dated addendum in the project's existing style (see the fleet-overview spec §4's own corrections)
  rather than a silent rewrite.
- **Fleet-overview spec.** `2026-09-23-fleet-overview-design.md` §8's "Week 41" edge-case bullet and
  §9's scenario 5 both describe week 41 as resurfacing-only. Rather than editing that frozen,
  dated spec's own narrative, this document is cross-referenced from it (`[week41 cases spec]`) at
  the point each claim is now incomplete, matching how that spec itself points at `[C §n]` and
  `[S §n]` rather than absorbing their content.

## 9. Not built

| Not building | Reason |
| --- | --- |
| An ongoing per-week content generator (new items in week 42, 43, …) | Out of the scope chosen in brainstorming (§2): "a few more cases," not indefinite fixture authoring. |
| A specialist-class new case | Week 41 has no specialist cover; it would reproduce the lesson V-041 already teaches on resurfacing. |
| A tracked tread-depth field on `Vehicle` | Not needed: the case is evidence text, same as V-103's inspection finding, not a value other logic reads. |
| Forcing V-024's or V-105's default slot to resolve the Thursday shortfall automatically | The shortfall is the point: it is what makes the two new cases require planning, not just booking. |

## 10. Build placement and cost

New work after the completed fleet-overview build. Purely additive fixture data plus a four-test
update to reflect intended new behavior (§7); no architecture, type, or UI change. The bulk of the
work is the fixture content itself (§3) and its cross-checking against every existing week-41-dated
test (§7), already done in this spec so implementation is a direct transcription.
