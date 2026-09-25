# Speaker script: the weekly maintenance plan prototype

About nine minutes with the live demo, seven without it. Square brackets are stage directions.
Lines marked (cut) can go if time is short.

> **Readiness note — 25 September 2026.** The walkthrough below reflects the latest fixture, with no
> pre-confirmed rental cover. The implementation path and final EUR 2,420 total have been checked
> directly, but the fixture change has not yet been reconciled with the existing automated
> expectations: 247 of 302 tests pass and 55 still encode the prior pre-confirmed-cover scenario. Do
> not claim a green suite in the presentation until those expectations and the acceptance record are
> updated.

## 1. The framing (40 seconds)

The brief asked for a product that helps a company with 40 to 50 vans manage maintenance, and it
left open what that product does. So my first decision was not a feature. It was a question: what is
the product's unit? A signal, a vehicle, a day, or a week?

I chose the week. For a delivery operator, fleet maintenance is not a detection problem, it is a
coordination problem. Most downtime is queueing: waiting for parts, waiting for a bay. The money is in
availability, not in repair bills. And the decision that creates or destroys availability is made
once a week: what goes into the workshop, what waits, and what that does to routes already committed.

## 2. The user (45 seconds)

The user is the part-time Fuhrparkverantwortliche at one depot of 45 vans. Fleet is a fraction of
their job. They carry personal liability under UVV, and they can pull a vehicle off the road.

I got there by mapping the seven decisions that recur in this domain, from "is this signal real" to
"did it actually get fixed", against everyone involved. The dispatcher owns one decision, and only
after someone else has ruled on safety. The garage supplies inputs and decides nothing. The managing
director signs above a threshold. The Fuhrparkverantwortliche is the only column with a decision in
every row, and the only person who sees vehicle condition, route commitment and budget at the same
time. Everyone else's pain is downstream of that decision.

So the promise became: make this week's maintenance plan, understand the trade-offs, and leave
nothing deferred without a reason and a follow-up.

## 3. The product, live (about five minutes)

[Open the app. Land on Fleet today.]

You land on the fleet: 45 vans, one already off the road, four needing a decision. Because no rental
cover has been booked, the depot is already one standard van short today. This answers the daily
question, is today fine, before you plan the week. There is no 45-row list.

[Switch to the week plan.]

The week plan has two parts. The capacity band across the top stays visible the whole time, because
it is the thing every decision moves. It counts own vans plus explicitly requested replacement cover
against demand, per day and per vehicle class. Below it, five decisions. Every one opens undecided.
The system proposes; it never decides for you.

The whole standard row starts one short. V-012 is held from Monday to Friday, demand already uses all
38 standard vans, and there is no pre-confirmed rental hiding that fact. Replacement cover is a
decision and a cost, not a fixture assumption.

[Open V-012. Click Use proposal, then Apply to draft. Point at the disabled levers.]

V-012 has a brake defect found at a UVV inspection. It was off the road before I touched anything.
Bundle and watch are disabled, and the reason is shown rather than hidden. Safety is a hard stop, not
an option, and booking Tuesday's visit does not release the hold.

[Under Replacement cover, click Request replacement. Choose Monday 28 September and five days, then
request it.]

The cover control appears only after a visit is applied. I request five days because the hold lasts
the whole week, not because the repair itself takes five days. That adds EUR 700 at EUR 140 per day,
and the band clears Monday to Friday. The product keeps the visit, the hold and the replacement as
three different facts.

[Open V-103 and V-118. Click Use proposal, then Apply to draft, on each.]

Take the other two Tuesday proposals as they come and Tuesday goes red again. Three standard vans are
off the road and only V-012 has replacement cover, so the band moves from 35 own plus one replacement
against demand of 38: two assignments are uncovered.

[Request a one-day Tuesday replacement for V-103, then for V-118.]

Each explicit request closes one unit of the gap. Tuesday reaches 35 own plus three replacements
against 38 demand, and the weekly cost moves to EUR 1,440 of service plus EUR 980 of requested cover:
EUR 2,420 against a EUR 3,000 budget. Pre-confirmed rentals never appear as spend; only cover I chose
enters the total.

[Open V-041. Use proposal, choose Thursday, then Apply to draft.]

V-041 is the one specialist van in the queue. Schedule it and the specialist row breaks while the
standard row remains covered. The replacement control states that no specialist replacement exists.
An aggregate count would have hidden the class mismatch; that is why capacity is computed per class,
never in total.

