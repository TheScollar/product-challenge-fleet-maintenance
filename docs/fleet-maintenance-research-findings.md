# Fleet Maintenance Challenge: Research & Framing Findings

Working document for the MARKT-PILOT Product Builder Challenge (Fleet Maintenance).
Status: domain research complete, scenario assumptions locked, primary persona selected, journey drafted, **scope locked** (section 8.4).
Next: design decisions for the build (section 9).

---

## 1. State of the sector

### 1.1 The money is in availability, not repair bills

| Metric | Figure |
|---|---|
| Downtime cost per vehicle per day (delivery fleets) | ~448 to 760 USD, often >1,000 all-in |
| Cost per unplanned downtime incident | 5,000 to 10,000 USD |
| Cost of planned downtime | Near zero |
| Typical uptime, regional delivery fleets | 96 to 98% |
| Breakdowns per vehicle per year, unmanaged fleets | 3 to 5, each removing the vehicle 6 to 48 hours |

A 150-van operator at 92% uptime was losing roughly 2.88M USD annually in missed deliveries.
The invisible costs (idle driver pay, rebalancing, missed commitments) routinely exceed the
visible repair invoice.

**Implication:** the entire economic case for a product here is converting unplanned downtime
into planned downtime. Not reducing downtime to zero.

### 1.2 Most downtime is queueing, not wrenching

Breakdown of downtime causes at a 150-van fleet, average 48 hours per incident:

| Cause | Share |
|---|---|
| Waiting for parts | 45% |
| Mechanic / bay availability | 20% |
| Diagnosis delay | 15% |
| Actual repair time | 15% |
| Testing and handoff | 5% |

**Implication:** ~80% of downtime happens before or around the repair. The domain is a
coordination problem, not a detection problem. The lever is entering the queue earlier and
better prepared.

### 1.3 Calendar and odometer intervals break in urban delivery

A 60-van last-mile fleet found brake pads wearing at 9,000 miles instead of the expected 25,000,
and tires at 14,000 from curb scrubbing, while still inspecting on a flat 90-day cycle.
A van doing 180 stops on a 12-mile route wears a pad in weeks; a van covering the same 12 miles
on one highway run barely touches the pedal. Unplanned brake failures cost that fleet 340 USD
per van, 20,400 USD in a year.

Generic service intervals applied without a baseline understanding of individual vehicle
condition are a documented failure mode of preventive maintenance programmes.

### 1.4 More signal, less decision

- Fleets of 30+ vehicles typically carry dozens or hundreds of unread alerts. Some critical,
  some informational, some duplicates, some sitting for weeks because nobody had time to work
  out what to do.
- Diagnosis is structural: a brake fault should not compete for attention with a routine mileage
  reminder. Alert overload is a system design problem, not a personnel problem.
- Parallel failure, the **handoff gap**: in most preventable fleet accidents the defect had
  already been flagged, because the finder and the fixer were never in the same system.
- ~95% of industry inspection reports show zero defects, a rate that signals rubber-stamping
  rather than fleet health.

### 1.5 Maintenance and operations are structurally adversarial

Dispatch sees an idle van and assigns a route. Maintenance sees the same van due for service and
books the shop. Neither is wrong; neither can see the other's plan.

Standard mitigation is **staggering**: never schedule major service for multiple vehicles at once
without spare capacity (e.g. two per week in a twenty-vehicle fleet).

**Bundling is a trade-off, not an optimisation.** Combining jobs reduces repeated downtime but
risks a long workshop stay if parts are missing or new defects surface. For critical vehicles it
can be better to complete the safety item promptly and plan the rest separately.

### 1.6 Cost discipline is weak at the invoice

Managers approve invoice stacks during busy weeks and later find duplicate repairs, incorrect
labour rates, or parts billed at retail against an agreed margin.
Worked example: an 80-vehicle fleet, three services a year, 200 USD parts per service = 48,000 USD.
A 25% margin applied instead of an agreed 15% produces 4,800 USD of annual overcharge.

### 1.7 German structural facts

