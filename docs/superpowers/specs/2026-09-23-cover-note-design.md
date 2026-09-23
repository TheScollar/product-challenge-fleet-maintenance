# Cover Note: Design Spec

A framing screen shown before the plan surface, carrying the product reasoning for a reader who
arrives without a narrator.

**Status.** Approved in brainstorming on 2026-09-23. Scope beyond the build contract in
`docs/fleet-maintenance-work-packages.md`, accepted deliberately. Where this document and the work
packages disagree, the divergence is stated at the point it occurs.

**Reference convention.** A bare `§n` points into `fleet-maintenance-work-packages.md`. `[S §n]` points
into `2026-09-23-fleet-maintenance-prototype-design.md`.

---

## 1. Why this exists

The prototype is evaluated in two modes, and it has to hold up in both: a walkthrough the author
narrates, and a solo run where the panel opens it and clicks around alone.

In the narrated mode the product reasoning lives in the author's voice. In the solo mode that voice is
absent, and the reasoning has nowhere to live. Two specific consequences were identified as the risks
worth spending on:

1. **The product thinking only exists in the narration.** Three urgency states rather than a score,
   three cost figures kept deliberately apart, deferral as a record rather than a gut call. All
   designed choices. None self-evident from the screen.
2. **The first ten seconds do not orient a stranger.** G1 (§2) asks that attention be understandable
   within a minute. On landing there is a header, a capacity band and five queue items, with no
   statement of what the week is asking of the user.

The cover note addresses both by putting the framing in front of the journey rather than inside it.

## 2. What it is, and what it is not

**It is a cover note addressed to the evaluation panel.** Not to the Fuhrparkverantwortliche. The
persona never reads a page explaining why deferral is a record, and would not need to.

**It is not onboarding, not a guided tour, and not step one of the user's workflow.**

This distinction is the whole design, and it decides the voice: first person, past tense, about choices
made. "I chose the part-time Fuhrparkverantwortliche at one depot", not "Welcome, let's plan your
week." Styled as product onboarding it would imply the product needs explaining to its own user, which
is the opposite of what it claims.

**Relationship to §1's one-surface decision.** §1 settled the E2-versus-E7 question by choosing one
surface with one entry point. That decision describes the *product journey*, and it is unaffected: the
journey still begins and ends on the plan screen. The cover note sits outside the journey, which is why
it is not a second surface in the sense §1 was ruling out. The spec states this so the choice reads as
deliberate rather than as drift.

**Rejected alternatives.** Two were considered and not taken:

- *In-context rationale markers on the plan surface*, toggleable, anchored beside the urgency chip, the
  per-class capacity rows and the disabled Commit button. Puts each explanation exactly where the thing
  it explains is. Rejected to keep the product surface uncluttered and to avoid a prototype that needs
  annotation to be legible. The cost is accepted: explanation now sits further from what it explains.
- *A guided contents page* routing into three named seeded moments with state preloaded. Strongest for
  a solo clicker and it would incidentally solve live-demo recovery. Rejected as deep-linking scope on
  top of an unbuilt UI, and because it risks turning the prototype into a tour of itself.

## 3. Content

Roughly 520 words across eight blocks, with the first 200 carrying the essentials. Draft copy below is
the specification, not a suggestion: implementation renders it, it does not rewrite it.

### 3.1 Ordering, and the one choice worth defending

**"What you are about to see" is placed fourth, before the reasoning sections.** The reader's next
action is clicking through, so the bridge to the screen belongs where they are most likely to click.
The deeper reasoning serves whoever scrolls, and is not what a skimmer most needs. Everything above it
is what a reader who gets through only the first screenful should still have.

### 3.2 Lead

Title: **Fleet maintenance: the weekly plan**

Promise, set apart from the body:

> Make this week's maintenance plan, understand the trade-offs, and leave nothing deferred without a
> reason and a follow-up.

### 3.3 The challenge as given

