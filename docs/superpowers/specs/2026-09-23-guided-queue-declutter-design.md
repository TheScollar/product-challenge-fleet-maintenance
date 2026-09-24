# Plan surface declutter: guided queue. Design spec

A presentation-layer revision of the weekly plan surface: slim two-row tiles, a queue grouped by
what stands between the user and commit, blocker chips beside the commit button, one meaning for
red, and a capacity band that is loud only where something is wrong.

**Status.** Approved in brainstorming on 2026-09-23, against the mockup
`docs/mockups/redesign-guided-queue.mockup.html`. This revises how the plan surface *renders* the
design in `2026-09-23-fleet-maintenance-prototype-design.md` ([S]); it changes no domain rule, no
state shape, and no interaction contract. Where copy changes, the new copy is stated here.

**Reference convention.** `[S §n]` points into `2026-09-23-fleet-maintenance-prototype-design.md`.
The mockup is the visual reference; this document is the specification where the two disagree.

---

## 1. The problem being fixed

Four observations from the built surface, all confirmed against the running app on 2026-09-23:

1. **A tile carries up to eight elements at near-equal weight.** Vehicle ID, up to four badges,
   title, urgency chip, a full evidence sentence, a corner status, sometimes a "Previously" line.
   Six of them are bold. Nothing wins the first glance.
2. **The decision status is the least visible element on the tile.** It is the only element that
   changes as the user works, and it renders at 10.5px in the corner while static evidence prose
   gets a full line on every tile.
3. **Red carries five meanings at once.** Blocker text, the short day, the flagline, shortfall
   statuses, the Deadline chip, the safety badge. When red is everywhere, nothing says
   "start here", which is the stated "low visual guidance" complaint.
4. **Five strata stack before content.** Demo bar, header, band, flagline, pane titles. The band
   spends most of its area on unremarkable `38 / 38` pairs; only exceptions carry information.

## 2. What does not change

The interaction model is untouched: select a tile, read evidence right, pick a slot or defer,
watch the band react, commit when nothing blocks. Domain and state layers are untouched, so the
183 existing tests must pass unmodified. The cover note, commit summary and daily confirmation
are out of scope. The demo bar keeps its role and content and loses one notch of padding and
contrast, nothing more. Evidence remains one click away, never hidden: it moves from every tile
to the detail pane of the selected item, which is where the decision is actually made.

## 3. Tile anatomy

Two rows, roughly half the current height.

- **Row 1:** vehicle ID (the only bold element on the tile), then badges, then a spacer, then the
  **decision status** right-aligned: 11.5px, semibold, colored by tone. The status is the loudest
  text on the tile because it is the only element that answers "what is left to do here".
- **Row 2:** the item title in regular weight, then a spacer, then the urgency chip.
- **Left edge:** a 3px border carries the group color (§4): `--crit` for blocking, soft green
  `#bfd8c9` for settled. Selection replaces it with `--accent` plus the existing ring.
- **Dropped from the tile:** the urgency `because` sentence and the "Previously" prose. Both move
  to the detail pane (§7). The Resurfaced badge stays on the tile so the state is still visible
  at queue level; only the prose moves.
- **Badges** shrink to 9px, lose saturation, and keep their semantics: Safety stays red-tinted
  (it is the hard stop and has earned the color), Specialist purple, Held and Resurfaced muted.
  Held keeps its date: "Held since Fri 25 Sep", using `formatDay` as everywhere else.
- **Settled tiles** dim: title in `--muted`, badges and urgency chip at 70% opacity. The tile
  reads as done without becoming invisible.

Status copy, replacing `dispositionLabel`'s current strings only where stated:

| State | Copy | Tone |
| --- | --- | --- |
| Contributes to a capacity shortfall | `Causes Tue shortfall` (weekday of the short day) | crit |
| Slot infeasible or parts not ready | `Slot not bookable` (unchanged) | crit |
| No decision recorded | `No decision` (was "Decision needed") | crit |
| Watch chosen, record incomplete | `Watch, incomplete` (unchanged) | crit |
| Watch complete | `Watch until Mon 2 Nov` (unchanged) | muted |
| Slot booked | `Tue 29 Sep booked` (unchanged) | ok green |

If an item contributes to shortfalls on more than one day, the first short day in week order is
named. The weekday is the first token of `formatDay`.

## 4. Queue grouping

The flat list becomes groups derived from state that already exists (`blockersForItem` and the
draft decision), computed by a new pure function and rendered only when populated:

- **Blocking the week** (`--crit` header): every item whose blocker list is non-empty.
- **Settled** (muted header): every item with a complete decision (a booked slot, or a watch with
  its full deferral record) and no blockers.

