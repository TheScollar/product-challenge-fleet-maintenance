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
| **Open the week plan** button, or the Week plan tab | Week plan, current draft and selection untouched. Whichever face the plan side last wore, planning or summary, is the face it wears again: crossing tabs is not an edit, and must not cost the user their commit summary or tempt a pointless recommit |
| Click an attention card | Week plan with that card's item selected in the queue and detail panel. A card for a van with no item in this week's queue does not navigate at all (§5) |
| **Open the fleet** on the cover note, reached via About from either surface | Fleet view, always. Deliberately not "wherever you were": the button says fleet and lands on the fleet [C §4]. The plan side's planning-or-summary face is left untouched, so returning to it restores it |
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

The three counts sum to 45 and feed the stat strip. Attention cards (red plus amber) are ordered by
`orderQueue`, the same function the week plan's queue orders within.

**The two screens do not promise the same first item, and their reds are not the same red.** An
earlier revision of this section claimed "the top card here is the same top item G1 asks about".
That was true when it was written and is no longer. The concurrent declutter redesign changed the
week plan from a flat `orderQueue` list to groups built by `groupQueue` (blocking the week, open,
settled), and reserved its red for *blocks the commit*. This screen's red is a different axis: *off
the road today*, meaning a hold or a committed visit. The consequences, stated plainly rather than
smoothed over:

- The fleet's first (reddest) card can be an item the week plan draws dimmed and settled at the
  bottom of its list. At cold open that is exactly what happens to V-012: off the road on a hold,
  and already dispositioned, so nothing about it blocks the week.
- A card can be amber here and red over there, or the reverse. Neither screen is wrong; they answer
  different questions, and only `orderQueue` is shared.

The fleet view carries a one-line legend under its **Needs attention** heading naming what its own
red and amber mean, and saying the week plan groups by what blocks the commit. That is the whole
mitigation: no colour is changed and no list is reordered, because both orderings are correct for
the question their own screen asks.

**Header facts.**

**Header facts.**

- Today line: `<45 - offRoad> of 45 vans on the road`, whether every assignment is covered today
  (from `computeDayCapacity` for both classes; a gap is named by class and count), and which cover
  vehicles are on site today (covers whose confirmed dates include today).
- Tomorrow line: rendered only when the **next business day** has a shortfall, naming day, class
  and count, with a link that switches to the week plan. Next business day means the next date in
  the active week's day list, else the following week's Monday.
- **One capacity semantics, for every day of the week, today included.** Both coverage lines read
  the same effective decisions the capacity band renders, drafts and proposals included, so a
  still-uncommitted plan that strands a day shows that gap here too. There is no
  operational-versus-planning split for any day of the active week: the week is one draft until it
  is committed, and the band has never drawn such a split either.

  An earlier revision of this section framed the today line as operational reality, committed
  visits only. That was a design error, not a product distinction, and the code that implemented
  it produced the defect it invites: this screen's header read "every assignment covered today"
  while the week plan, one tab away, showed that same day short by one and refused to commit over
  it, because the shortfall existed only in the still-uncommitted draft. Corrected in the final
  fix wave; pinned by `fleetStatus.test.ts`'s "reads today from the draft, exactly as the band
  does".

  Note what this does *not* change: the red/amber/green status of a van is still decided on
  operational facts (a hold, or a **committed** visit), per the three rules above. Colour answers
  "where is this van today"; the coverage lines answer "does the plan as it now stands leave a day
  uncovered". A van can therefore sit amber while already being counted out of the day's capacity,
  exactly as the band counts it.
- CTA sub-line: `<n> item(s) waiting for week <n>` while the week is uncommitted; `Week <n>
  committed` afterwards. The count is queue items carrying no committed disposition, not the length
  of the attention list: a van red for a hold alone has no item in this week's queue and nothing
  left to decide, and counting it would overstate the work waiting.

**Divergences from the mockup, resolved in this spec's favour.** The mockup's CTA sub-line reads
"4 decisions waiting"; the spec counts every undecided queue item (5 at cold open, V-012's included
even though its van is red), matching the cover note's "five decisions waiting on you". Sample
values in the mockups (green-tile ids, the hold date, odometer figures, the watching example) are
illustrative; the implementation renders fixture values only.

## 5. Surface layout

Top to bottom, per the chosen mockup:

1. **Demo bar**, unchanged, then the **tab row** (§3).
2. **Glance header**: `Fleet · <weekday> <date>` as the title, the today line under it, the
   **Open the week plan** button with its sub-line on the right, and the tomorrow warning line
   full-width beneath when it applies.
3. **Stat strip**: three tiles (off the road, need a decision, in service with nothing open), each
   a count with a label, colour-railed. Not clickable; the sections below are the detail.