> A company runs around 45 delivery vans from one depot. It wants them available and reliable, without
> paying for maintenance it does not need and without losing vehicles to breakdowns it could have
> anticipated.
>
> What the product should actually do was left open. Monitoring condition, spotting problems,
> prioritising work, planning it, coordinating with garages, understanding cost, keeping history. This
> is the part I chose, and the reasons are below.

### 3.4 The user and problem I chose

> **The user.** The part-time Fuhrparkverantwortliche at one depot of 45 vans. Fleet is a fraction of
> their job. They carry personal liability under UVV, and they have the authority to pull a vehicle off
> the road.
>
> **The problem.** Decide what to service this week and what can reasonably wait, while seeing what
> that decision does to work already committed.
>
> Not every maintenance problem. One weekly decision, made under a capacity ceiling, by someone who is
> accountable for it and does not have all day.

### 3.5 What you are about to see

> One planning week. A capacity band across the top that stays visible while you work, because it is
> the thing every decision moves. Below it, five decisions waiting on you.
>
> Two things block the week. Tuesday is one van short, because three standard vans are off the road at
> once and the rental cover only stretches to two of them: moving one visit clears it. And `V-041`, the
> only specialist van in the queue, still needs a decision. No specialist cover exists this week, so
> scheduling it leaves an assignment uncovered that nothing available can fill.
>
> `V-012` is already out of service before you commit anything, on a brake defect found at inspection.
> It stays out until a release is recorded, and the week plans around it.
>
> The plan cannot be committed until the blockers are cleared. That is deliberate.

**Implementation note.** This block was verified against the built surface on 2026-09-23 and corrected
per the rule below: the original draft named `V-012` and `V-041` as the two blockers, but on the built
screen `V-012` is covered and booked, so it does not block commit. The two blockers are the Tuesday
shortfall and `V-041`'s undecided item. The rule stands for future edits: verify against the built
surface, and correct the copy rather than the screen.

### 3.6 The decisions worth knowing about

Rendered as term-and-detail pairs.

| Term | Detail |
| --- | --- |
| Capacity is counted per class, never in aggregate | An aggregate count reads one van short and forgivable while the only compatible specialist van is off the road with nothing able to cover it. `V-041` exists to make that visible. |
| Urgency is three states, never a score | A known deadline, an estimate with its assumption named, or an unknown condition that reads `assessment needed`. No number is invented where the evidence supports none. |
| The three cost figures stay apart | Service cost, replacement cover and operational disruption are never blended. Disruption stays a count of uncovered assignments, because turning it into euros needs a revenue-per-route figure this scenario cannot support. |
| Deferral is a record, not a gut call | Reason, review date and trigger are all required, and the item returns carrying them. Waiting is a legitimate decision; waiting without a follow-up is not. |
| A blocked plan is a legitimate outcome | When no lever closes a gap, the draft survives and the blocker is named. The product never claims a readiness it does not have. |

### 3.7 What I deliberately did not build, and why

Rendered as term-and-detail pairs.

| Term | Detail |
| --- | --- |
| Quote and approval | No procurement function at this size. Every decision here sits inside delegated authority. Above-threshold spend exists and is left out of frame rather than replaced by an invented approval workflow. |
| A surface for the managing director | The MD never opens this product. In production an approval surface is operationally necessary; omitting it is a scope decision, not a claim that it is unnecessary. |
| A driver app and a garage portal | The driver is a signal source and an outcome recipient, not a surface. The garage portal is a different company's product. |
| Predictive failure modelling | A black box fails the test of helping someone understand what deserves attention, especially someone carrying personal liability. The structured recommendation is the alternative. |
| Real bookings, messages and integrations | Commit is simulated and guaranteed by the scenario. Real-world rejection and pending confirmation are future work. |
| Route optimisation, cost analytics, multi-depot | Out of frame for one weekly decision at one depot. |

### 3.8 What is simulated

