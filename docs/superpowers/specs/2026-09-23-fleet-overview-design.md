# Fleet Overview: Design Spec

A read-only daily fleet view, shown as the landing surface ahead of the weekly plan: the whole
45-van fleet at a glance, with a short list of what needs the user and one route into the weekly
ritual.

**Status.** Approved in brainstorming on 2026-09-23, layout chosen from two verified mockups
(`docs/mockups/fleet-overview-a-rag-grid.mockup.html`, chosen, and
`docs/mockups/fleet-overview-b-kanban.mockup.html`, rejected). Scope beyond the build contract in
`docs/fleet-maintenance-work-packages.md`, and outside its M4 extension menu (§3), accepted
deliberately. Where this document and the work packages disagree, the divergence is stated at the
point it occurs.

**Reference convention.** A bare `§n` points into `fleet-maintenance-work-packages.md`. `[S §n]`
points into `2026-09-23-fleet-maintenance-prototype-design.md`. `[C §n]` points into
`2026-09-23-cover-note-design.md`.

---

## 1. Why this exists

The build contract's first screen answers the weekly question: what to service this week, next to
what that does to capacity (§1). The user's day does not start with that question. It starts with a
smaller one: is today fine, and does anything need me. Today the prototype has no surface that
answers it; the daily confirmation (E8.4) is a post-commit output about tomorrow, not a fleet view.

The overview is that daily glance. It also carries demo weight: the panel sees the whole fleet
represented at once, which makes G1's constraint (represent ~45 vans without making anyone read 45
rows) visible as a design choice rather than an omission, and it gives the walkthrough a natural
opening beat: glance, spot the exception, step into the week.

## 2. What it is, and what it is not

**It is a read-only glance with inspection.** Every van is visible with a derived status. A quiet
van can be inspected in place (§6). Vans that need the user link into the week plan.

**It is not a second decision surface.** No treatment, slot, deferral or commit control exists
here. §1's one-entry-one-journey decision is amended in wording and preserved in substance: E2.1
read "cold open into the saved weekly plan"; the app now cold-opens onto the fleet view, and the
weekly plan remains the only surface where a decision can be made or committed. The overview is an
antechamber with exactly one kind of action: navigate.

**Rejected alternatives.**

- *A Kanban board* (workflow columns: off the road, needs a decision, booked, watching, in
  service). Rejected on the mockup comparison: at cold open two of five columns are empty, the
  in-service column holds 40 of 45 cards, and the columns duplicate the queue's job on the plan
  surface. The lifecycle it makes visible is carried instead by tile sub-labels after commit (§4).
- *An actionable dashboard* (book or defer from the board). Rejected: it creates a second entry
  into the same decisions, which §1 deliberately ruled out, and it would duplicate the detail
  panel's evidence-first flow.

## 3. Placement and navigation

A tab row sits under the demo bar on both surfaces: **Fleet today** and **Week plan**. The commit
button, capacity band, queue and detail panel stay on the week plan, unchanged.

| Trigger | Result |
| --- | --- |
| First load, cover-note flag absent | Cover note, per [C §4]. Its action now lands on the fleet view (§10) |
| Any later load, flag set | Fleet view directly |
| **Open the week plan** button, or the Week plan tab | Week plan, current draft and selection untouched |
| Click an attention card | Week plan with that card's item selected in the queue and detail panel |
| Fleet today tab from the week plan | Fleet view; draft, selection and committed state untouched |
| Commit | Unchanged: summary within the week plan. The fleet view reflects the committed plan from then on |
| Week change (advance to review), and reset | Lands on the fleet view with selection cleared. The week-change effect covers the advance; reset sets the view explicitly, since resetting inside week 40 changes no week id |
| Advance a day within the week | Stays on the current surface; the fleet view recomputes for the new today |

The view state is not persisted. Landing on the glance is the point of the surface, and it costs
one storage concern less.

## 4. The status model

Every van gets exactly one status, decided in priority order, derived only from data the system
already holds: the fixture, holds, the active week's queue, the committed plan and the deferral
ledger. Nothing is invented: no health score, no telemetry, no cost figure on this surface.

**1. Off the road (red).** `isHeldOn(vehicle, today)` is true, or a committed visit covers today.
Sub-label names every applicable reason: `Held · <hold reason>`, `In workshop · day <n> of <m>`.
A van both held and booked is red with both facts shown; red always wins.

**2. Needs a decision (amber).** The van has an item in the active week's queue (resurfaced items
included) that is not yet resolved by a **committed** disposition. Draft choices do not clear
amber: a decision is operational once committed, same as a booking. The card carries the item's
urgency chip and its one-line because, reusing the queue's own wording.

**3. In service (green).** Everything else. Sub-labels where the committed state supplies one:
`Booked <day>` for a committed visit later in the week (the label persists after the visit day;
it remains a true statement about the committed plan), `Watching · review <date>` for an active
deferral (latest record, review date still ahead). Plain green has no sub-label.

The three counts sum to 45 and feed the stat strip. Attention cards (red plus amber) keep the week
plan queue's order via `orderQueue`, so the top card here is the same top item G1 asks about.