[Defer V-041: reason "No specialist cover this week", review date Monday 5 October, trigger "DTC
P0300 recurs".]

No lever closes that gap, so the honest option is to defer it. Deferral here is a record, not a gut
call. Reason, review date and trigger are all required, and the item comes back carrying them.

[Open V-027. Click Use proposal, then Apply to draft.]

V-027 is the opposite case: a wiper noise, a clean recent inspection, a service already booked in
five weeks. The evidence supports waiting, and the product does not force a visit just to clear the
queue.

[Commit.]

Commit is only possible when every item is decided and nothing blocks. The summary carries the three
visits, forward availability for the dispatcher, the three requested replacements, the absence of
specialist cover, the EUR 2,420 total and the deferred follow-ups. Nothing is sent anywhere; the
commitments are simulated and labelled as such.

[Return to Fleet today.] (cut)

V-012 is still red because a replacement does not release a safety hold. Its card now says the
replacement is on site, day one of five. Operational status and capacity cover are deliberately not
collapsed into one green state.

[Advance the clock to the review date.] (cut)

Advance the clock and V-041 returns with its rationale intact. V-012's release is recorded on Monday
of week 41, and two new standard cases both propose Thursday. With no pre-confirmed cover, adopting
both creates a shortfall of two, so the same capacity accounting has to be resolved again rather than
silently inherited from the previous week.

## 4. How I made the decisions (90 seconds)

Four principles ran through every choice.

First, decisions over information. Urgency is three states, never a score: a known deadline, an
estimate with its assumption named, or "assessment needed". No number is invented where the evidence
does not support one. Predictive failure modelling was tempting and wrong. A black box saying
"72 percent" fails the test of helping a personally liable user understand what deserves attention.

Second, honesty about feasibility. Garage slots, parts dates and requested cover are checked before
commit, because a plan that cannot be staffed is not a thin plan, it is a different and weaker claim.
There is no pre-confirmed rental safety net. Standard replacement cover must be requested against an
applied visit; specialist cover does not exist. A blocked plan is a legitimate outcome: the draft
survives and the blocker is named.

Third, the system proposes, the user decides. That principle got sharper through use. An earlier
build seeded the proposals as decisions, so two items arrived already settled. That blurred the line
the whole design rests on, so now everything opens undecided and the proposal is one click away.
Replacement cover follows the same rule: no booking and no cost exist until the user requests them.

Fourth, one user, one depot, one week, one entry point. The interruption flow, the driver app, the
garage portal, quote and approval, the managing director's view: all named, all described, none
built. Each is either downstream of the decision, another company's product, or a dashboard, which is
exactly the failure the brief warns against.

On method: research first, then a persona chosen by decision ownership, then six candidate scopes
scored against the brief's own criteria, then a written plan review that tightened the scope before
any code. The seed scenario was designed to argue both ways: one warranted intervention, one
warranted deferral, one standard-class gap that explicit cover can close and one specialist gap that
no available cover can close. A failure-heavy fixture would teach "always intervene", which is the
opposite of the claim. Ten verification scenarios are encoded in the automated suite, plus live
walkthroughs, and the acceptance record states plainly what was and was not run.

## 5. What I can do with it now, and what comes next (45 seconds)

It runs locally with no backend, no accounts and no configuration. The demo bar has a reset and a
clock, so the walkthrough is repeatable, and the in-app cover note gives an evaluator the framing
before the product. Every decision has a paper trail: research, the build contract, the specs, the
mockups with the rejected layouts, and the acceptance record.

What the interaction demonstrates: the journey holds together, requested cover changes capacity and
cost in the same place, and a specialist gap cannot be disguised with standard capacity. What it does
not yet prove on this branch: the no-pre-confirmed-rental fixture has not been brought back to a green
automated baseline. It also claims no real-world reduction in cost or breakdowns, and nobody
unfamiliar with the build has run it yet.

Next, in order: reconcile the automated expectations and acceptance record with the no-rental seed;
then the interruption as a diff on this same plan, using the scope-change event already in the
fixture; bundle versus split shown honestly, which is specified but not built; pending rather than
guaranteed bookings; and a usability session with someone who has never seen it.

## If they ask

- Why not a triage inbox? It is the closest thing to what incumbents already ship. It survives as the
  entry into the plan, not as the product.
- Why not build for the dispatcher, or tonight's grid? Better demo, weaker answer. Without a plan
  behind it you are confirming a plan nobody made, and it sits next to route optimisation, a
  well-served market.
- Why not the managing director? They are the buyer, not the user. Building for them produces a
  dashboard. The product has to generate something the user can carry upward; that is a byproduct of
  the workflow, not a report.
- Why is no rental cover pre-confirmed? Because cover is a decision with a cost, not a free fixture
  assumption. It exists only after a visit is applied and the user explicitly requests it.
- Why do all three standard visits need replacement cover? Demand already uses all 38 standard vans,
  and V-012 is held for the week. Its replacement restores the baseline; every additional standard
  van sent to the workshop creates another one-unit gap.
- Why no route reassignment as a lever? With no reserve vehicles it cannot create capacity. Offering
  it would suggest a lever that does not work, so the daily confirmation is read-only.
- Why is disruption never shown in euros? Turning uncovered assignments into money needs a
  revenue-per-route figure the scenario cannot support. Service and requested cover are both spend,
  so those two combine against a weekly budget.
- Why does booking a visit not release the held van? A hold is a question about a date, not a flag.
  It stays until a release is recorded, and every availability computation asks the same question.
- Where is this weakest? Champion and buyer are different people. A part-time role means low usage
  frequency. There is no independent usability evidence. And the safety hard stop is a chosen product
  rule, not a verified legal implementation of UVV.
- Where does MARKT-PILOT's home ground fit? At the quote stage, where parts price transparency
  matters. It is downstream of the decision, so it stays in the back pocket rather than becoming the
  centre of gravity, which is availability.