> Everything outside the depot. Vehicle data, telematics, inspection findings, garage slots, parts lead
> times, rental cover and prices are all fixtures, and they are labelled in the product.
>
> Commit is a simulated commitment. The scenario guarantees the selected slots and confirms them.
> **Nothing is sent anywhere, and no external booking exists.** Every price is a scenario price.

### 3.9 Where the thinking lives

Rendered as monospace paths with a one-line description each. **Paths, not hyperlinks.** A relative
link resolves differently under `npm run dev`, under a served `dist/`, and under a `dist/index.html`
opened from the filesystem, so hyperlinking introduces a broken-link failure mode for no benefit. The
reader has the repository.

| Path | Description |
| --- | --- |
| `docs/fleet-maintenance-work-packages.md` | The build contract, scope, goals and what was cut |
| `docs/fleet-maintenance-research-findings.md` | Research and framing, and where the user came from |
| `docs/superpowers/specs/2026-09-23-fleet-maintenance-prototype-design.md` | The technical design |
| `docs/mockups/` | The two layouts the layout decision was made from |

### 3.10 Excluded from the cover note

**Known limitations** and **What I would build next** stay in `README.md` and `docs/acceptance.md`.
They are retrospective material for a reader assessing the finished work; the cover note is forward
framing for a reader about to use it. `What is simulated` is the exception that crosses over, because a
reader needs it to interpret what is on the screen.

## 4. Behaviour

| Trigger | Result |
| --- | --- |
| First load, flag absent | Cover note is shown |
| **Open this week's plan** | Flag is set, plan surface is shown |
| Any later load, flag set | Plan surface directly, no cover note |
| **About this prototype** in the demo bar | Cover note is shown again, without clearing the flag |
| **Open this week's plan**, reached via About | Identical behaviour. Returns to the plan, flag already set |
| Demo bar **Reset** | Plan state only. The cover note does not return |

The About control sits in the button group at the right of the demo bar, **after Reset**, so Reset does
not move for anyone who has already learned where it is during a walkthrough.

**Reset deliberately does not restore the cover note.** §4 defines Reset over plan state. Mid-demo the
author needs to reset the plan without being thrown onto a text page, so conflating the two makes the
live walkthrough worse. The About control is the way back, and it is always present.

**A full screen, not a modal.** An overlay implies the product is behind it waiting, which invites
dismissal without reading, and it costs focus-trap and scroll-lock work for nothing gained.

**Layout.** Single scrollable column at a readable measure. A **sticky bar at the bottom of the
viewport** keeps **Open this week's plan** reachable at any scroll position, so length never traps
anyone. Bottom rather than top: reading runs downward, the action is the terminus of that reading, and
a top bar would compete with the title block for the same space. No progress dots, no steps, no
pagination. One page.

**Basic quality.** One `h1`, then one `h2` per block, in document order. The sticky action button
receives focus on mount, including when the cover note is reopened from About. No new colours;
`theme.css` tokens only.

## 5. Architecture

### 5.1 Modules

| File | Responsibility |
| --- | --- |
| `src/ui/coverNoteContent.ts` | The copy of §3 as structured data. Canonical for the app. |
| `src/ui/CoverNote.tsx` | Renders that data. Presentation only, no content literals. |
| `src/state/coverNoteSeen.ts` | Reads and writes the flag. The only module touching its storage key. |
| `src/domain/coverNoteSeen.test.ts` | Its tests. Placed in `src/domain/` because that is where the existing state-layer tests live (`persistence.test.ts`, `planReducer.test.ts`), despite the modules under test sitting in `src/state/`. Matching the convention beats introducing a second one. |
| `src/App.tsx` | Chooses between `CoverNote` and the plan shell. |
| `src/ui/DemoBar.tsx` | Gains the About control. |
| `src/ui/theme.css` | Gains a `.covernote` block. |

Content is separated from rendering so the prose is reviewable in one place and editable without
touching layout, and so `CoverNote.tsx` stays a renderer over a closed set of block kinds:

```ts
export type CoverBlock =
  | { kind: 'prose'; id: string; heading: string; paragraphs: string[] }
  | { kind: 'pairs'; id: string; heading: string; pairs: { term: string; detail: string }[] }
  | { kind: 'paths'; id: string; heading: string; note: string;
      paths: { path: string; description: string }[] }

export type CoverNoteContent = {
  title: string
  promise: string
  blocks: CoverBlock[]
}
```

`CoverNote.tsx` exhaustively switches on `kind`, so a new block kind is a type error rather than a
silently dropped section.

### 5.2 Persistence

**A separate localStorage key: `fleet-maintenance-prototype/cover-note/v1`.** Value is the literal
string `seen`. Two reasons, both load-bearing:

1. The flag is UI chrome, not plan state. It has no place in a structure the reducer owns.
2. It must survive Reset, which by §4 clears plan state. Folding it into plan state would either break
   that or require an exception in the structural validator hardened over four review rounds in Task 9.

**Any value other than `seen`, and any read failure, means show the cover note.** Showing it once too
often is harmless; suppressing it wrongly is not.

### 5.3 Error handling

`localStorage` throws in private browsing, on quota exhaustion, and when storage is disabled by policy.
Both access paths are wrapped:

- **Read failure:** treated as flag absent. The cover note is shown. Safe default.
- **Write failure:** swallowed. The user proceeds to the plan. The only consequence is that the cover
  note reappears on the next load, which costs one click.

Neither path may propagate. This module runs on first render, and an unhandled throw there takes down
the application before anything is drawn.

### 5.4 Routing

A boolean in `App.tsx`, not a router. Two states, no URLs, no history entries, no dependency added.

## 6. Build placement

**A new task, after Task 14.** The current Tasks 15 and 16 renumber to 16 and 17.

It depends on Task 10 for the demo bar and `theme.css`, so it could be folded into Task 10 instead.
It should not be. §3.5 describes the plan screen, and writing it before that screen exists means
writing it twice and verifying it against a spec rather than against the thing.

Task 17 (formerly 16) gains one line in `README.md` pointing at the cover note as the in-app framing.

**Testing.** `[S §1]` reads "Vitest over the domain layer only" and "no component tests at this
timebox". In practice the state layer is tested too: `src/state/persistence.ts` and
`src/state/planReducer.ts` both have suites. `coverNoteSeen.ts` follows that established practice
rather than the literal wording, and gets coverage of the absent flag, the set flag, an unrecognised
stored value, and **both throw paths**. `CoverNote.tsx` stays manually verified, which is the part of
`[S §1]` that is unambiguous.

**Manual checks at the end of the task:**

1. Fresh profile, `npm run dev`: cover note appears.
2. Click through, reload: plan appears directly.
3. Demo bar About: cover note returns; click through again, still no flag churn.
4. Demo bar Reset: plan state clears, cover note does not reappear.
5. `npm run build`, open `dist/index.html`: same behaviour, paths render as text.
6. Storage disabled in the browser: cover note appears, clicking through still reaches the plan.
7. `npm test`: domain and state suites unchanged.

**Cost, stated honestly.** §3 protects the M3 validation block from optional scope, and this is
optional scope. It was priced as a feature in its own right and accepted on that basis. If time runs
short, §8's ordering still applies: this is cut before anything in the mandatory loop is thinned.

## 7. Not built

| Not building | Reason |
| --- | --- |
| In-context rationale markers on the plan surface | Rejected in §2. Keeps the product surface uncluttered. |
| Deep links into seeded demo moments | Rejected in §2. Real scope on top of an unbuilt UI. |
| Generated or parsed content from `README.md` | Separate sources were chosen. Duplication is accepted over a markdown rendering dependency. |
| A dismiss-forever preference, or a "do not show again" checkbox | The single flag already does this. A checkbox implies a settings model the prototype does not have. |
| Animation or transition between cover note and plan | No argument it carries. |