A third state, decided-incomplete-but-not-blocking, cannot occur under this product's validation
rules: an absent or incomplete decision is itself a commit blocker ("leave nothing deferred
without a reason and a follow-up"), so undecided always means blocking. The grouping function
still classifies exhaustively (blocking / open / settled) so a future relaxation of validation
gets a third group for free, but the current UI can only ever render two.

**Amended 2026-09-24** (`2026-09-24-scenario-and-cover-accounting-fixes-design.md` §4). The third
state now occurs. An undecided or incomplete item is `To decide`, in the dashboard's amber, and only
capacity, slot and parts blockers make an item `Blocking the week`. Two or more undecided items
collapse into one amber header chip, `n to decide`. Validation is unchanged: an undecided item still
blocks Commit.

Group headers use the existing pane-title style with a count: `Blocking the week · 3`,
`Settled · 2`. Ordering within a group is the existing `orderQueue` order, filtered; the pane
title "Decisions needing attention · 5" is replaced by the group headers, which carry the counts.
The empty-queue message is unchanged.

The grouping function lives in `src/ui/grouping.ts`, takes `{ items, decisions, blockers }`,
returns the ordered, labelled groups, and gets its own unit test file. It contains no JSX, so it
is testable under the existing vitest setup without component testing.

## 5. Header blocker chips

The header's blocker prose (first blocker described, `(and 1 more below)`) is replaced by one
chip per blocker, rendered between the week metadata and the commit button so the cause sits
beside the action it blocks. A chip is a red pill with a dot: `V-041 · no decision`,
`Tue 29 Sep · standard short 1`. Chip copy comes from the blocker itself (vehicle and reason
for item-attributed blockers; day, class and magnitude for capacity blockers).

Clicking a chip selects the offending item: for item-attributed blockers, that item; for a
capacity blocker, the first item in queue order whose blocker list contains it. Selection alone
is the navigation: the band already reacts to selection, and the selected tile already shows the
ring. No scrolling machinery is specified; with a five-item queue the tile is on screen.

After a successful commit the blockers are gone, chips render nothing, and the existing
"Committed {date}. Simulated, nothing was sent." note is unchanged.

## 6. Color discipline and the exception-first band

**The red rule: red means "this blocks the week", plus the safety hard stop.** At week-40 open,
red appears in exactly: the two blocker chips, the Blocking group (header, left edges, statuses),
the Tue band cell and the flagline, the `no specialist cover` note, and V-012's safety badge.
Nowhere else.

- The **Deadline** urgency chip changes from red to a solid dark chip (`#2b3138`, white text): a
  deadline is a fact, not an alarm. Estimate stays amber, Assessment needed stays gray.
- **Green** keeps meaning headroom or completion: spare band cells, candidate day outlines,
  booked statuses, settled left edges.
- **Blue** stays selection and liveness only: selected tile, selected slot, `Reacting to V-x`.

**The band goes exception-first.** Quiet cells (available = demand) lose their box and fill and
render faint (`--faint`, weight 500). Exception cells keep a box and gain the existing soft fill
with bold numbers and the `short n` / `+n` sub-label. Day headers render always. The live
behaviors are unchanged and take precedence visually: the `Reacting to V-x` chip, and the
impacted (red) / candidate (green) outlines, which apply to quiet days too; a quiet day that
becomes impacted or candidate gets its outline without acquiring a fill. The flagline renders
exactly when a shortfall exists, unchanged. The cover summary (`R-1 Mon to Fri · R-2 Tue and Thu
only · no specialist cover`) stays in the band head, one notch fainter, with `no specialist
cover` still red: it is a blocking fact.

## 7. Detail pane additions

The pane absorbs what the tiles dropped, in the head, before the evidence blocks:

- Under the title sub-line, a **because line**: the urgency's `because` sentence, 12px muted.
  Today the tile is that sentence's only home; after this change the detail pane is.
- For resurfaced items, a **previous-decision line** under the because line, with the same
  treatment as the because line: `Previously: watch, decided Mon 21 Sep. {reason}`. The data already
  reaches the queue via `queueFor` (`priorDecision`, `resurfacedBecause`); `ItemDetail` gains
  access to the same entry rather than recomputing it.

Everything else in the pane (Observation, Assumption, Consequence, slots, treatment form) is
unchanged.

## 8. Implementation boundary

Touched: `src/ui/ItemCard.tsx`, `src/ui/DecisionQueue.tsx`, `src/ui/PlanHeader.tsx`,
`src/ui/CapacityBand.tsx`, `src/ui/ItemDetail.tsx`, `src/ui/theme.css`, new `src/ui/grouping.ts`
plus its test. Untouched: everything under `src/domain/` and `src/state/`, and the remaining UI
components. No new dependencies. `README.md`'s pointer to `docs/mockups/` is updated from "the
two layouts" to include this proposal.

## 9. Verification

1. `npm test` green: the existing 183 tests unmodified, plus the new grouping tests.
2. The seven README walkthrough steps re-run live in a browser, since the walkthrough's visible
   moments (Tuesday clearing, the shortage landing on Wednesday, the specialist row breaking,
   V-012's disabled levers) are exactly what this restyle must not break.
3. Visual acceptance at week-40 open, against §6's red rule: count the red elements; any red
   outside that list is a defect. The Deadline chip is not red. Quiet band cells have no boxes.
4. Blocker chips: clicking each selects the expected item; after commit, no chips render.
5. Tile regression: every element dropped from a tile is present in the detail pane for the same
   item (because line for all five items; previous-decision line for a resurfaced item after
   advancing the clock past V-041's review date).

## 10. Out of scope

The commit summary and cover note surfaces; any demo-bar change beyond the stated one-notch
compaction; responsive or mobile layout; copy rewrites beyond the strings stated in §3 and §5;
component-level test infrastructure (the no-component-tests limitation in `docs/acceptance.md`
§limitations stands and this spec does not claim to lift it).
