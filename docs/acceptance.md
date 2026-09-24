# Acceptance record

**Run on:** 2026-09-23
**Build:** 7e07d22
**Commands:** `npm test` (183 tests, 12 files, all passing), `npx tsc --noEmit` (clean), `npm run build`
(succeeds; `dist/index.html` verified to load from a filesystem-style origin), plus two consecutive
live browser walkthroughs of the section 7.3 journey against `npm run dev`.

**How the walkthrough was run, stated plainly.** The interactive walkthrough was executed by the
build's own agent tooling driving a real browser: every click, form entry, commit, reload, resurface
and reset was performed against the running app and asserted against the live DOM, twice, with
identical results. No human unfamiliar with the build has run it. Wherever a goal's criterion requires
an observed human, that element is recorded as **not run**, not as passed.

**Final whole-branch review.** After all tasks passed their gates, an adversarial review of the entire
branch deliberately left the scripted path. It found one Critical defect the per-task gates could not
see: switching an item to watch, filling the deferral, then changing the decision back to act-now left
the stale deferral attached, so one van committed as both a confirmed visit and a deferred follow-up
and later resurfaced despite being serviced. It also found three Important issues: a held van was
blamed for a shortfall its visit cannot affect, one surface still carried a superseded description of
the aggregate arithmetic, and the deferral trigger list was a fixed global list unscoped to the item.
All were fixed in build 7e07d22 with 17 new regression tests, and the Critical's exact repro was then
re-run live in the browser and confirmed dead: three visits, two deferred follow-ups, and no deferral
history entry for the switched item.

## Goals

- **G1, make attention understandable.** Structural elements: **passed.** At cold open the queue
  orders `V-012, V-041, V-103, V-118, V-027`, every item carries an urgency state and a one-line
  because naming its evidence, the band flags "Tue 29 Sep: standard short by 1. Off the road: V-012,
  V-103, V-118", and the 45-van fleet is represented without a 45-row list. The observed criterion,
  a person unfamiliar with the build identifying the top item and explaining why inside one minute:
  **not run.** No unfamiliar observer was available.
- **G2, support acting and waiting.** **Passed.** The walkthrough contains one warranted intervention
  (`V-118` moved to Thursday, clearing the shortfall) and one warranted deferral (`V-027`, never
  overturned by the fixture). Both expose observation, recommendation, consequence and uncertainty.
  Evidence: scenarios 2 and 7 in `src/domain/scenarios.test.ts`, plus the live pass.
- **G3, keep choices feasible.** **Passed.** Moving a visit recalculates capacity by day and class in
  view; garage bays, visit duration, parts-ready dates and confirmed cover are all checked before
  commit; the held vehicle stays unavailable all week; a blocked plan cannot reach a success state.
  Evidence: scenarios 3, 4, 5, 6 and 9, plus the live pass including the disabled Monday slot with its
  reasons and the specialist row breaking while the aggregate stays plausible.
- **G4, preserve the decision.** **Passed.** Deferring records rationale, review date and trigger, all
  required with missing fields named. Saved state survives reload. Advancing to the review date
  resurfaces `V-041` with its prior decision and rationale intact, in week 41, behind a `Resurfaced`
  badge. Evidence: scenario 8, the deferral suite, and the live pass.
- **G5, finish the primary journey.** Journey completeness: **passed**, twice. Inspect, change, defer,
  resolve the seeded conflict, commit; the summary carries visits, forward availability, cover
  assumptions and deferred follow-ups; recommitting created no duplicate visits. The roughly-five-
  minutes usability timing for an unfamiliar evaluator: **not run**, same limitation as G1.
- **G6, deliver a repeatable prototype.** **Passed.** Fresh launch, saved-state reload, reset and two
  consecutive walkthroughs behaved identically (three visits, two deferred follow-ups, clean forward
  availability, byte-identical seed after reset). The 183 automated tests pin the domain and state
  behaviour, including the ten verification scenarios end to end. The handoff (`README.md`) states the
  launch path, the simulated integrations, the limitations, the decisions taken, the alternatives
  rejected and the next step.

## Verification scenarios (work packages section 9)

All ten recorded as **passed**, each with an automated home plus the live pass:

1. Known safety-class issue at cold open: `scenarios.test.ts` describe 1, plus live (held before any
   commit, `bundle` and `watch` disabled with the UVV reason shown, booking does not release).
