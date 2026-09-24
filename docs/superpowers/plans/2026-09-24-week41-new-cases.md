# Week 41 new cases implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author two new maintenance cases into week 41 (`V-105`'s HU deadline, `V-024`'s tyre
tread) so the fleet overview and weekly plan keep surfacing new work after week 40, instead of only
resurfacing old decisions.

**Architecture:** Pure fixture-data change. Two new `OpenItem` entries in `src/domain/fixture.ts`
and one array edit (`fixture.weeks[1].itemIds`). No new types, domain logic, or UI components:
`queueFor`, `fleetOverview`, `groupQueue`, `validatePlan` and `orderQueue` already operate
generically over whatever a week authors.

**Tech Stack:** TypeScript, Vitest, Vite, React 19. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-24-week41-new-cases-design.md`. Read it before starting;
this plan implements it directly and does not repeat its reasoning.

## Global Constraints

- No new files, types, domain modules, or UI components. Everything here is fixture data plus test
  and doc updates (spec §5).
- New copy (item titles, evidence, consequence text) is sentence case, matching the existing fixture
  items' style.
- Do not use an em dash (`—`) anywhere: not in code comments, not in test descriptions, not in
  documentation prose, not in commit messages. Use a comma, colon, semicolon, or a separate sentence
  instead. This applies to every step below, including the literal text shown in code blocks.
- TDD: for Task 1, update the test files first, run them to see the expected failures, then make the
  single fixture.ts edit that turns all of them green.
- `npm test` runs the whole Vitest suite (`vitest run`). `npx vitest run <path>` runs one file.
  `npx tsc --noEmit` type-checks with no emit. `npm run build` runs `tsc && vite build`.
- One commit per task. Stage exact file paths with `git add <path> <path> ...`, never `git add -A`
  or `git add .`. Use plain `git commit`, not a commit-proposal tool (it does not work reliably in
  this repository). Do not use `--no-verify` or skip hooks.

---

## Task 1: Author V-024 and V-105 into week 41

**Files:**
- Modify: `src/domain/fixture.ts` (the `items` array and `weeks[1].itemIds`)
- Modify: `src/domain/fixture.test.ts`
- Modify: `src/domain/fleetStatus.test.ts`
- Modify: `src/domain/scenarios.test.ts`
- Modify: `src/domain/planReducer.test.ts`

**Interfaces:**
- Produces: two new fixture item ids, `'item-v024'` and `'item-v105'`, on vehicles `'V-024'` and
  `'V-105'` (both already exist in `fixture.vehicles`, standard class, previously itemless). Both
  are `OpenItem`s (see `src/domain/types.ts`) with `proposal.treatment: 'act-now'` and
  `proposal.slotDate: '2026-10-08'`. `fixture.weeks[1].itemIds` becomes
  `['item-v024', 'item-v105']`. Every later task and any future code reads these through the
  existing `fixture` export; nothing else changes shape.

- [ ] **Step 1: Update `src/domain/fixture.test.ts`**

Two existing assertions are now wrong (the fixture will soon have 7 items, not 5, and week 41 will
author 2, not 0), and the new items need their own coverage, matching how V-103/V-118/V-041/V-027
each get a dedicated fixture-integrity check.

Replace:

```ts
  it('has five open items, each referencing a real vehicle', () => {
    expect(fixture.items).toHaveLength(5)
    const ids = new Set(fixture.vehicles.map((v) => v.id))
    for (const item of fixture.items) expect(ids.has(item.vehicleId)).toBe(true)
  })
```

with:

```ts
  it('has seven open items, each referencing a real vehicle', () => {
    expect(fixture.items).toHaveLength(7)
    const ids = new Set(fixture.vehicles.map((v) => v.id))
    for (const item of fixture.items) expect(ids.has(item.vehicleId)).toBe(true)
  })

  it('authors two new standard-class cases for week 41, both act-now on Thursday', () => {
    const v024 = fixture.items.find((i) => i.id === 'item-v024')!
    const v105 = fixture.items.find((i) => i.id === 'item-v105')!
    expect(v024.vehicleId).toBe('V-024')
    expect(v024.urgency.kind).toBe('estimate')
    expect(v024.safetyClass).toBe(false)
    expect(v024.proposal).toEqual({ treatment: 'act-now', slotDate: '2026-10-08', deferral: null })
    expect(v105.vehicleId).toBe('V-105')
    expect(v105.urgency.kind).toBe('deadline')
    expect(v105.safetyClass).toBe(false)
    expect(v105.proposal).toEqual({ treatment: 'act-now', slotDate: '2026-10-08', deferral: null })
    expect(fixture.vehicles.find((v) => v.id === 'V-024')?.vehicleClass).toBe('standard')
    expect(fixture.vehicles.find((v) => v.id === 'V-105')?.vehicleClass).toBe('standard')
  })
