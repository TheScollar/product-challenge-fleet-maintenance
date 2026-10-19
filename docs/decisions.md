# Decisions and rejected alternatives

The full list behind the [README](../README.md). Each decision is one the prototype enforces in code, not just in prose.

## Decisions taken

- **One user, one depot, one week, one entry point.** The weekly ritual is the only journey built.
- **Capacity is computed per class, not in aggregate.** An aggregate count reads one van short and
  forgivable while the only compatible specialist van is off the road with nothing to cover it.
  `V-041` exists to make that visible.
- **Urgency is three states, never a score.** A known deadline, an estimate with its assumption named,
  or an unknown condition that reads `assessment needed`. No number is invented where the evidence
  supports none.
- **Disruption stays apart; spend does not.** Operational disruption is never blended into money: it
  stays a count of uncovered assignments, because turning it into euros needs a revenue-per-route
  figure the fixture cannot support, and cover reads `not available` rather than zero where none is
  compatible. Service cost and replacement-cover cost are different: both are spend, so the
  replacement cover feature combines them into one weekly total tracked against a budget
  (`docs/superpowers/specs/2026-09-24-replacement-cover-design.md` §4.2).
- **The system proposes, the user decides.** Every item opens undecided. The proposal is one click
  away and never adopted for you. A replacement is a consequence of a visit you have applied, never
  a freestanding purchase, and cover cost exists only where cover was requested. No replacement cover
  is pre-confirmed in the seed.
- **Deferral is a record, not a gut call.** Reason, review date and trigger are all required, and the
  item comes back carrying them.
- **A blocked plan is a legitimate outcome.** The draft survives and the blocker is named. The UI never
  claims readiness it does not have.
- **Decisions are stored, everything else is derived.** Capacity, visits, blockers and the summary are
  all computed. That is why recommitting cannot duplicate a visit and why a held van with a booked
  visit is never subtracted twice.
- **A hold is a question about a date, not a flag.** The held van stays unavailable until the fixture
  records a release, booking a visit never releases it, and every availability computation asks one
  predicate, isHeldOn, wherever a date is in play.

## Alternatives rejected

- **Predictive failure modelling.** A black box fails the "help the user understand what deserves
  attention" test, especially for a user carrying personal liability. The structured recommendation is
  the alternative.
- **A separate interruption screen.** An event arriving is a change to the existing plan, not a second
  workflow. Out of scope here, and described rather than built.
- **Route reassignment as a lever.** With no reserve vehicles it cannot create capacity, so offering it
  would suggest a lever that does not work. The daily confirmation is read-only.
- **A detail panel over the capacity view.** It hid capacity during the one interaction that changes
  it. Both layouts are in `docs/mockups/` if you want to compare.
- **A "fire trigger now" button.** It has no real-world analogue. Advancing the clock fires both
  odometer and event triggers instead.
