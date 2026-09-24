/**
 * The copy of the cover note (spec section 3), as structured data. Canonical
 * for the app: CoverNote.tsx renders this and holds no content literals of
 * its own. Every heading, paragraph, term and detail here is verbatim from
 * docs/superpowers/specs/2026-09-23-cover-note-design.md section 3, in the
 * spec's order, with section 3.1's placement rule applied ("What you are
 * about to see" is the fourth block).
 *
 * Two copy-fidelity notes:
 *
 * - The spec's blockquote markers (`>`) are formatting of the spec document
 *   and are stripped. Its bold spans are content and are preserved with
 *   inline `**...**` markers, which CoverNote.tsx renders as <strong>. Four
 *   spans carry them, exactly the spans the spec bolds inside copy: the
 *   lead-ins "The user." and "The problem.", the sentence "Nothing is sent
 *   anywhere, and no external booking exists.", and "Paths, not hyperlinks."
 * - Backticked ids and paths in the spec's prose (`V-012`, `V-041`, `` `npm
 *   run dev` ``, and similar) render as plain text throughout, one of the two
 *   choices the spec allows, applied consistently. The one exception is the
 *   "Where the thinking lives" table, where the spec requires the paths
 *   themselves to render in monospace; CoverNote.tsx applies that as a
 *   block-level rule for every `paths` entry, not as a per-string decision.
 */

export type CoverBlock =
  | { kind: 'prose'; id: string; heading: string; paragraphs: string[] }
  | { kind: 'pairs'; id: string; heading: string; pairs: { term: string; detail: string }[] }
  | {
      kind: 'paths'
      id: string
      heading: string
      note: string
      paths: { path: string; description: string }[]
    }

export type CoverNoteContent = {
  title: string
  promise: string
  blocks: CoverBlock[]
}

