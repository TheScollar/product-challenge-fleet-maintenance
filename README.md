# Fleet maintenance: a weekly planning prototype

**Built by [Dennis Scollar](https://www.linkedin.com/in/scollar/), a PM who builds.** I prototype to test product decisions, so this is a working app and not a slide deck.

Every week, one person at a delivery depot has to decide which of 45 vans to service and which can wait, without leaving the depot short of vehicles. This prototype lets them make that plan, see what each choice does to work already committed, and leave nothing deferred without a reason and a follow-up.

It was my answer to a product challenge: *build a working prototype that helps a company manage maintenance for a fleet of 40 to 50 delivery vans*. The brief deliberately left the user and the problem open. The brief is in [`docs/product-builder-challenge-brief.md`](docs/product-builder-challenge-brief.md).

## What to notice

- **I chose one user and one problem, and cut the rest.** The part-time fleet manager, one depot, one week, one journey. No dashboard of everything.
- **The product proposes and the user decides.** Every item opens undecided, and a recommendation is one click away but never applied for them. That matters because this user carries personal legal liability.
- **Trade-offs are visible, not hidden.** A capacity band recomputes as you plan, so you see a shortfall appear the moment a choice causes it, and see which lever (move, cover, defer) closes it.

## The problem, in plain terms

**The user.** The *Fuhrparkverantwortliche* (fleet officer) at one depot of 45 vans. Fleet is a fraction of their job, they are personally liable under *UVV* (German accident-prevention rules covering vehicle safety), and they can pull a vehicle from service.

**The decision.** What to service this week and what can reasonably wait, while seeing what that does to routes already committed.

**The promise.** A plan for this week, the trade-offs understood, and nothing deferred without a reason and a follow-up.

**Glossary.** *UVV*: the German accident-prevention regulation that makes the keeper responsible for safe vehicles. *HU*: the mandatory periodic vehicle inspection (Hauptuntersuchung). *Fuhrparkverantwortliche*: the person responsible for the fleet.

## How I approached it

1. **Read the brief for what it left out.** It said the product was "intentionally underspecified", so the first job was choosing a user and a problem, not features.
2. **Research the domain before designing.** Most downtime is queueing for parts and bays, not repair work, and more alerts do not produce better decisions. That pointed away from monitoring and toward a planning ritual. See [`docs/fleet-maintenance-research-findings.md`](docs/fleet-maintenance-research-findings.md).
3. **Lock the scope in writing.** A build contract states the goals, what is in, and what was deliberately cut: [`docs/fleet-maintenance-work-packages.md`](docs/fleet-maintenance-work-packages.md).
4. **Compare layouts before committing.** Two layouts were mocked up and tested against the hardest interaction before one was chosen: [`docs/mockups/`](docs/mockups/).
5. **Specify each feature, then build it.** Each feature has a dated design spec and an implementation plan under [`docs/superpowers/`](docs/superpowers/).
6. **Verify and state the gaps.** What was checked, how, and what was not: [`docs/acceptance.md`](docs/acceptance.md).

### Five decisions that show the thinking

The full list, with the alternatives I rejected, is in [`docs/decisions.md`](docs/decisions.md).

- **Capacity is computed per vehicle class, not in aggregate.** An aggregate count says "one van short" and sounds forgivable, while the only specialist van is off the road with nothing able to cover it. One van in the data (`V-041`) exists to make that visible.
- **Urgency is three states, never a score.** A known deadline, an estimate with its assumption named, or `assessment needed`. No number is invented where the evidence supports none.
- **Deferral is a record, not a gut call.** A reason, a review date and a trigger are all required, and the item comes back carrying them.
- **A blocked plan is a legitimate outcome.** The draft survives and the blocker is named. The interface never claims readiness it doesn't have.
- **Predictive failure modelling was rejected.** A black box cannot help someone who is personally liable understand why a van needs attention. A structured, explainable recommendation can.

## How I work

Each principle links to where it shows up in this repo.

1. **Frame the user and the decision before any code.** [`research-findings`](docs/fleet-maintenance-research-findings.md), [`work-packages`](docs/fleet-maintenance-work-packages.md).
2. **Compare options visually before committing.** [`docs/mockups/`](docs/mockups/).
3. **Write down what I rejected, and why.** [`docs/decisions.md`](docs/decisions.md).
4. **Derive state rather than store it.** Only decisions are stored. Capacity, visits, blockers and the summary are computed, which is why recommitting a plan cannot duplicate a visit. See the [design spec](docs/superpowers/specs/2026-09-23-fleet-maintenance-prototype-design.md).
5. **Say what is simulated and what is unverified.** See [What is simulated](#what-is-simulated), [Limitations](#limitations) and [`docs/acceptance.md`](docs/acceptance.md).

## How I used AI

I used AI tooling (Claude Code with the Superpowers workflow) throughout, so here is where the line was.

- **Mine:** the framing and scope (who the user is, what problem, what to cut) and the domain rules (the safety hard stop, per-class capacity, deferral requiring reason, date and trigger).
- **Delegated to the agent, under my direction:** the written specs and plans, the implementation and tests, and the verification passes.
- **What that means for the evidence:** the walkthrough was checked live in a browser by the agent's own tooling, but never watched with a person unfamiliar with the build. I would not claim usability results from it.

## Try it

A guided path with the figures to expect at each step is in [`docs/walkthrough.md`](docs/walkthrough.md). The short version:

1. Open the app. It starts with a cover note, then lands on **Fleet today**: 45 vans, one off the road, four needing a decision.
2. Open the week plan and the vehicle `V-012`. Click **Use proposal**, then **Apply to draft**, and request replacement cover. Watch the capacity band clear and the cost tile show EUR 700.
3. Keep planning until something cannot be closed (`V-041`). Defer it with a reason, review date and trigger, then commit.

## What is simulated

Everything outside the depot. Vehicle data, telematics, inspection findings, garage slots, parts lead times and replacement-cover prices are fixtures, labelled in the UI. Commit is a simulated commitment. **Nothing is sent anywhere, and no external booking exists.** Prices are scenario prices.

## Limitations

The full list with evidence lives in [`docs/acceptance.md`](docs/acceptance.md). The ones to know before judging the build:

1. Week 41 additionally authors two new cases (a HU deadline and a tyre-tread estimate, both proposed for the same Thursday). Week 42 and later carry only resurfaced items.
2. The walkthrough was verified live in a browser by the build's own tooling, twice, but not observed with a person unfamiliar with the build, so the usability goals carry no independent evidence.
3. Real-world booking rejection and pending confirmation are not modelled.
4. The safety hard stop is a chosen product rule, not a verified legal implementation of UVV.
5. No component tests. The domain and state layers are tested; the UI was verified live.

## What I would build next

1. **The interruption as a diff on this plan.** A driver report or a garage scope change arrives, opens this same surface with the change highlighted, and asks one question: does this change the plan? The fixture already carries the event, `V-103` extending to a second day, which reproduces a new capacity shortfall when the requested cover does not extend with it.
2. **Bundle versus split, shown honestly.** One longer visit against two shorter ones, with the risk that missing parts or newly found defects extend the stay. The product must not silently stack everything onto one visit.
3. **Pending rather than guaranteed booking.** The honest production model, where a garage can decline and the summary has to say *pending* rather than promising confirmed availability.

## For engineers

React 19 and TypeScript, Vite, and Vitest. No backend, no network calls, no accounts. State lives in `localStorage` under `fleet-maintenance-prototype/v1`, and the yellow demo bar has a reset control.

```bash
npm install
npm run dev     # then open the printed URL
npm run build   # writes dist/, which can be opened directly from the filesystem
npm test        # 325 tests over the domain and state layers
```

First launch opens a cover note for the evaluation panel: the framing, the choices made, and what is simulated. `Open the fleet` continues to the app, and `About this prototype` in the demo bar brings the note back. Reset deliberately does not resurrect it.

## Where the thinking lives

- [`docs/product-builder-challenge-brief.md`](docs/product-builder-challenge-brief.md): the brief I was given
- [`docs/fleet-maintenance-research-findings.md`](docs/fleet-maintenance-research-findings.md): research and framing
- [`docs/fleet-maintenance-work-packages.md`](docs/fleet-maintenance-work-packages.md): the build contract, scope, goals and what was cut
- [`docs/decisions.md`](docs/decisions.md): every decision and rejected alternative
- [`docs/walkthrough.md`](docs/walkthrough.md): the guided path through the prototype
- [`docs/superpowers/specs/`](docs/superpowers/specs/): the technical design and one spec per feature
- [`docs/superpowers/plans/`](docs/superpowers/plans/): the implementation plans
- [`docs/mockups/`](docs/mockups/): layout decisions and the alternatives they were made from
- [`docs/acceptance.md`](docs/acceptance.md): what was verified, how, and what was not