```

Replace:

```ts
  it('authors two weeks, the second carrying no new items', () => {
    expect(fixture.weeks.map((w) => w.weekId)).toEqual(['2026-09-28', '2026-10-05'])
    expect(fixture.weeks[0].itemIds).toHaveLength(5)
    expect(fixture.weeks[1].itemIds).toHaveLength(0)
  })
```

with:

```ts
  it('authors two weeks, the second carrying two new cases plus resurfacing', () => {
    expect(fixture.weeks.map((w) => w.weekId)).toEqual(['2026-09-28', '2026-10-05'])
    expect(fixture.weeks[0].itemIds).toHaveLength(5)
    expect(fixture.weeks[1].itemIds).toEqual(['item-v024', 'item-v105'])
  })
```

In the `describe('each item carries its own deferral triggers', ...)` block, add these two tests
after the existing `'offers V-027 the event its own proposed deferral names'` test (the block ends
with the `'never offers an item a trigger about another vehicle'` test; add these before it):

```ts
  it('offers V-024 a recheck odometer trigger', () => {
    expect(optionsFor('item-v024')).toEqual([
      {
        kind: 'odometer',
        vehicleId: 'V-024',
        thresholdKm: 64_000,
        label: 'Odometer passes 64,000 km',
      },
    ])
  })

  it('offers V-105 the HU reminder event, which never fires in the fixture', () => {
    expect(optionsFor('item-v105')).toEqual([
      { kind: 'event', eventId: 'v105-hu-reminder', label: 'Registration office sends the final HU reminder' },
    ])
    expect(fixture.events.some((e) => e.eventId === 'v105-hu-reminder')).toBe(false)
  })
```

- [ ] **Step 2: Update `src/domain/scenarios.test.ts`**

Scenario 8 currently asserts week 41's queue is exactly `['item-v041']`. It becomes the two new
cases first (in `itemIds` order), then the resurfaced item. Replace:

```ts
describe('8. Review date arrives or trigger fires', () => {
  it('returns V-041 with its earlier decision and rationale intact', () => {
    const committed = reduce(resolvedState(), { type: 'commit', weekId: WEEK_40 })
    const advanced = reduce(committed, { type: 'advance-to-next-review' })
    expect(advanced.demoDate).toBe('2026-10-05')
    const queue = queueFor({ fixture, state: advanced, weekId: '2026-10-05' })
    expect(queue.map((q) => q.item.id)).toEqual(['item-v041'])
    expect(queue[0].priorDecision!.deferral.reason).toContain('No specialist cover')
    expect(queue[0].resurfacedBecause).toContain('Review date')
  })
})
```

with:

```ts
describe('8. Review date arrives or trigger fires', () => {
  it('returns V-041 with its earlier decision and rationale intact', () => {
    const committed = reduce(resolvedState(), { type: 'commit', weekId: WEEK_40 })
    const advanced = reduce(committed, { type: 'advance-to-next-review' })
    expect(advanced.demoDate).toBe('2026-10-05')
    const queue = queueFor({ fixture, state: advanced, weekId: '2026-10-05' })
    // Week 41 now also authors its own two cases (item-v024, item-v105) ahead
    // of whatever resurfaces. V-041 is still the only resurfaced entry.
    expect(queue.map((q) => q.item.id)).toEqual(['item-v024', 'item-v105', 'item-v041'])
    const v041 = queue.find((q) => q.item.id === 'item-v041')!
    expect(v041.priorDecision!.deferral.reason).toContain('No specialist cover')
    expect(v041.resurfacedBecause).toContain('Review date')
  })
})
```

- [ ] **Step 3: Update `src/domain/planReducer.test.ts`**

Same shape of fix, mirrored. Replace:

```ts
  it('resurfaces V-041 into week 41 with its rationale intact', () => {
    const s = reduce(committedWeek40(), { type: 'advance-to-next-review' })
    const queue = queueFor({ fixture, state: s, weekId: '2026-10-05' })
    expect(queue.map((q) => q.item.id)).toEqual(['item-v041'])
    expect(queue[0].resurfacedBecause).toContain('Review date')
    expect(queue[0].priorDecision!.deferral.reason).toContain('No specialist cover')
  })