2. Justified routine deferral: describe 2 (`V-027` records reason, date, trigger; never forced).
3. Tight day with a feasible alternative: describe 3 (Thursday clears Tuesday and enables commit).
4. Aggregate capacity hides a specialist gap: describe 4 (standard fully covered, specialist short 1
   with zero cover; the aggregate reads one short of 45 and neither names the van nor shows the gap is
   uncloseable).
5. Multi-day visit overlaps an existing hold: describe 5 (every affected day counts, each vehicle
   once, no implied release).
6. Slot or part unavailable: describe 6 (Monday refuses `V-012` on both the bay and the parts date;
   an infeasible selection cannot become a confirmed visit).
7. Evidence insufficient: describe 7 (`V-041` reads assessment-needed; no invented waiting period).
8. Review date arrives or trigger fires: describe 8 (resurfaces with prior decision and rationale).
9. No feasible plan exists: describe 9 (draft survives, shortage visible, no success state).
10. Commit, edit, recommit, reload, reset: describe 10 (summary matches decisions, no duplicates,
    snapshot frozen until recommit, serialisation round trip, seed restored), plus live reload and
    reset checks.

## Known limitations

1. Week 41 additionally authors two new cases. Week 42 and later still contain only resurfaced
   items. See the "two new week-41 cases" addendum below.
2. The usability walkthrough was run by the build's own tooling, not observed with an unfamiliar
   person, so G1 and G5 carry no independent usability evidence.
3. Commit is simulated and fixture-guaranteed. Real-world rejection and pending confirmation are not
   modelled.
4. The safety hard stop is a chosen product rule, not a verified legal implementation of UVV.
5. All prices are scenario prices, not market data.
6. No component tests exist. The UI was verified live in a browser; the domain and state layers carry
   the automated suite.
7. The daily confirmation renders demand figures for whatever "tomorrow" is, including a weekend if
   the clock is advanced to Friday before committing. The seeded walkthrough never reaches that path;
   making the domain weekend-aware is future work.
8. `dist/index.html` cannot be opened as a literal `file://` URL. Vite's build puts a `crossorigin`
   attribute on the module script and stylesheet tags, which Chrome disallows under the `file:`
   scheme, so the app never boots that way. This is pre-existing behaviour of the whole project's
   build, not specific to any one feature, and the fix would be a build-config change. Serve `dist/`
   over HTTP (any static server) or use `npm run dev`.
9. The multi-day visit fact (`In workshop · day n of m`) is correct but unreachable through the
   running UI: nothing in the interface extends a visit's duration, so `canExtendToDays` has no
   consumer in `src/`. It is verified only by domain-level tests against a synthetic two-day
   fixture. Pre-existing, and out of scope of the fleet overview work.

## Addendum: guided-queue declutter re-verification

**Run on:** 2026-09-24 · **Build:** 6fc3195 (merged to main fast-forward) ·
**Commands:** `npm test` (208 tests, 14 files, all passing; adds a tested queue-grouping view model
in `src/ui/grouping.ts`), `npm run build` (tsc clean), plus a live headless-browser pass of the full
section 7.3 journey against the restyled surface, asserted against the DOM.

The plan surface was restyled per `docs/superpowers/specs/2026-09-23-guided-queue-declutter-design.md`:
slim two-row tiles grouped into Blocking the week / Settled, blocker chips beside Commit that select
the offending item, red reserved for what blocks the week, an exception-first capacity band, and the
evidence prose relocated to the detail pane. The live pass confirmed every walkthrough moment on the
new surface: the cold-open state, the V-118 Thursday move clearing Tuesday in view, V-041 breaking
the specialist row (now with its own chip naming the class), the required three-field deferral, the
disabled UVV levers with the reason shown, commit, resurfacing with the prior rationale in the detail
head, and reset. Limitation 6 stands: the view-model is unit-tested, the components are verified live.

## Addendum: the fleet overview landing screen (2026-09-23)

**Build:** 1a3710e · **Commands:** `npm test` (209 tests, all passing), `npx tsc --noEmit`
(clean), `npm run build` (succeeds; the built `dist/` verified by serving it over HTTP from a local
static server, **not** by opening `dist/index.html` as a literal `file://` URL, which does not work
in Chrome, see limitation 8), plus the live browser checks below.