**Header facts.**

- Today line: `<45 - offRoad> of 45 vans on the road`, whether every assignment is covered today
  (from `computeDayCapacity` for both classes; a gap is named by class and count), and which cover
  vehicles are on site today (covers whose confirmed dates include today).
- Tomorrow line: rendered only when the **next business day** has a shortfall, naming day, class
  and count, with a link that switches to the week plan. It reads from the same
  `computeWeekCapacity` result the band renders, so drafts and proposals affect it exactly as they
  affect the band; there is no second capacity semantics. Next business day means the next date in
  the active week's day list, else the following week's Monday.
- CTA sub-line: `<attention count> items waiting for week <n>` while the week is uncommitted;
  `Week <n> committed` afterwards.

**Divergences from the mockup, resolved in this spec's favour.** The mockup's CTA sub-line reads
"4 decisions waiting"; the spec counts all attention items (5 at cold open), matching the cover
note's "five decisions waiting on you". Sample values in the mockups (green-tile ids, the hold
date, odometer figures, the watching example) are illustrative; the implementation renders fixture
values only.

## 5. Surface layout

Top to bottom, per the chosen mockup:

1. **Demo bar**, unchanged, then the **tab row** (§3).
2. **Glance header**: `Fleet · <weekday> <date>` as the title, the today line under it, the
   **Open the week plan** button with its sub-line on the right, and the tomorrow warning line
   full-width beneath when it applies.
3. **Stat strip**: three tiles (off the road, need a decision, in service with nothing open), each
   a count with a label, colour-railed. Not clickable; the sections below are the detail.
4. **Needs attention**: one card per red or amber van, in queue order. Card content: vehicle id,
   badges (safety, held, specialist), urgency chip, item title, the one-line why, and an
   `Open in week plan` affordance. The whole card is one button that navigates (§3); no popover
   here, the card already carries its facts.
   Empty state (reachable in a committed week 41): `Nothing needs attention. All 45 vans in
   service.`
5. **In service, nothing open (N)**: a compact tile grid of the remaining vans, id only, specialist
   vans marked with the purple dot, with a one-line legend. Tiles are scanned, not read: this is
   how the surface honours G1's no-45-rows constraint while still showing the whole fleet.
6. **Inspect popover** on the green tiles (§6).

`theme.css` tokens only, no new colours, matching the [C §4] quality bar. All copy is sentence
case, dates in the existing `formatLongDay` style.

## 6. The inspect popover

Click a green tile to open one popover; click elsewhere, press Escape, or click the tile again to
close it. One popover at a time. Near the right viewport edge it opens leftward so it never clips.

Content, all straight from the fixture and derived state: vehicle id, class badge, model year,
odometer with its read date, typical weekly km, and the status line including any sub-label fact.
Footer: for a plain green van, `Nothing open for this van`; for a booked or watching van, the
committed fact plus a `View in week plan` link that navigates with the item selected.

Tiles are buttons: focusable, Enter opens, Escape closes and returns focus, `aria-expanded` set.
No further a11y scope; the broader pass remains unscoped, as recorded in the progress notes.

## 7. Architecture

| File | Responsibility |
| --- | --- |
| `src/domain/fleetStatus.ts` | Pure projection: per-van statuses with sub-label facts, the three counts, today and next-business-day coverage facts. No React, no storage. |
| `src/domain/fleetStatus.test.ts` | Its suite (§9). |
| `src/ui/FleetView.tsx` | Glance header, stat strip, attention cards, tile grid. Renders the projection; computes nothing itself. |
| `src/ui/InspectPopover.tsx` | The popover: content, open/close, edge flip, focus handling. |
| `src/ui/NavTabs.tsx` | The two tabs; presentation over a `view` value and an `onNavigate` callback. |
| `src/App.tsx` | View union grows to `'fleet' \| 'planning' \| 'summary'`, default `'fleet'`; week-change effect resets to `'fleet'`. Still a value, not a router. |
| `src/ui/theme.css` | Gains `.tabs`, `.glance`, `.stats`, `.tile`, `.popover` blocks. |

The per-van shape; the projection returns these plus the three counts and the coverage facts of §4:

```ts
export type FleetStatusKind = 'off-road' | 'needs-decision' | 'in-service'

export interface VanStatus {
  vehicleId: VehicleId
  vehicleClass: VehicleClass
  kind: FleetStatusKind
  facts: string[]            // sub-label lines, already worded ('Held · ...', 'Booked Thu 1 Oct')
  itemId: ItemId | null      // set when the van links into the week plan
}
```

Reused, not duplicated: `orderQueue` for attention order, `computeDayCapacity` and
`computeWeekCapacity` for the coverage lines, `isHeldOn` for holds, the existing visit derivation
for workshop days, and the queue's urgency and because wording. The projection takes the same
effective decisions `App.tsx` already computes for the band, so the two surfaces can never
disagree about the same date.

## 8. Edge cases

- **Friday.** The tomorrow line targets the following Monday, labelled with its real date. This
  sidesteps the known weekend limitation (acceptance record, limitation 7) rather than extending
  it to a new surface.