```

with:

```ts
  it('resurfaces V-041 into week 41 with its rationale intact', () => {
    const s = reduce(committedWeek40(), { type: 'advance-to-next-review' })
    const queue = queueFor({ fixture, state: s, weekId: '2026-10-05' })
    // Week 41 now also authors its own two cases (item-v024, item-v105) ahead
    // of whatever resurfaces. V-041 is still the only resurfaced entry.
    expect(queue.map((q) => q.item.id)).toEqual(['item-v024', 'item-v105', 'item-v041'])
    const v041 = queue.find((q) => q.item.id === 'item-v041')!
    expect(v041.resurfacedBecause).toContain('Review date')
    expect(v041.priorDecision!.deferral.reason).toContain('No specialist cover')
  })
```

- [ ] **Step 4: Update `src/domain/fleetStatus.test.ts`**

Three changes in this file. First, a comment that is about to go stale (in the
`describe('fleet overview in week 41', ...)` block). Replace:

```ts
  it('leaves the held van red with no item, since week 41 queues none for it', () => {
    // The shape the attention card has to survive: red, real facts, nothing to
    // navigate to. Week 41 authors no items and V-012's week-40 item was
    // committed, so only the hold is left. [FO spec 4]
```

with:

```ts
  it('leaves the held van red with no item, since week 41 queues none for it', () => {
    // The shape the attention card has to survive: red, real facts, nothing to
    // navigate to. Week 41 authors two new cases of its own now, but none for
    // V-012, and its week-40 item was committed, so only the hold is left.
    // [FO spec 4]
```

Second, the stale count assertion right after it, plus the new describe block for the Thursday
collision, inserted immediately after that same `describe` block closes. Replace:

```ts
  it('releases the held van once the recorded release date passes', () => {
    const later = overviewFor(planReducer(s, { type: 'advance-days', days: 1 }, fixture))
    expect(vanOf(later, 'V-012').kind).toBe('in-service')
    expect(vanOf(later, 'V-012').facts).toEqual([])
    expect(vanOf(later, 'V-027').facts).toEqual(['Watching · review Mon 2 Nov'])
    expect(later.counts).toEqual({ offRoad: 0, needsDecision: 1, inService: 44 })
  })
})

describe('fleet overview: a held van whose own item resurfaces undecided', () => {
```

with:

```ts
  it('releases the held van once the recorded release date passes', () => {
    const later = overviewFor(planReducer(s, { type: 'advance-days', days: 1 }, fixture))
    expect(vanOf(later, 'V-012').kind).toBe('in-service')
    expect(vanOf(later, 'V-012').facts).toEqual([])
    expect(vanOf(later, 'V-027').facts).toEqual(['Watching · review Mon 2 Nov'])
    // needsDecision now also counts V-024 and V-105, week 41's own new cases.
    expect(later.counts).toEqual({ offRoad: 0, needsDecision: 3, inService: 42 })
  })
})

describe('fleet overview: two new week-41 cases collide on Thursday', () => {
  const week41 = planReducer(committedState(), { type: 'advance-to-next-review' }, fixture)

  it('shows both new cases amber with an item to open, from the moment week 41 is reached', () => {
    const o = overviewFor(week41)
    expect(vanOf(o, 'V-024').kind).toBe('needs-decision')
    expect(vanOf(o, 'V-024').itemId).toBe('item-v024')
    expect(vanOf(o, 'V-105').kind).toBe('needs-decision')
    expect(vanOf(o, 'V-105').itemId).toBe('item-v105')
  })

  it('flags Thursday standard short by 1 with no decision made yet', () => {
    const thursday = planReducer(week41, { type: 'advance-days', days: 3 }, fixture)
    const o = overviewFor(thursday)
    expect(o.today.date).toBe('2026-10-08')
    expect(o.today.covered).toBe(false)
    expect(o.today.shortfalls.map((s) => [s.vehicleClass, s.shortfall])).toEqual([['standard', 1]])
  })

  it('clears Thursday when one case moves to a day with spare capacity', () => {
    const beforeMove = planReducer(week41, { type: 'advance-days', days: 3 }, fixture)
    expect(overviewFor(beforeMove).today.covered).toBe(false)

    const moved = planReducer(
      week41,
      {
        type: 'set-decision',
        weekId: '2026-10-05',
        decision: { itemId: 'item-v024', treatment: 'act-now', slotDate: '2026-10-06', deferral: null },
      },
      fixture,
    )
    const afterMove = planReducer(moved, { type: 'advance-days', days: 3 }, fixture)
    expect(overviewFor(afterMove).today.covered).toBe(true)
  })

  it('relocates rather than resolves the shortfall if moved to Monday instead', () => {
    const moved = planReducer(
      week41,
      {
        type: 'set-decision',
        weekId: '2026-10-05',
        decision: { itemId: 'item-v024', treatment: 'act-now', slotDate: '2026-10-05', deferral: null },
      },
      fixture,
    )
    const monday = overviewFor(moved)
    expect(monday.today.date).toBe('2026-10-05')
    expect(monday.today.covered).toBe(false)
    expect(monday.today.shortfalls.map((s) => [s.vehicleClass, s.shortfall])).toEqual([['standard', 1]])

    const thursday = planReducer(moved, { type: 'advance-days', days: 3 }, fixture)
    expect(overviewFor(thursday).today.covered).toBe(true)
  })
})

describe('fleet overview: a held van whose own item resurfaces undecided', () => {
```

- [ ] **Step 5: Run the suite and confirm the expected failures**

Run: `npm test`

Expected: multiple failures. In particular:
- `src/domain/fixture.test.ts`: the two new fixture-shape tests fail (item not found, or
  `toHaveLength(7)`/`toEqual(['item-v024','item-v105'])` mismatches against the current 5-item,
  empty-week-41 fixture).
- `src/domain/scenarios.test.ts` and `src/domain/planReducer.test.ts`: the queue assertions fail,
  still returning `['item-v041']` only.
- `src/domain/fleetStatus.test.ts`: the counts test fails (`{needsDecision: 1}` instead of the
  expected 3). In the new `describe('fleet overview: two new week-41 cases collide on Thursday',
  ...)` block: the first test fails because V-024 and V-105 already exist as vehicles but have no
  item yet, so `vanOf(...).kind` reads `'in-service'`, not `'needs-decision'`, and `.itemId` reads
  `null`; the second and third tests fail because Thursday has nothing scheduled on it yet, so
  `today.covered` reads `true` where the test expects `false`; the fourth test fails on its first
  assertion, since Monday (with no `item-v024` to move there yet) also reads `covered: true` where
  the test expects `false`.

If any OTHER test fails, stop and read why before continuing; it may mean a test this plan marked
safe in the spec's §7 actually depends on week 41's item list. Cross-check against spec §7 before
changing anything not listed here.

- [ ] **Step 6: Implement: add the two items to `src/domain/fixture.ts`**

In the `items` array, insert two new entries after `item-v027` (the last item), before the array's
closing `]`. Replace:

```ts
    triggerOptions: [
      { kind: 'event', eventId: 'v027-wipe-degrades', label: 'Driver reports the wipe quality degrading' },
    ],
  },
]
```

with:

```ts
    triggerOptions: [
      { kind: 'event', eventId: 'v027-wipe-degrades', label: 'Driver reports the wipe quality degrading' },
    ],
  },
  {
    id: 'item-v024',
    vehicleId: 'V-024',
    title: 'Front tyre tread approaching the legal minimum',
    garageId: 'werkstatt-berg',
    evidence: {
      observation:
        'Front-axle tread depth read at 2.1 mm, telematics-linked. Statutory minimum under StVZO is 1.6 mm.',
      source: 'Telematics tread-depth feed',
      receivedOn: '2026-10-05',
      verbatim: null,
    },
    urgency: {
      kind: 'estimate',
      because: 'Tread read 2.1 mm on 5 Oct against a 1.6 mm legal minimum under StVZO.',
      relevantDate: null,
    },
    assumption:
      'A single tread reading does not establish a wear rate, so no replacement date is projected. The finding alone is evidence enough to book the visit this week rather than wait for a second reading.',
    safetyClass: false,
    parts: { name: 'Front tyre pair', readyOn: '2026-10-07' },
    visitDays: 1,
    canExtendToDays: null,
    consequence: {
      qualitative:
        'Tread continues toward the legal minimum with each week driven. No regulatory deadline applies yet, and replacing now avoids a rushed booking once the margin closes.',
      serviceCostEur: 240,
      coverCostEur: 140,
      coverUnavailable: false,
      uncoveredAssignmentsNote: 'Depends on the day chosen. Thursday leaves one assignment uncovered.',
    },
    proposal: { treatment: 'act-now', slotDate: '2026-10-08', deferral: null },
    triggerOptions: [
      {
        kind: 'odometer',
        vehicleId: 'V-024',
        thresholdKm: 64_000,
        label: 'Odometer passes 64,000 km',
      },
    ],
  },
  {
    id: 'item-v105',
    vehicleId: 'V-105',
    title: 'Hauptuntersuchung (HU) due',
    garageId: 'werkstatt-berg',
    evidence: {
      observation: 'HU sticker expires 31 Oct 2026. No test slot booked yet.',
      source: 'Fleet registration record',
      receivedOn: '2026-10-05',
      verbatim: null,
    },
    urgency: {
      kind: 'deadline',
      because:
        'Legally required roadworthiness test (HU) must be completed before the sticker expires. Driving past that date without a valid HU is an administrative offence.',
      relevantDate: '2026-10-31',
    },
    assumption: null,
    safetyClass: false,
    parts: null,
    visitDays: 1,
    canExtendToDays: null,
    consequence: {
      qualitative:
        'A missed HU deadline is an administrative offence and can affect insurance cover if the van is stopped without a valid test. Booking now, well ahead of 31 Oct, avoids a last-minute scramble if the test finds a defect needing a follow-up visit before the sticker expires.',
      serviceCostEur: 120,
      coverCostEur: 140,
      coverUnavailable: false,
      uncoveredAssignmentsNote: 'Depends on the day chosen. Thursday leaves one assignment uncovered.',
    },
    proposal: { treatment: 'act-now', slotDate: '2026-10-08', deferral: null },
    triggerOptions: [
      { kind: 'event', eventId: 'v105-hu-reminder', label: 'Registration office sends the final HU reminder' },
    ],
  },
]
```

Then, in the `weeks` array, update week 41's `itemIds`. Replace:

```ts
  {
    weekId: '2026-10-05',
    days: WEEK_41,
    demand: { standard: 38, specialist: 7 },
    coverIds: ['R-1'],
    itemIds: [],
  },
]
```

with:

```ts
  {
    weekId: '2026-10-05',
    days: WEEK_41,
    demand: { standard: 38, specialist: 7 },
    coverIds: ['R-1'],
    itemIds: ['item-v024', 'item-v105'],
  },
]
```

Note: do not add anything to the `events` array. `item-v105`'s trigger (`v105-hu-reminder`)
deliberately has no matching `ScheduledEvent`, the same way `item-v027`'s trigger never fires: an
unknown `eventId` makes `hasEventFired` return `false` unconditionally (see `src/domain/clock.ts`).

- [ ] **Step 7: Run the suite and confirm everything passes**

Run: `npm test`

Expected: PASS, all files, 0 failures. The suite should now report more tests than before this task
(the additions from Step 1 and Step 4), all green.

- [ ] **Step 8: Commit**

```bash
git add src/domain/fixture.ts src/domain/fixture.test.ts src/domain/fleetStatus.test.ts src/domain/scenarios.test.ts src/domain/planReducer.test.ts
git commit -m "feat: author V-024 and V-105 into week 41"
```

---

## Task 2: Full automated verification sweep

**Files:** none (verification only; fix forward in the files above if something fails).

**Interfaces:**
- Consumes: the fixture and test changes from Task 1.
- Produces: a known-good baseline (test count, clean typecheck, clean build) for Task 4's
  documentation to cite.

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`