| Fact | Figure | Source |
|---|---|---|
| Maintenance decision held in-house | ~62% (31% finance lease + 31% purchase) | Arval Fleet & Mobility Barometer 2026, DE, n=300 |
| Full-service leasing as primary method | 29% | same |
| Average vehicle holding period | 5.5 years (up from 4.9) | same |
| Telematics, fleets of 16+ commercial vehicles | 40% | Dataforce, Telematik in Flotten 2025 |
| Telematics on Transporter | 51% (2018) to 78% (2024) | same |
| Telematics, German fleets of 5+ vehicles | 21% | same |

**Compliance layer.** UVV inspections under **DGUV Vorschrift 70** are mandatory for commercially
used vehicles including Transporter. Responsibility sits with the employer (Halterhaftung) and is
usually delegated to a *Fuhrparkverantwortlicher*. Safety-relevant defects require immediate
removal from service. The reported difficulty is deadline compliance and documentation, not the
inspection itself. Missing documentation exposes the company to fines (up to 10,000 EUR in severe
cases), possible Regress from the Berufsgenossenschaft, and personal liability for the responsible
individual.

### 1.8 What incumbents already own

Fleetio, Samsara, Verizon Connect, RTA and others cover work orders, PM reminders, digital
inspections, telematics integration, parts, vendors and cost reporting. Fault prioritisation rules
already exist (pre-classify codes as critical or ignored). AI service advisors that rank issues by
operational risk are shipping. Many fleets run Samsara for telematics + Fleetio for maintenance depth.

**Record-keeping is commoditised.** The open ground is judgment: urgency expressed in days, the
consequence of waiting, and the decision itself.

---

## 2. Locked scenario assumptions

| # | Assumption | Rationale |
|---|---|---|
| A1 | **No reserve vehicles.** Any van off the road costs a route or triggers a rental (~120 to 220 USD/day). | Idle light-duty vehicle carries ~9,600 USD/yr in depreciation, insurance, registration, PM. Standard guidance is to replace peak-capacity spares with rentals. Framed as an economic constraint under margin pressure, *not* a claim about market norms. |
| A2 | **Maintenance decision sits in-house.** Vehicles owned or finance-leased; operator is Halter, carries running costs, chooses and pays the garage. | Arval DE 2026: 31% finance lease + 31% purchase = ~62% retain the decision. We consciously exclude the ~29% on full-service leasing, where a provider holds part of the budget and approval right; that case would move three of the seven decisions outside the product. |
| A3 | **Committed daily delivery volume.** A route not run is a substantial operational and commercial problem, not an inconvenience. | Keeps the stakes real without over-specifying the business model. |
| A4 | **Partial route interchangeability.** Most vans fungible within a class; some are not (cooling unit, tail lift, permit). Route length and stakes vary. | Full interchangeability makes the problem a counting exercise. Full rigidity makes it unsolvable. The middle ground creates the key product lever: move a watch-list van to a short, low-stakes route rather than parking it. |
| A5 | **Data is available via APIs, raw and noisy.** Fault codes without interpretation, odometer without context. | Explicitly permitted by the brief. Supported by 78% telematics on German Transporter. Keeps the alert-fatigue problem intact. |
| A6 | **No in-house workshop.** Two or three contracted external garages plus occasional OEM service partner. | Consistent with fleet size. Puts the real bottleneck (parts 45%, bay availability 20%) *outside* the company. The user cannot fix the queue, only enter it earlier and better prepared. |
| A7 | **One person holds Fuhrparkverantwortung**, part-time due to company size. Owns maintenance budget to a threshold; MD signs above it. Can pull a van from service. | Splitting the role would dilute the journey and add a handoff that teaches nothing. |
| A8 | **One depot. Mixed fleet age (~3 to 7 years), narrow model range.** | Location is not a variable. Mixed age makes failure risk genuinely uneven across the fleet, which is what makes prioritisation meaningful. Relevant mainly for mocked data. |
| A9 | **Weekly planning ritual + daily confirmation + continuous interruptions.** | Decides whether the home screen is a plan or a queue. |