The app now lands on a read-only fleet overview ahead of the weekly plan
(`docs/superpowers/specs/2026-09-23-fleet-overview-design.md`). The weekly plan remains the only
decision surface; the overview's only verb is navigation. Statuses are fully derived: red from
holds and committed visits, amber from queue items not resolved by a committed disposition, green
otherwise with booked and watching sub-labels from the committed plan and the deferral ledger.

**Verified live:** cold-open board (1 off the road, 4 needing a decision, 40 in service, attention
in queue order, Tuesday shortfall flagged for tomorrow); click-through to the week plan with the
item pre-selected; inspect popover open, close, Escape and edge behaviour; committed-week board
(booked, watching, no tomorrow warning); Tuesday with two vans off the road; week 41 resurfacing
with the V-012 release; reset and reload both landing on the fleet view.

**G1 restated from the new landing.** The structural claim now starts one screen earlier: at cold
open the fleet view shows the exception (V-012, held, safety) first among five attention cards,
with the 45-van fleet represented without a 45-row list. That is a claim about the fleet screen
alone and it still holds. It is deliberately **not** a claim that the week plan leads with the same
item: since the declutter redesign the plan groups by what blocks the commit, and V-012, held but
already dispositioned, sits settled and dimmed there. The two orderings answer different questions
and the fleet view now carries a legend saying so. The observed one-minute criterion remains
**not run** (no unfamiliar observer), unchanged from the main record.

## Addendum: final whole-branch review of the fleet overview (2026-09-24)

**Commands:** `npm test` (214 tests, 14 files, all passing; 5 added), `npx tsc --noEmit` (clean),
`npm run build` (clean), plus a live headless-browser pass in which each of the two behavioural
defects below was reproduced on the pre-fix code and then confirmed dead on the fixed code.

A review of the whole fleet-overview branch, deliberately off the scripted path, found one High and
one Medium-High defect that every per-task gate had missed, plus eight smaller issues. All are
fixed:

- **Two capacity semantics (High).** The projection read today's coverage from committed visits
  only while reading every other day, and the capacity band, from the draft. Reproduced live: in an
  uncommitted week 41 with the resurfaced specialist item scheduled onto today, the fleet header
  read "every assignment covered today" while the week plan one tab away read "Mon 5 Oct:
  specialist short by 1" and held Commit disabled over it. Both lines now read the same effective
  decisions. The van's red/amber/green colour is unchanged and still operational. Pinned by a new
  test that fails if today's line is reverted to the committed set.