Expected: PASS. Note the final summary line (something like `Test Files N passed (N)` and
`Tests M passed (M)`); Task 4 needs these two numbers.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

Expected: no output, exit code 0.

- [ ] **Step 3: Build**

Run: `npm run build`

Expected: builds cleanly, writes `dist/`. If this fails while Steps 1 and 2 passed, it is almost
certainly unrelated to this task (fixture data cannot fail a build that already type-checks), but
read the error before assuming that.

- [ ] **Step 4: Record the baseline for Task 4**

Run: `git rev-parse --short HEAD`

Note this commit hash alongside the test/file counts from Step 1. Task 4's documentation step uses
both.

No commit for this task; nothing changes unless a step above fails, in which case fix the
underlying issue in Task 1's files and re-run this task from Step 1.

---

## Task 3: Manual browser verification

**Files:** none (manual verification only).

**Interfaces:**
- Consumes: the running app, built from Task 1's fixture change.
- Produces: a confirmed live walkthrough of the two new cases, for Task 4's "Verified live" claims.

- [ ] **Step 1: Launch the app**

Use the `run` skill for this project if available. Otherwise: `npm run dev`, then open the printed
URL in a browser.

- [ ] **Step 2: Reach week 41**

From cold open: make the walkthrough's week-40 decisions (or simply commit whatever is drafted),
then use the demo bar's "Advance to next review date" control. This should land the demo clock on
Monday, 5 October 2026.