4. **Needs attention**: one card per red or amber van, in queue order, under a legend naming what
   red and amber mean here (§4). Card content: vehicle id, badges (safety, off the road,
   specialist), urgency chip, item title, the one-line why, and an `Open in week plan` affordance.
   The whole card is one button that navigates (§3); no popover here, the card already carries its
   facts.
   **Unless the van has no item in this week's queue.** A van red for a hold alone (V-012 in
   week 41, once its week-40 item is committed and gone from the queue) has no destination on the
   week plan: navigating there would select nothing and land the user on an empty detail pane
   under a promise that led nowhere. Such a card renders as information only, a plain `div` with
   the vehicle id, the off-the-road badge and its facts as the why, with no `Open in week plan`
   line and no click behaviour, like the stat tiles above it.
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
**Only Escape returns focus.** The popover also closes on a mousedown anywhere outside it,
including on the tabs and the demo bar, which navigate away; restoring focus to the tile on that
path scrolls to an element about to unmount, so the close handler is told which path fired it and
restores focus for the keyboard one alone. Re-clicking the tile leaves focus on the tile already.

**Open-ness is a request, not a fact.** The stored vehicle id is reconciled against the quiet list
on every render, and dropped when the van is no longer in it. A van can leave the quiet list with
no mousedown ever reaching the close handler (keyboard-only use of the demo bar, say, advancing the
clock into a day the van spends in the workshop). Gating the render on that reconciliation is not
sufficient on its own: the stale id has to be cleared, or the popover reopens unbidden when the
same van turns quiet again a day later.

No further a11y scope; the broader pass remains unscoped, as recorded in the progress notes.

## 7. Architecture

| File | Responsibility |
| --- | --- |
| `src/domain/fleetStatus.ts` | Pure projection: per-van statuses with sub-label facts, the three counts, today and next-business-day coverage facts. No React, no storage. |
| `src/domain/fleetStatus.test.ts` | Its suite (§9). |
| `src/ui/FleetView.tsx` | Glance header, stat strip, attention cards, tile grid. Renders the projection; computes nothing itself. |
| `src/ui/InspectPopover.tsx` | The popover: content, open/close, edge flip, focus handling. |
| `src/ui/NavTabs.tsx` | The two tabs; presentation over a `view` value and an `onNavigate` callback. |
| `src/App.tsx` | Two independent values, not a router: `tab: 'fleet' \| 'plan'` (default `'fleet'`) and `planView: 'planning' \| 'summary'` (default `'planning'`). Crossing between tabs never touches `planView`, so a commit summary survives any number of trips to the fleet and back, by the tab, the fleet's button, an attention card or a popover link. Only a commit, the week-change effect or reset moves `planView`. |
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
for workshop days, and the queue's urgency and because wording.

`fleetOverview` takes the same effective decisions `App.tsx` already computes for the band, and
**every** coverage line it returns is derived from them, today's included. That is what makes the
"two surfaces can never disagree about the same date" claim true rather than aspirational; it was
aspirational until the final fix wave, because today's line alone read the committed set. The
function derives its week from `today` via `mondayOf` and takes no `weekId` argument: a second,
independently-supplied week id would only be a chance to pass a mismatched one and get answers
derived from `today` anyway, silently.

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
7. One capacity semantics: in an uncommitted week 41, scheduling the resurfaced specialist item
   onto today in draft alone makes `today.covered` false with a specialist shortfall of 1, where
   a committed-only reading would call the day covered (§4).
8. Decisions waiting: 5 at cold open, 0 once every item carries a committed disposition, and the
   held van with no queue item contributes none (§4).
9. A red van with `itemId === null` is reachable and exercised: week 41's V-012, held, with its
   week-40 item committed and out of the queue. This is the shape the non-navigating attention
   card depends on (§5).

UI stays browser-verified live, per the project's no-component-tests precedent [S §1]. Manual
checks at the end of the task: land on the fleet view after the cover note and after reload;
tab switch preserves an in-progress draft; card click selects the right item; popover open, close,
Escape, edge flip; commit then return to the fleet view and see booked, watching and the committed
CTA state; commit then cross to the fleet and back by all four routes and find the summary still
there; **Open the fleet** from About lands on the fleet from either surface; reset restores the
cold-open board; `npm test`, `npx tsc --noEmit`, `npm run build`, and the built `dist/` served over
HTTP still behave. Not a literal `file://` open of `dist/index.html`: Vite's build puts a
`crossorigin` attribute on the module script and stylesheet, which Chrome refuses under the `file:`
scheme, so the app never boots that way. Pre-existing across the whole project, recorded in the
acceptance record's limitations rather than worked around here.

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