- **A commit summary destroyed by tabbing (Medium-High).** Every route back to the plan side reset
  it to the editable split view, so a user who committed, glanced at the fleet and came back lost
  the summary and could only get it back by dispatching a second, needless commit. The view value
  is now two independent values, a tab and a plan face, and the summary survives all four routes
  back (the tab, the fleet's own button, an attention card, a popover link), verified live.
- **A dead-end attention card.** A van red for a hold alone, with no item in the week's queue,
  rendered a card promising "Open in week plan" that selected nothing. It now renders as
  information only. The CTA sub-line counts undecided queue items rather than attention cards, so
  it no longer overstates the work waiting (week 41 read "2 items waiting" where only one decision
  existed).
- **Cover note click-through.** **Open the fleet**, reached via About, now lands on the fleet from
  either surface, matching what [C §4] already claimed.
- **Popover robustness.** A stale open-request is reconciled against the quiet list and cleared, so
  it cannot resurrect a day later; focus is returned to the tile only on the Escape path, not when
  an outside click is already navigating away from it.
- **Docs corrected, not papered over.** The fleet overview spec's claim that its first attention
  card is the week plan's first item was true when written and is false since the declutter
  redesign; it now states plainly that the two screens order by different questions and that their
  reds mean different things. The acceptance record's claim that `dist/index.html` was verified
  from a filesystem origin was false; see limitation 8.

No colour value, queue ordering or sibling-owned component was changed. Limitation 6 still stands:
the projection is unit-tested, the components are verified live.

## Addendum: two new week-41 cases (2026-09-24)

**Build:** 2085c6c · **Commands:** `npm test` (221 tests, 14 files, all passing), `npx tsc --noEmit` (clean), `npm run build` (clean), plus a live
browser pass of the checklist in `docs/superpowers/plans/2026-09-24-week41-new-cases.md`'s manual
verification task.

Week 41 now authors two cases of its own, in addition to whatever resurfaces from week 40:
`V-105`'s Hauptuntersuchung (HU) deadline and `V-024`'s tyre-tread estimate
(`docs/superpowers/specs/2026-09-24-week41-new-cases-design.md`). Both default to the same
Thursday, which exhausts week 41's one spare unit of standard capacity and blocks commit until one
of them moves, the same mechanism V-118's week-40 Tuesday conflict already demonstrates, replayed a
week later with two new cases.

**Verified live:** both cases appear as attention cards on the fleet overview from the moment week
41 is reached, each with its own urgency chip and because-text. The week plan's "Blocking the week"
group lists three items (V-024, V-105 and, if still undisposed, V-041). V-105 carries no parts
requirement and can move to Tuesday, Wednesday or Friday to clear the Thursday shortfall; V-024's
parts are not ready until Wednesday, so only Wednesday or Friday work for it, and the slot picker
disables Monday and Tuesday for that reason. Moving either item to Monday instead relocates the
shortfall rather than clearing it, since Monday's one spare unit is already spent on V-012's hold.
Committing after relocating one case shows `Booked Thu 8 Oct` for the item left on Thursday and the
chosen day for the other.

## Addendum: final whole-branch review of replacement cover (2026-09-24)

**Commands:** `npm test` (252 tests, 16 files, all passing; 1 added), `npx tsc --noEmit` (clean),
`npm run build` (clean), plus two live browser passes, one before the fixes below and one after.

**Pre-fix live pass**, run before the findings below existed, exercised the feature end to end. All
three booking entry points, the fleet-grid popover, an attention card and the plan-surface item
detail, produced a working request form. A requested booking cleared a real Tuesday capacity
shortfall, the "tomorrow" warning disappearing once it was in place. The dashboard's cost figures
updated live as bookings were added, observed going EUR 2,420 → EUR 2,560 → EUR 3,120 across two
bookings; pushing the total to EUR 3,120 against a EUR 3,000 budget left Commit enabled and showed
"EUR 120 over the EUR 3,000 budget". The commit summary froze that same over-budget total and
listed both bookings sorted by vehicle ID. Reset cleared both the draft and the just-committed
booking back to the EUR 2,420 baseline. The specialist-disabled state, "No specialist replacement
cover exists.", rendered correctly at every entry point, including a quiet (green) specialist van's
popover.

A review of the whole replacement-cover branch, deliberately off the scripted path, found four
Important issues that every per-task gate had missed. A first fix round closed three of them; the
re-review found the fourth still open (the in-app copy the first round should also have corrected)
plus a gap in this addendum's own verification claim; a second round closed both. All are fixed:

- **A data-loss bug (Important).** `replacementBookingErrors` checked `days < 1` but never checked
  it was an integer, and the days input carried no `step`, so a user could type `1.5` and have it
  accepted and stored. The stricter persistence validator, `isReplacementBooking`, already requires
  `Number.isInteger(days)`, so the next page load found the stored state invalid and reset the
  entire app to the seed, silently destroying every decision and booking made. Fixed by tightening
  the domain check to also require an integer, matching persistence; the days input now also
  carries `step={1}` as defense in depth; the live cost/downtime preview now applies the same
  integer gate; pinned by a new regression test.
- **Duplicated cost-tile markup (Important).** `FleetView` and `CommitSummary` each carried a
  byte-identical three-tile cost block, the same risk on the presentation side that
  `costSummaryFor` was built to close on the calculation side (5bbdec1, 25dee47). Extracted into a
  shared `CostAgainstBudget` component; both surfaces now render from the same markup.
- **A capacity-band legend gap (Important).** The band's cell numbers already reflected a requested
  booking via `adHocCoversFrom`, but its header legend read only `fixture.covers`, so the line
  explaining where cover comes from never mentioned a booking that had just changed the numbers
  above it. `fleetStatus.ts`'s `coverageFor` already appended ad hoc covers to the dashboard's
  equivalent line; the band's `covers` now does the same, bringing it in line with the dashboard.
  **Post-fix live pass** (booking `V-001` for Tuesday): the band's legend read `R-1 Mon to Fri · R-2
  Tue and Thu only · V-001 replacement Tue only · no specialist cover`, Tuesday's standard cell read
  `38 / 38`, and the dashboard's live `CostAgainstBudget` render showed matching figures.
  `hasSpecialistCover` was unaffected, since an ad hoc cover is always standard-class. The commit
  summary's frozen render of the same component was not re-run live this round; its figures were
  independently verified live in the Task 12 per-task review, and the component is identical code
  shared with the dashboard render that was re-checked here.
- **Docs corrected, not papered over.** `README.md`'s "the three cost figures stay apart" claim
  contradicted the shipped code, which deliberately combines service and cover cost; the in-app
  cover note (`coverNoteContent.ts`), the user-facing instance of the same claim on the About
  screen, carried the identical contradiction and was missed by the first fix round, along with its
  own source of truth, `docs/superpowers/specs/2026-09-23-cover-note-design.md` §3.6, against which
  a future re-sync would have reinstated the superseded claim. All three now agree: the
  cover-note spec carries a dated amendment, the cover note's copy follows it under a documented
  exception, and the README states the same narrowed rule. `costs.ts`'s comment citing the cover
  note as unqualified authority for the old, wider rule was reworded to name the narrowing
  explicitly, and now calls `bookingCostEur` instead of inlining a copy of its formula, closing a
  Minor item this addendum's second draft had accidentally dropped while still true. `README.md`'s
  test count (stale at 209 since before this branch) and spec index were also corrected.

Left as follow-up, all Minor: `ItemDetail`'s booking-control mount relies on its parent's key
rather than carrying its own; `isReplacementBookingComplete` is unused dead code; specialist
exclusion is enforced on the UI/validation path but not at the state-write boundary, low risk for a
single-writer localStorage prototype; the README's own walkthrough does not mention requesting a
replacement, so an evaluator following only that script will not encounter this feature.

## Addendum: scenario and cover accounting fixes (2026-09-24)

**Commands:** `npm test` (294 tests, 17 files, all passing), `npx tsc --noEmit` (clean), `npm run build`
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

**Live pass.** Run in a real browser and verified by reading DOM text and attributes; the screenshot
tool failed, so no screenshots exist for this pass. Cold open: one red, four amber, five to decide,
cost tiles at EUR 0, no request control on any dashboard surface, band cells `37 + 1 / 38` and
`37 + 2 / 38` with Tuesday and Thursday outlined green. Adopting the three Tuesday proposals
(`V-012`, `V-103`, `V-118`) turned Tuesday red at `35 + 2 / 38`; `V-027` was still undecided at that
point, so the header chips read `2 to decide` and `Tue 29 Sep · standard short 1`, and the queue
grouped as `Blocking the week · 2` (`V-103`, `V-118`), `To decide · 2` (`V-027`, `V-041`),
`Settled · 1` (`V-012`). Requesting five days of cover for `V-012` moved its Consequence tile from
`not requested` to `EUR 700` and the dashboard tiles to EUR 1,440, EUR 700, EUR 2,140. Switching
`V-118` to Watch removed its booking and cost. Later in the pass, before Commit, `V-027` was adopted
with **Use proposal** (Watch, rationale, review date Mon 2 Nov and trigger prefilled) and applied,
after which the header showed no chips and Commit was enabled. After the walkthrough commit,
`V-012`'s red card read `Replacement on site · day 1 of 5`, and `day 2 of 5` on Tuesday.

**A stale replacement-cover key (found in review).** The task review of the detail pane found that
the replacement-cover control's open form could survive switching an item to Watch and back, because
its React key never changed; fixed by keying the control on the vehicle and on whether a visit is
applied (commit `0a044d5`), and verified by re-review.

**Claims corrected elsewhere.** G1's cold-open evidence (the band flagging Tuesday) now applies
after adoption, not before; at the true cold open the queue reads `V-012, V-027, V-103, V-118,
V-041`, and once every proposal is adopted the earlier order returns. The week-41 addendum's
Thursday collision between `V-024` and `V-105` (above) likewise now appears only once both of that
week's proposals are adopted, not at week 41's own cold open. The cover note's third "What you are
about to see" paragraph, its source spec, the README walkthrough and four specs carry dated
amendments. A fifth spec, `2026-09-24-week41-new-cases-design.md`, was not in the plan but carries
one too: its two `consequence.coverCostEur` rows (`V-024`, `V-105`) name a field deleted along with
the rest, found while scanning the docs tree for stale references to it, and it now carries two
more, in §4 and §7, about the Thursday collision above appearing only once both proposals are
adopted. The Codex attempt at the
same fixes, reverted before any commit, is preserved as
`.superpowers/sdd/codex-fleet-scenario-fixes-2026-09-24.patch` for reference only.
