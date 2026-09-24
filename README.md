# Fleet maintenance: weekly planning prototype

A working prototype for the MARKT-PILOT Product Builder Challenge.

**The user.** The part-time Fuhrparkverantwortliche at one depot of 45 vans. Fleet is a fraction of
their job, they carry personal liability under UVV, and they can pull a vehicle from service.

**The problem.** Decide what to service this week and what can reasonably wait, while seeing what that
decision does to work already committed.

**The promise.** Make this week's maintenance plan, understand the trade-offs, and leave nothing
deferred without a reason and a follow-up.

## Running it

```bash
npm install
npm run dev     # then open the printed URL
```

To produce the static bundle:

```bash
npm run build   # writes dist/, which can be opened directly from the filesystem
```

To run the tests:

```bash
npm test        # 252 tests over the domain and state layers, including the ten
                # verification scenarios end to end
```

No backend, no network calls, no accounts, no configuration. State is kept in `localStorage` under
`fleet-maintenance-prototype/v1`, and the yellow demo bar has a reset control.

**First launch opens a cover note** addressed to the evaluation panel: the framing, the choices made,
and what is simulated, before the product itself. `Open the fleet` continues to the app, landing on the
fleet overview, and `About this prototype` in the demo bar brings the note back at any time. Reset deliberately does not
resurrect it.

## The five-minute walkthrough

1. The app opens on **Fleet today**: 45 vans at a glance, one already off the road, four more
   needing a decision, and tomorrow's shortfall flagged. Click any quiet van to inspect it.
2. Switch to the week plan. Week 40 carries five decisions and two blockers. `V-012` is already out
   of service, before anything is committed.
3. Open `V-118`. Tuesday is red because of it. Switch the slot to Thursday and watch Tuesday clear in
   the band above. Try Wednesday instead to see the shortage land there rather than disappear.
4. Open `V-041` and schedule it. The specialist row breaks while the aggregate still looks plausible.
   No lever closes it: a standard rental is not a specialist van.
5. Defer `V-041` with a reason, a review date and a trigger. The second blocker clears.
6. Look at `V-012`. Bundle and watch are disabled, with the UVV reason shown rather than hidden.
7. Commit. The summary carries the visits, forward availability, the cover assumptions including the
   absence of specialist cover, and the deferred follow-ups.
8. Advance the clock to the next review date. `V-041` returns with its rationale intact, and week 41
   opens with two new cases of its own: `V-105`'s HU deadline and `V-024`'s tyre tread, both
   proposed for the same Thursday and leaving it one standard van short. Reset.

## What is simulated

Everything outside the depot. Vehicle data, telematics, inspection findings, garage slots, parts lead
times, rental cover and prices are all fixtures, labelled in the UI. Commit is a simulated commitment:
the fixture guarantees the selected slots and confirms them with the plan. **Nothing is sent anywhere,
and no external booking exists.** Prices are scenario prices.

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

## Limitations

The full list with evidence lives in `docs/acceptance.md`. The ones to know before judging the build:

1. Week 41 additionally authors two new cases (a HU deadline and a tyre-tread estimate, both
   landing on the same Thursday). Week 42 and later still carry only resurfaced items.
2. The walkthrough was verified live in a browser by the build's own tooling, twice, but not observed
   with a person unfamiliar with the build, so G1 and G5 carry no independent usability evidence.
3. Real-world booking rejection and pending confirmation are not modelled.
4. The safety hard stop is a chosen product rule, not a verified legal implementation of UVV.
5. No component tests. The domain and state layers are tested; the UI was verified live.

## What I would build next

1. **The interruption as a diff on this plan.** A driver report or a garage scope change arrives, opens
   this same surface with the change highlighted, and asks one question: does this change the plan? The
   fixture already carries the event, `V-103` extending to a second day, which reproduces a Wednesday
   shortage because `R-2` does not cover Wednesday.
2. **Bundle versus split, shown honestly.** One longer visit against two shorter ones, with the risk
   that missing parts or newly found defects extend the stay. The product must not silently stack
   everything onto one visit.
3. **Pending rather than guaranteed booking.** The honest production model, where a garage can decline
   and the summary has to say *pending* rather than promising confirmed availability.

## Where the thinking lives

- `docs/fleet-maintenance-work-packages.md`: the build contract, scope, goals and what was cut
- `docs/superpowers/specs/2026-09-23-fleet-maintenance-prototype-design.md`: the technical design
- `docs/superpowers/specs/2026-09-23-cover-note-design.md`: the in-app cover note, specified separately
- `docs/superpowers/specs/2026-09-23-fleet-overview-design.md`: the fleet overview landing screen, specified separately
- `docs/superpowers/specs/2026-09-24-replacement-cover-design.md`: requesting and costing replacement cover, specified separately
- `docs/fleet-maintenance-research-findings.md`: research and framing
- `docs/mockups/`: layout decisions and the alternatives they were made from, including the
  guided-queue declutter proposal the current surface follows
- `docs/acceptance.md`: what was verified, how, and what was not