---

## 3. The decision spine

Seven decisions recur across every persona and journey. Everything the product does maps to one of them.

| # | Decision | Incumbent coverage |
|---|---|---|
| 1 | Is this signal real, and does it matter? | Covered |
| 2 | How urgent is it, **in days** rather than severity labels? | **Thin** |
| 3 | Does this van roll tomorrow? | **Thin** |
| 4 | Fix now, bundle with upcoming work, or defer? | **Thin** |
| 5 | Which garage, which slot, are the parts there? | Partial |
| 6 | Is this quote fair, and who approves it? | **Thin** |
| 7 | Did it actually get fixed, and is it documented? | Covered |

---

## 4. Personas

### 4.1 PRIMARY: Fuhrparkverantwortliche

Part-time role. An operations lead who also does other things. Carries delegated responsibility
for vehicle condition and UVV compliance. Owns the maintenance budget to a threshold. Can pull a
van from service.

**JTBD:** When I plan the coming week, I want to know which vehicles need attention and when I can
afford to take them off the road, so that every committed route runs and nothing fails on me
unplanned.

**Problems**
- Cannot tell which of dozens of open signals actually threatens next week.
- No defensible basis for deciding what can wait.
- Discovers garage and parts constraints only *after* committing.
- Rebuilds the same mental picture from scratch every time.
- Carries personal liability for a condition they cannot continuously observe.

**Success:** routes covered, no unplanned failures, spend within budget, documentation intact.

### 4.2 Dispatcher

- **JTBD:** Assign every route tomorrow to a vehicle and driver that will complete it.
- **Problems:** learns about unavailability too late; cannot see which vans carry elevated risk;
  treats vehicles as interchangeable when they are not.
- **Role in journey:** consumes the availability commitment, raises conflicts, confirms daily.

### 4.3 Driver

- **JTBD:** Get through the shift without the vehicle failing, and report problems without creating
  trouble for myself.
- **Problems:** reported defects appear to vanish; reporting can cost them the van and the day; no
  acknowledgement loop, hence the clean-report problem.
- **Role in journey:** originates signals, receives decisions, executes drop-off and collection.

### 4.4 External garage

- **JTBD:** Fill bays profitably, get authorisation fast enough to start.
- **Problems:** waits on approvals, chases by phone, stalls when additional defects surface mid-job,
  has no advance view of what is coming.
- **Role in journey:** owns slot availability and parts lead time, returns quotes and scope changes,
  confirms completion.

### 4.5 Managing director / owner — ECONOMIC BUYER

- **JTBD:** Predictable cost, no liability exposure, no service failures.
- **Problems:** approves above-threshold spend with limited context; discovers cost trends late.
- **Role in journey:** approval gate above threshold, periodic review.
- **Commercial role:** signs for the software. Never opens it. Judges it on routes covered, cost per
  vehicle and liability exposure — not on the primary user's experience. The product needs an
  MD-legible output, and that output should fall out of the approval workflow rather than being a
  bolted-on report. See 5.3 argument 7.

### 4.6 Parts supplier

Not a user. Appears as a lead time. That lead time governs 45% of downtime.

---

## 5. Why the Fuhrparkverantwortliche is the primary user

### 5.0 The claim in one line

This is the only person who can answer the question the brief actually asks — *what should happen
next?* — because they are the only one who sees vehicle condition, route commitment and budget at the
same time, and the only one with the authority to act on all three. Every other persona either feeds
that decision or executes it.

### 5.1 Decision ownership, mapped

The seven decisions from section 3, against who can actually make each one:

| Decision | Driver | Dispatcher | Garage | MD | **Fuhrparkverantwortliche** |
|---|---|---|---|---|---|
| 1. Is this signal real and does it matter? | originates | — | advises | — | **decides** |
| 2. How urgent, in days? | — | — | advises | — | **decides** |
| 3. Does this van roll tomorrow? | — | executes | — | — | **decides** |
| 4. Now, bundle, or defer? | — | — | — | — | **decides** |
| 5. Which garage, which slot? | — | — | offers | — | **decides** |
| 6. Is the quote fair, who approves? | — | — | quotes | signs above threshold | **decides scope** |
| 7. Fixed and documented? | confirms | — | confirms | — | **owns the record** |