- [ ] **Step 3: Confirm the two new cases are visible on the fleet overview**

On the "Fleet today" tab: confirm the attention list includes a card for `V-024` (tyre tread) and a
card for `V-105` (HU deadline), each amber, each with its own urgency chip and because-text, each
with an "Open in week plan" affordance.

- [ ] **Step 4: Confirm the weekly plan shows them as blocking**

Switch to the "Week plan" tab. Confirm the "Blocking the week" group lists `V-024` and `V-105`
(alongside `V-041` if it is still undisposed). Confirm the capacity band flags Thursday, 8 October,
standard short by 1.

- [ ] **Step 5: Confirm the shortfall clears on relocation**

Open either `V-024` or `V-105` and move its slot to Tuesday, Wednesday, or Friday. Confirm
Thursday's shortfall clears in the capacity band and Commit is no longer blocked by it.

- [ ] **Step 6: Confirm the booked state after commit**

Resolve the remaining blockers (including `V-041` if present) and commit. Return to the fleet
overview and confirm both `V-024` and `V-105` now show a `Booked` sub-label with the day they were
scheduled.

- [ ] **Step 7: Reset**

Use the demo bar's "Reset scenario" control and confirm the app returns to the week-40 cold-open
state.

If any of Steps 3 to 6 shows something other than what is described, stop and treat it as a defect
in Task 1's fixture data or this plan's understanding of the domain layer, not something to note
around in the documentation. Fix it, re-run Task 2, and re-run this task before moving on.