export const coverNoteContent: CoverNoteContent = {
  title: 'Fleet maintenance: the weekly plan',
  promise:
    "Make this week's maintenance plan, understand the trade-offs, and leave nothing deferred without a reason and a follow-up.",
  blocks: [
    {
      kind: 'prose',
      id: 'challenge',
      heading: 'The challenge as given',
      paragraphs: [
        'A company runs around 45 delivery vans from one depot. It wants them available and reliable, without paying for maintenance it does not need and without losing vehicles to breakdowns it could have anticipated.',
        'What the product should actually do was left open. Monitoring condition, spotting problems, prioritising work, planning it, coordinating with garages, understanding cost, keeping history. This is the part I chose, and the reasons are below.',
      ],
    },
    {
      kind: 'prose',
      id: 'user-and-problem',
      heading: 'The user and problem I chose',
      paragraphs: [
        '**The user.** The part-time Fuhrparkverantwortliche at one depot of 45 vans. Fleet is a fraction of their job. They carry personal liability under UVV, and they have the authority to pull a vehicle off the road.',
        '**The problem.** Decide what to service this week and what can reasonably wait, while seeing what that decision does to work already committed.',
        'Not every maintenance problem. One weekly decision, made under a capacity ceiling, by someone who is accountable for it and does not have all day.',
      ],
    },
    {
      kind: 'prose',
      id: 'what-you-will-see',
      heading: 'What you are about to see',
      paragraphs: [
        'You land on the fleet first: 45 vans, one already off the road, and a short list of what needs you. It answers the daily question, is today fine, before you plan the week. The weekly plan is one tab over, and everything below describes it.',
        'One planning week. A capacity band across the top that stays visible while you work, because it is the thing every decision moves. Below it, five decisions waiting on you.',
        'Two things block the week. Tuesday is one van short, because three standard vans are off the road at once and the rental cover only stretches to two of them: moving one visit clears it. And V-041, the only specialist van in the queue, still needs a decision. No specialist cover exists this week, so scheduling it leaves an assignment uncovered that nothing available can fill.',
        'V-012 is already out of service before you commit anything, on a brake defect found at inspection. It stays out until a release is recorded, and the week plans around it.',
        'The plan cannot be committed until the blockers are cleared. That is deliberate.',
      ],
    },
    {
      kind: 'pairs',
      id: 'decisions',
      heading: 'The decisions worth knowing about',
      pairs: [
        {
          term: 'Capacity is counted per class, never in aggregate',
          detail:
            'An aggregate count reads one van short and forgivable while the only compatible specialist van is off the road with nothing able to cover it. V-041 exists to make that visible.',
        },
        {
          term: 'Urgency is three states, never a score',
          detail:
            'A known deadline, an estimate with its assumption named, or an unknown condition that reads assessment needed. No number is invented where the evidence supports none.',
        },
        {
          term: 'Disruption stays apart; spend does not',
          detail:
            'Operational disruption is never blended into money: it stays a count of uncovered assignments, because turning it into euros needs a revenue-per-route figure this scenario cannot support. Service cost and replacement cover are both spend, so they combine into one weekly total tracked against a budget.',
        },
        {
          term: 'Deferral is a record, not a gut call',
          detail:
            'Reason, review date and trigger are all required, and the item returns carrying them. Waiting is a legitimate decision; waiting without a follow-up is not.',
        },
        {
          term: 'A blocked plan is a legitimate outcome',
          detail:
            'When no lever closes a gap, the draft survives and the blocker is named. The product never claims a readiness it does not have.',
        },
      ],
    },
    {
      kind: 'pairs',
      id: 'not-built',
      heading: 'What I deliberately did not build, and why',
      pairs: [
        {
          term: 'Quote and approval',
          detail:
            'No procurement function at this size. Every decision here sits inside delegated authority. Above-threshold spend exists and is left out of frame rather than replaced by an invented approval workflow.',
        },
        {
          term: 'A surface for the managing director',
          detail:
            'The MD never opens this product. In production an approval surface is operationally necessary; omitting it is a scope decision, not a claim that it is unnecessary.',
        },
        {
          term: 'A driver app and a garage portal',
          detail:
            "The driver is a signal source and an outcome recipient, not a surface. The garage portal is a different company's product.",
        },
        {
          term: 'Predictive failure modelling',
          detail:
            'A black box fails the test of helping someone understand what deserves attention, especially someone carrying personal liability. The structured recommendation is the alternative.',
        },
        {
          term: 'Real bookings, messages and integrations',
          detail:
            'Commit is simulated and guaranteed by the scenario. Real-world rejection and pending confirmation are future work.',
        },
        {
          term: 'Route optimisation, cost analytics, multi-depot',
          detail: 'Out of frame for one weekly decision at one depot.',
        },
      ],
    },
    {
      kind: 'prose',
      id: 'simulated',
      heading: 'What is simulated',
      paragraphs: [
        'Everything outside the depot. Vehicle data, telematics, inspection findings, garage slots, parts lead times, rental cover and prices are all fixtures, and they are labelled in the product.',
        'Commit is a simulated commitment. The scenario guarantees the selected slots and confirms them. **Nothing is sent anywhere, and no external booking exists.** Every price is a scenario price.',
      ],
    },
    {
      kind: 'paths',
      id: 'thinking',
      heading: 'Where the thinking lives',
      note: '**Paths, not hyperlinks.** A relative link resolves differently under npm run dev, under a served dist/, and under a dist/index.html opened from the filesystem, so hyperlinking introduces a broken-link failure mode for no benefit. The reader has the repository.',
      paths: [
        {
          path: 'docs/fleet-maintenance-work-packages.md',
          description: 'The build contract, scope, goals and what was cut',
        },
        {
          path: 'docs/fleet-maintenance-research-findings.md',
          description: 'Research and framing, and where the user came from',
        },
        {
          path: 'docs/superpowers/specs/2026-09-23-fleet-maintenance-prototype-design.md',
          description: 'The technical design',
        },
        {
          path: 'docs/mockups/',
          description: 'Layout decisions and the alternatives they were made from',
        },
      ],
    },
  ],
}