Read down the columns and the case makes itself. The dispatcher owns one decision, and only *after*
someone else has ruled on safety. The garage supplies inputs to three but decides none. The MD holds
a signature on one. The Fuhrparkverantwortliche is the only column with a decision in every row.

### 5.2 Problem-side arguments

1. **Only actor who holds the decision.** Driver holds none (originates signal). Garage holds
   execution, not choice. Dispatcher holds exactly one (#3), and only after someone else decided
   whether it is safe. MD holds part of one (#6, above threshold). The Fuhrparkverantwortliche holds
   all seven. A product built for another persona has to route the actual decision back to this
   person: a feeder, not a product.
2. **Sits where three constraints collide, and nobody else sees all three.** Condition (technical),
   route commitment (operational), budget (financial). Dispatcher sees capacity not condition.
   Garage sees condition not commitment. MD sees cost but neither. The brief's core question, what
   can be postponed, is only computable where all three are visible.
3. **Everyone else's pain is downstream.** Dispatcher's late surprise, driver's vanished report,
   garage's stalled authorisation are all symptoms of a decision not made or not communicated.
   Fixing the decision relieves three personas without building three products. This is what makes
   the result feel like one coherent product.
4. **Asymmetric personal risk.** Halterhaftung and DGUV Vorschrift 70: fines up to 10,000 EUR,
   Regress from the Berufsgenossenschaft, personal liability. Safety-relevant defects require
   immediate withdrawal. No other persona has stakes like this. Most motivated user; most willing
   to change behaviour.
5. **Their failure mode is the expensive one.** Driver failure = a missed defect. Dispatcher failure
   = a suboptimal assignment. This person's failure = the 5,000 to 10,000 USD unplanned incident or
   a compliance exposure.
6. **The role has outgrown the person.** Expectations now include predicting failures, managing cost
   per mile as a financial KPI, and producing auditable compliance documentation. Average fleet
   maintenance manager touches 7 to 12 software systems per week (up from 2 to 3 in 2019); 74% say
   data management is now as important as technical knowledge. At 40 to 50 vans there is no team,
   and the role is part-time. That gap is where the product lives.

### 5.3 Commercial arguments

7. **The champion-to-buyer path is one hop.** The Fuhrparkverantwortliche is the champion, evaluator
   and user. The **MD or owner is the economic buyer** — at this company size a new recurring
   subscription is an owner decision regardless of line-item size, and a part-time fleet role rarely
   carries a discretionary software budget. What remains true is that there is no committee, no IT
   security review, no vendor management function and no fleet-director layer in between. The person
   who feels the pain talks directly to the person who signs, often daily. Short, but it *is* a
   handoff. Do not claim otherwise.
   - **Product consequence:** the product must generate something the champion can carry upward.
     User's language = "I stop getting surprised." MD's language = routes covered, cost per vehicle,
     liability exposure. If the product only speaks the first, the champion loves it and the deal
     dies at signature — the classic failure mode of champion-led sales with a non-user buyer.
   - **Structural advantage:** under A7 the MD already signs off on repairs above a threshold, so an
     MD-facing surface is needed for *operational* reasons anyway. That same surface is the
     commercial artifact. The evidence trail accumulated by normal use (deferrals and their
     outcomes, incidents avoided, spend against plan) is what justifies renewal. Stronger than a
     reporting feature, because it is a byproduct of the workflow rather than assembled for a sales
     conversation.
8. **ROI is easy to state, but must be stated in the MD's terms.** One prevented incident = 5,000 to
   10,000 USD. Fleet software at this tier prices around 4 EUR per vehicle per month, ~2,400 EUR/yr
   for 50 vans. One avoided breakdown pays for several years. The case has to be visible to someone
   who never opens the product. A driver-facing tool has no budget line and no attributable saving at
   all.
9. **Value lands in metrics they already report:** uptime, routes covered, cost per vehicle. No
   market education required, and these are the buyer's metrics as much as the user's.
10. **Least contested ground.** Building for the dispatcher = route optimisation (different,
    well-served market). Building for the driver = digital inspections (commoditised by Whip Around,
    Fleetio Go, every telematics vendor). The decision layer is where incumbents are thinnest.
11. **Natural expansion path.** Decision first, then driver interface (signal quality), then garage
    interface (lead times, quotes). Each step justified by the primary user's need. Bottom-up from
    the driver requires convincing this person anyway, later and with less leverage.
12. **Segment is real and structurally underserved.** German fleets of 16+ commercial vehicles at 40%
    telematics, Transporter at 78%, so the data exists. But this size sits below the enterprise
    platforms' natural customer and above the spreadsheet. Reviews from 50-vehicle fleets describe
    exactly that limbo: software for work orders and fuel, preventive maintenance kept in a separate
    Excel sheet.

### 5.4 Why not the others (the counterfactual)

The choice is only defensible if the alternatives were genuinely considered. Each was, and each fails
for a different reason.

**Dispatcher.** Tempting, because the daily rhythm is crisp and the moment of use is obvious. Fails
because they hold one decision out of seven, and that decision is downstream of a safety judgment
they are not qualified or authorised to make. Building here produces a dispatch tool that has to ask
someone else whether the van is safe, which means the interesting product is still unbuilt. It also
drops us into route optimisation, a different and well-served market.

**Driver.** Tempting, because signal quality is a real, evidenced problem — ~95% of inspection reports
show zero defects, which is rubber-stamping, not health. Fails on two counts. Commercially, there is
no budget line and no attributable saving; a driver app is a feature of something else. Structurally,
better signal into an unchanged decision process changes nothing — the handoff gap exists because
nobody acts on what is reported, not because too little is reported. Fix the decision first, then
improving the input becomes worth doing. Also the most commoditised space in the domain (Whip Around,
Fleetio Go, every telematics vendor).

**External garage.** Owns the largest slice of the problem — 45% parts waiting plus 20% bay
availability — but is a different company with different incentives, and is not our customer. We
cannot sell them a tool that makes our user's life better. They belong in the journey as an
interface, not as a user.

**Managing director.** The buyer, not the user. Their engagement is periodic and their problems
(cost trends, liability) are lagging indicators of decisions made further down. Building for them
produces a dashboard, which is the exact failure the brief warns against: presenting information
rather than supporting decisions.

**A two-person split (ops lead + separate Fuhrparkverantwortlicher).** More realistic in some German
companies, where Halterhaftung is delegated to one person while operations sits with another. Rejected
deliberately under A7: it adds a handoff that teaches us nothing about the product and dilutes the
journey. Worth naming in the interview as a considered alternative rather than an oversight.

### 5.5 Where the choice is weak (concede these honestly)

- **Champion and buyer are different people.** Adoption and renewal depend on the champion being able
  to demonstrate value upward to the MD. Real commercial risk. Mitigated by making the MD-facing
  output a byproduct of the operational approval workflow rather than a separate reporting feature.
- **Part-time role means low usage frequency**, a retention risk. Mitigated by the daily confirmation
  alongside the weekly ritual.
- **Single-user product has no internal virality.** Growth is a segment play across many small fleets,
  not expansion inside one account.
- **Small contract value at 40 to 50 vans.** The commercial case rests on volume and low touch, not
  on landing big logos.

---

## 6. The journey

Spine: weekly planning ritual with daily confirmation. Interruptions are *entry points into the same
spine*, not a separate product.

### Stage 0 — Between sessions (standing state)

**Trigger:** none, time passes.
**Acting:** driver reports defects; telematics emits codes; dispatcher commits routes.
**Breaks today:** nothing holds state. Signals pile into an untriaged inbox. Deferral decisions made
two weeks ago leave no trace, so the same item is re-evaluated from zero each time it resurfaces.
**Product obligation:** hold state between sessions. Every signal already carries a provisional
urgency and proposed treatment before the user opens the product. The user should never arrive to an
undifferentiated queue.

### Stage 1 — The weekly plan (~20 to 30 min)

| Step | What happens | Decisions |
|---|---|---|
| 1.1 What needs attention | Everything open across the fleet, ordered by **when it becomes a problem**, not by severity label or arrival time. Urgency in days and kilometres, not red/amber/green. | 1, 2 |
| 1.2 What it costs to wait | Consequence of deferral per item: what happens if this waits two weeks, what it turns into, risk of in-service failure meanwhile. **The thinnest ground in the incumbent landscape.** | 4 |
| 1.3 What the week can absorb | Route demand vs. fleet capacity, day by day. With no reserve vehicles, every booking directly subtracts from committed capacity. Shows how many vans can be off the road each day before a route fails; flags over-stacking. Staggering made explicit. | — |
| 1.4 Bundle or split | For vans with multiple open items, propose a bundle and show the trade-off honestly: one longer visit vs. two shorter ones, with parts/new-defect risk. Must not silently stack everything. | 4 |
| 1.5 Slot and parts | Garage availability and parts lead time enter the plan **before** commitment. A plan built without these is fiction (45% + 20% of downtime). | 5 |
| 1.6 Commit | Plan fixed. Bookings to garages, expected downtime to dispatcher, drop-offs to drivers. Deferred items get an explicit revisit date and trigger condition. | — |

**Other personas:** garage confirms/rejects slots and states parts lead time. Dispatcher receives
*forward* availability, not current status. Driver receives drop-off assignment. MD approves above
threshold.
**Breaks today:** deferral is a gut call with no recorded consequence and no revisit date. Capacity,
garage availability and parts are discovered after committing, not before.

### Stage 2 — The daily confirmation (<2 min)

**Trigger:** end of day, before tomorrow's routes lock.
Confirm which vans roll tomorrow. Anything changed since the plan surfaces here. Where a van carries
a watch-list item, **partial interchangeability becomes the lever**: propose moving it to a shorter
or lower-stakes route rather than parking it.
**Decision:** 3.
**Other personas:** dispatcher confirms or challenges the grid; driver receives assignment; garage
reports readiness.
**Breaks today:** dispatch and maintenance discover the conflict at the bay door. Availability is a
current status rather than a forward commitment.

### Stage 3 — The interruption (any time)

**Trigger:** driver reports a defect, a code fires, or a garage calls mid-job with additional findings.
Enters the same spine and asks one question: **does this change the plan?** Three recorded outcomes:

1. **Act now** — van comes off the road; immediately show capacity consequence and reassignment options.
2. **Add to next planned visit** — item joins an existing booking.
3. **Watch** — with a defined trigger and revisit date.

**Decisions:** 1, 2, 4, sometimes 3.
**Hard stop:** safety-relevant defects are not a judgment call. Under UVV they require immediate
removal from service. The product treats that class as a hard stop, not an option.
**Other personas:** driver originates *and receives the outcome* — this closes the loop that produces
the clean-report problem. Garage originates scope changes. Dispatcher absorbs the capacity hit.
**Breaks today:** the handoff gap. Finder and fixer are not in the same system, and the reporter never
learns what happened.

### Stage 4 — The quote

**Trigger:** garage returns an estimate, often with additional found defects.
User judges scope and price, declines or defers line items, approves. Because of A2 (owned /
finance-leased), this stays in-house rather than routing to a leasing provider. Above threshold, MD signs.
**Decision:** 6.
**Breaks today:** invoices approved in batches; duplicate repairs, wrong labour rates and inflated
parts margins surface afterwards.
**Note:** MARKT-PILOT adjacency (parts price transparency is their home ground). Worth having in the
back pocket for the interview, but should not become the product's centre of gravity, which is
availability.

### Stage 5 — Closure

**Trigger:** van returns.
Completion recorded against the vehicle, compliance documentation captured, driver sees their report
resolved, deferral decisions settled or carried forward with a new date.
**Decision:** 7.
**Breaks today:** compliance documentation is the hard part, not the inspection, and it falls apart
across Excel and calendar entries at mixed-fleet scale.

---

## 7. Design implications

- **The dispatcher, driver, garage and MD each get an interface, not a product.** A commitment, an
  assignment, a booking, an approval request. Keeps the build focused on one user while the journey
  stays coherent across the organisation.
- **The two stages that earn their keep are 1.2 and 1.3**: the consequence of waiting, and capacity
  as a hard ceiling. Everything else is table stakes that must exist for those two to be usable.
- **Urgency must be expressed in days, not severity colours.** This is the single clearest
  differentiator against the incumbent alert-inbox pattern.
- **Deferral must be a first-class, recorded object** with a revisit date and trigger condition. This
  is also the stickiness mechanism: data can be exported, judgment history cannot be reconstructed.

---

## 8. Solution space and scope decision

### 8.1 The axis of choice

"Weekly plan vs. daily confirmation" is a calendar framing and the wrong one. The sharper question is
**what is the product's unit?** Everything else follows.

| Unit | The product is about | Primary decision |
|---|---|---|
| The signal | An incoming item and what to do with it | 1, 2 |
| The vehicle | One van and its accumulated state | 4 |
| The week | A plan against a capacity ceiling | 2, 4, 5 |
| The day | Tomorrow's grid | 3 |
| The deferral | What is waiting, until when, and why | 4 |

### 8.2 Candidate scopes evaluated

| | Framing | Attention | Decisions not info | Differentiation | Demoable | Build cost | Coherence risk |
|---|---|---|---|---|---|---|---|
| S1 Triage inbox | Med | **High** | Med | **Low** | High | Low | Low |
| **S2 Weekly plan** | **High** | High | **High** | **High** | Med | High | Med |
| S3 Tonight's grid | High | High | **High** | Med | **High** | Med | Med |
| S4 Deferral ledger | **High** | Med | **High** | **Highest** | Low | Low | **High** |
| S5 Capacity first | Med | Med | Med | Med | High | Med | High |
| S6 The full loop | High | High | High | High | Med | **Highest** | Low if complete |

**S1 Triage inbox** (signal; stages 0+3). Rejected as *the* product: closest to what incumbents already
ship. Fault prioritisation rules and AI service advisors that rank by operational risk are shipping.
Competing on execution quality in a contested space, where the brief rewards framing over polish.
Retained as the **entry** to S2, since signals must become items before they can be planned.

**S2 Weekly plan** (week; stages 0+1). **Selected.** Proves the two things incumbents are thinnest on:
consequence of deferral and capacity as a hard ceiling. Directly answers the brief's own language about
postponable maintenance.

**S3 Tonight's grid** (day; stages 2+3). Rejected as the spine. Better demo, weaker answer, and sits
next to route optimisation, an adjacent well-served market. Without a plan behind it you are confirming
a plan nobody made. **Retained as a stub**, the output of the plan.

**S4 Deferral ledger** (deferral; decision 4). Cannot stand alone — plausibly a feature, not a product.
But it is the most differentiated idea in the space and it is cheap. **Folded into S2.** Also the
stickiness mechanism: data exports, judgment history does not.

**S5 Capacity first** (ceiling). Not a product — handles capacity well and condition badly. Tells you
how much downtime you can afford, not which van deserves it. **Folded into S2 as a visible constraint**
on a week timeline, where it is far more legible than as a counter.

**S6 The full loop.** Too much. Shallow everywhere is worse than deep somewhere, and thin coverage
would undermine the very coherence criterion it was chosen to satisfy.

### 8.3 Structural observations

- **S2 and S3 are not alternatives**, they are two ends of one mechanism. The plan produces a
  commitment; the daily confirmation tests it against reality. The real question is which to build
  deep and which to stub.
- **S1 is unavoidable** in every option. The only question is how much of the product it is.
- **S4 and S5 are cross-cutting**, not standalone. Both improve whichever host they join.

### 8.4 LOCKED SCOPE

**Spine:** S2, the weekly plan. **Two entry points, one room:**

- **Entry A — scheduled ritual (calendar).** The normal state. Proves the Stage 0 obligation that the
  user never arrives at an undifferentiated queue, which is only testable on a cold open.
- **Entry B — interruption (event).** A defect or code arrives and asks: does this change the plan?
  Demonstrates the return path, the structural idea holding the product together.

**Demo order: calendar first, then interruption.** An interruption is only meaningful once the audience
has seen the plan it disrupts. Entering cold at an interruption forces retroactive explanation.

**In scope**

- Standing state: signals arrive pre-processed; state persists between sessions
- Weekly plan at full depth: what needs attention → what it costs to wait → what the week can absorb →
  bundle or split → slot and parts → commit
- Deferral as a first-class object: treatment, revisit date, trigger condition, modelled consequence
- Capacity as a visible constraint on a week timeline
- Daily confirmation stubbed as the output
- Dispatcher and garage as data interfaces only, no surfaces of their own

**Deliberately out (with the reason, because the brief scores omissions)**

| Cut | Reason |
|---|---|
| Quote and approval (Stage 4) | Downstream of the problem. No procurement function at this size; the budget holder *is* the user; accounting is a consumer, not a participant. Future work. |
| MD-facing UI | Commercially relevant, operationally absent from the primary journey. The MD never opens the product. |
| Closure and compliance documentation (Stage 5) | Genuinely required in production (UVV makes it non-optional), but it is record-keeping — the commoditised layer. Named as production-required. |
| Driver app | The driver is a signal source and an outcome recipient, not a surface. Doubles the build for a persona whose problem is downstream of the decision. |
| Garage portal | Garage appears as slot availability and parts lead time. Their side is a different company's product. |
| Predictive failure modelling / ML | Tempting and wrong. A black box saying "72% failure probability" fails the criterion about helping the user understand what deserves attention. Transparent, interrogable heuristics beat an opaque score — especially for someone carrying personal liability. |
| Route optimisation, cost analytics, multi-depot, onboarding, admin | Out of frame. |

---

## 9. Open design questions for the build

- Does the plan look the same from both entries, or is the interruption a focused diff on top of it?
- How is urgency computed and expressed? Days and kilometres, not severity colours — but on what basis?
- How far to model the consequence of waiting before it stops being believable? Heuristic vs. explicit
  risk model.
- How is capacity represented on the week timeline so the ceiling is felt rather than read?
- Does the daily confirmation stub need to be interactive, or is a static output enough to close the loop?

---

## 10. Source notes

Research drawn from: fleet management practitioner literature (Fleetio, Geotab, Whip Around, AUTOsist,
RTA, OxMaint, FleetRabbit, BusCMMS), delivery fleet downtime economics, German fleet and compliance
sources (Arval Mobility Observatory Fleet & Mobility Barometer 2026 DE n=300; Dataforce Telematik in
Flotten 2025; DGUV Vorschrift 70 / UVV guidance from Avrios, Carano, Fuhriva, Leasingengel), FMCSA and
DVIR regulatory material, and MARKT-PILOT company sources.

Caveats worth carrying into the interview:
- **No research found** confirming that 40 to 50 van delivery fleets typically carry zero spares. The
  assumption is defensible as a high-pressure scenario, supported by idle-capital economics, but is
  *not* the documented norm. Recommended utilisation for last-mile is 75 to 85%, with >90% flagged as
  capacity risk.
- **No clean LCV-specific leasing penetration rate for Germany was found.** The 62% in-house figure
  comes from all-fleet data skewed toward company cars.
- Dataforce's "40% of fleets with 16+ commercial vehicles" and "78% of Transporter" sit on different
  bases and should not be presented as directly comparable.
- US-dollar downtime figures come from US sources; treat as order-of-magnitude for a German context.
