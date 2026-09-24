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

1. Week 41 and later contain only resurfaced items. No new work is authored for them.
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