No commit for this task unless Step-7-triggered investigation required a code fix, in which case
fix it in Task 1's files, re-run Task 2, and commit under Task 1's commit message convention.

---

## Task 4: Documentation updates

**Files:**
- Modify: `README.md`
- Modify: `docs/acceptance.md`
- Modify: `docs/superpowers/specs/2026-09-23-fleet-overview-design.md`

**Interfaces:**
- Consumes: the test/file counts and commit hash recorded in Task 2, and the confirmed live
  behaviour from Task 3.
- Produces: none (documentation only).

- [ ] **Step 1: Correct README limitation 1**

Replace:

```
1. Week 41 and later carry only resurfaced items. No new work is authored for them.
```

with:

```
1. Week 41 additionally authors two new cases (a HU deadline and a tyre-tread estimate, both
   landing on the same Thursday). Week 42 and later still carry only resurfaced items.
```

- [ ] **Step 2: Update the README walkthrough's step 8**

Replace:

```
8. Advance the clock to the next review date. `V-041` returns with its rationale intact. Reset.
```

with:

```
8. Advance the clock to the next review date. `V-041` returns with its rationale intact, and week 41
   opens with two new cases of its own: `V-105`'s HU deadline and `V-024`'s tyre tread, both
   proposed for the same Thursday and leaving it one standard van short. Reset.
```

- [ ] **Step 3: Correct `docs/acceptance.md` limitation 1**

Replace:

```
1. Week 41 and later contain only resurfaced items. No new work is authored for them.
```

with:

```
1. Week 41 additionally authors two new cases. Week 42 and later still contain only resurfaced
   items. See the "two new week-41 cases" addendum below.
```

- [ ] **Step 4: Add a new dated addendum to `docs/acceptance.md`**