- **Week 41.** Resurfaced items go amber with their prior decision visible through the queue's own
  wording. V-012 turns green once its recorded release date passes, with no special casing:
  `isHeldOn` already answers it.
- **Multi-day visits.** Off the road on every covered day, `day <n> of <m>`, each van counted once
  no matter how many reasons overlap, matching §4's capacity rule.
- **Corrupt or absent storage.** No new persistence exists. The projection is a total function
  over already-validated state; it must not throw. Popover openness is component state.

## 9. Testing and verification

Domain suite, `src/domain/fleetStatus.test.ts`, against the seeded fixture:

1. Cold open: counts 1 / 4 / 40; V-012 red with the held fact; attention order matches
   `orderQueue`; today covered with R-1 on site; tomorrow line flags Tuesday, standard, short
   by 1.
2. Committed walkthrough decisions: no ambers; V-118 `Booked Thu 1 Oct`; V-027 and V-041 watching
   with their review dates; V-012 still red; CTA state flips to committed.
3. Advanced to Tuesday, committed: V-012 and V-103 both off the road, each exactly once; on-road
   count 43; R-1 and R-2 both on site.
4. Multi-day scope extension on V-103: Wednesday shows `day 2 of 2`.
5. Week 41: V-041 resurfaced amber; V-012 green after the recorded release.
6. Friday: the tomorrow line targets Monday of week 41 with its real date.

UI stays browser-verified live, per the project's no-component-tests precedent [S §1]. Manual
checks at the end of the task: land on the fleet view after the cover note and after reload;
tab switch preserves an in-progress draft; card click selects the right item; popover open, close,
Escape, edge flip; commit then return to the fleet view and see booked, watching and the committed
CTA state; reset restores the cold-open board; `npm test`, `npx tsc --noEmit`, `npm run build`,
and `dist/index.html` from a filesystem origin still behave.

## 10. Documentation updates

- **Cover note copy** (`src/ui/coverNoteContent.ts`, and [C §3.5] amended per its own rule:
  correct the copy against the built surface). The action label **Open this week's plan** becomes
  **Open the fleet**, and [C §3.5] gains this opening paragraph, verbatim:

  > You land on the fleet first: 45 vans, one already off the road, and a short list of what needs
  > you. It answers the daily question, is today fine, before you plan the week. The weekly plan
  > is one tab over, and everything below describes it.

  The [C §4] behaviour table rows that name the plan surface as the click-through target are
  updated to name the fleet view.
- **README.** The walkthrough's first step becomes the fleet view landing, one sentence describing
  the glance, then the existing steps.
- **Acceptance record.** After implementation, a dated addendum records the fleet-view checks and
  a re-run of the live walkthrough from the new landing. G1's structural claim is restated from
  the fleet view, since that is now the screen a fresh evaluator meets first.
- **Work packages.** The contract file is not edited, matching the cover-note precedent: the §1
  and E2.1 divergence is recorded here (§2) and in the progress log.

## 11. Coordination with the declutter redesign

A sibling session is concurrently designing a decluttered week-plan surface
(`docs/mockups/redesign-guided-queue.mockup.html`: blocker chips in the header, an
exception-first band). This spec designs against the surface as built at `7e07d22` and touches
shared chrome: `App.tsx`, `theme.css`, the demo bar's immediate surroundings (the tab row sits
directly beneath it).

The boundary that keeps the two independent: `fleetStatus.ts` and the fleet view's sections
depend on the domain and state layers only, not on the week plan's components. Whichever design
lands second adopts the other's chrome (tab row styling, header idiom) at integration time, and
the two should not be implemented simultaneously in the same files. Sequencing is a decision for
the implementation plan, not this spec.

## 12. Not built

| Not building | Reason |
| --- | --- |
| The Kanban layout | Rejected in §2 on the mockup comparison; lifecycle appears as sub-labels instead. |
| Actions on the board | A second entry into the decisions contradicts §1. Navigation is the only verb here. |
| Filters, search, sorting, grouping controls | 45 tiles scan without them; controls imply a scale the prototype does not have. |
| Health scores, telemetry, per-van cost figures | §10 non-goals; nothing appears that the fixture cannot back. |
| Persisting the active tab | Landing on the glance is the point; one storage concern less. |
| A popover on attention cards | The card already carries its facts; its one job is to navigate. |
| Virtualised or paginated grid | 45 tiles render trivially. |

## 13. Build placement and cost

New work after the completed plan; all sixteen tasks and the final whole-branch review are done,
so this does not compete with the M3 validation block the contract protects. It is also not one of
the two sanctioned M4 candidates (§3: E7 or E5.3): it is a third extension chosen deliberately by
the user, and this spec records that choice the way the cover note recorded its own.

Costs stated honestly: the landing behaviour changes, so the cover note's bridge copy, the README
walkthrough and the acceptance record all move with it (§10), and the G1/G5 observed usability
walkthrough, still **not run**, would now start from this surface. The projection module and its
suite are the bulk of the reliable work; the UI is one view, one popover and a tab row over
existing tokens.