Append this section at the end of the file, after the existing "Addendum: final whole-branch review
of the fleet overview (2026-09-24)" section. Fill in the two bracketed spots using the values
recorded in Task 2 (Step 1's test/file counts, Step 4's commit hash); leave nothing else in
brackets.

```markdown
## Addendum: two new week-41 cases (2026-09-24)

**Build:** <commit hash from Task 2, Step 4> · **Commands:** `npm test` (<test count> tests,
<file count> files, all passing), `npx tsc --noEmit` (clean), `npm run build` (clean), plus a live
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
group lists three items (V-024, V-105 and, if still undisposed, V-041). Moving one case's slot to
Tuesday, Wednesday or Friday clears the Thursday shortfall in the capacity band, and moving it to
Monday instead relocates the shortfall rather than clearing it. Committing shows both vans as
`Booked Thu 8 Oct` on the fleet overview.
```

- [ ] **Step 5: Add a cross-reference in the fleet-overview spec's edge cases**

In `docs/superpowers/specs/2026-09-23-fleet-overview-design.md`, §8 "Edge cases", replace:

```
- **Week 41.** Resurfaced items go amber with their prior decision visible through the queue's own
  wording. V-012 turns green once its recorded release date passes, with no special casing:
  `isHeldOn` already answers it.
```

with:

```
- **Week 41.** Resurfaced items go amber with their prior decision visible through the queue's own
  wording. V-012 turns green once its recorded release date passes, with no special casing:
  `isHeldOn` already answers it. Week 41 additionally authors two new cases of its own, unrelated to
  resurfacing; see `docs/superpowers/specs/2026-09-24-week41-new-cases-design.md`.
```

- [ ] **Step 6: Add a cross-reference in the fleet-overview spec's test list**

In the same file, §9 "Testing and verification", replace:

```
5. Week 41: V-041 resurfaced amber; V-012 green after the recorded release.
```

with:

```
5. Week 41: V-041 resurfaced amber; V-012 green after the recorded release. (Week 41 also authors
   two new cases of its own; see `docs/superpowers/specs/2026-09-24-week41-new-cases-design.md`.)
```

- [ ] **Step 7: Check for em dashes before committing**

Run: `grep -rn "—" README.md docs/acceptance.md docs/superpowers/specs/2026-09-23-fleet-overview-design.md`

Expected: no output. If anything matches, rewrite that line with a comma, colon, semicolon, or
separate sentence before continuing.

- [ ] **Step 8: Commit**

```bash
git add README.md docs/acceptance.md docs/superpowers/specs/2026-09-23-fleet-overview-design.md
git commit -m "docs: record the two new week 41 cases"
```

---

## Self-review notes

**Spec coverage.** §3 (the two cases): Task 1 Step 6. §4 (Thursday collision): Task 1 Step 4's new
describe block, Task 3 Steps 4 to 5. §5 (architecture, no new code paths): satisfied by construction,
nothing outside `fixture.ts` changes production behaviour. §6 (edge cases): the "left undecided"
case needs no code, per the spec; the "V-041 onto Thursday too" case is existing `slotBlockers`
behaviour, exercised informally if it comes up in Task 3 but not separately tested, matching the
spec's own call not to build anything for it. §7 (testing): all four listed test updates are Task 1
Steps 1 to 4; the new coverage is Task 1 Step 4's describe block; manual verification is Task 3.
§8 (documentation): Task 4 covers README, acceptance.md, and the fleet-overview spec cross-references.
§9/§10 (not built / cost): no task builds any of the rejected items; confirmed by the plan touching
only the five files listed in Task 1 plus the three doc files in Task 4.

**Placeholder scan.** The only bracketed text in this plan is in Task 4 Step 4's addendum template
(`<commit hash from Task 2, Step 4>`, `<test count>`, `<file count>`), and Step 4 explicitly
instructs filling these from values already recorded in Task 2. Nothing else in this plan is a
placeholder; every step has complete, runnable code.

**Type consistency.** `OpenItem` field names and the `proposal`/`urgency`/`consequence` shapes in
Task 1 Step 6 match `src/domain/types.ts` exactly (checked against the file directly). `set-decision`
payloads in Task 1 Step 4's new tests match `DraftDecision` (`itemId`, `treatment`, `slotDate`,
`deferral`), the same shape every existing test in this file uses.
