import { describe, expect, it } from 'vitest'
import { daysBetween } from './clock'
import { fixture, SEED_DATE } from './fixture'
import { fleetOverview, nextBusinessDay, type FleetOverview } from './fleetStatus'
import { validatePlan } from './validation'
import {
  activeWeekId,
  draftFor,
  initialState,
  planReducer,
  queueFor,
  type AppState,
} from '../state/planReducer'
import type { Fixture } from './types'

const WEEK_40 = '2026-09-28'

function overviewFor(state: AppState, fx: Fixture = fixture): FleetOverview {
  const weekId = activeWeekId(state)
  const decisions = draftFor({ fixture: fx, state, weekId })
  return fleetOverview({
    fixture: fx,
    today: state.demoDate,
    queueItems: queueFor({ fixture: fx, state, weekId }).map((e) => e.item),
    decisions,
    blockers: validatePlan({ fixture: fx, weekId, decisions }),
    committed: state.committedByWeek[weekId] ?? null,
    deferralHistory: state.deferralHistory,
  })
}

function vanOf(overview: FleetOverview, id: string) {
  const found = [...overview.attention, ...overview.quiet].find((s) => s.vehicleId === id)
  if (!found) throw new Error(`No status for ${id}`)
  return found
}

/** The walkthrough decisions: V-118 moved to Thursday, V-041 deferred, commit. */
function committedState(fx: Fixture = fixture): AppState {
  let s = initialState(fx)
  s = planReducer(
    s,
    {
      type: 'set-decision',
      weekId: WEEK_40,
      decision: { itemId: 'item-v118', treatment: 'act-now', slotDate: '2026-10-01', deferral: null },
    },
    fx,
  )
  s = planReducer(
    s,
    {
      type: 'set-decision',
      weekId: WEEK_40,
      decision: {
        itemId: 'item-v041',
        treatment: 'watch',
        slotDate: null,
        deferral: {
          reason: 'No drivability complaint. Assess if the code recurs.',
          reviewDate: '2026-10-05',
          trigger: { kind: 'event', eventId: 'v041-dtc-recurs', label: 'DTC P0300 recurs' },
        },
      },
    },
    fx,
  )
  return planReducer(s, { type: 'commit', weekId: WEEK_40 }, fx)
}

describe('fleet overview at cold open', () => {
  const o = overviewFor(initialState(fixture))

  it('counts 1 off the road, 4 needing a decision, 40 in service', () => {
    expect(o.counts).toEqual({ offRoad: 1, needsDecision: 4, inService: 40 })
    expect(o.onRoad).toBe(44)
    expect(o.committed).toBe(false)
  })

  it('orders attention exactly like the queue', () => {
    expect(o.attention.map((s) => s.vehicleId)).toEqual(['V-012', 'V-041', 'V-103', 'V-118', 'V-027'])
  })

  it('shows the held van with its hold reason and no workshop fact', () => {
    const v012 = vanOf(o, 'V-012')
    expect(v012.kind).toBe('off-road')
    expect(v012.facts).toEqual(['Held · Safety-relevant brake defect recorded at UVV inspection'])
    expect(v012.itemId).toBe('item-v012')
  })

  it('covers today with R-1 on site, and flags Tuesday standard short by 1', () => {
    expect(o.today.date).toBe(SEED_DATE)
    expect(o.today.covered).toBe(true)
    expect(o.today.coverOnSite).toEqual(['R-1'])
    expect(o.nextBusinessDay.date).toBe('2026-09-29')
    expect(o.nextBusinessDay.covered).toBe(false)
    expect(o.nextBusinessDay.shortfalls.map((s) => [s.vehicleClass, s.shortfall])).toEqual([
      ['standard', 1],
    ])
    expect(o.nextBusinessDay.coverOnSite).toEqual(['R-1', 'R-2'])
  })
})

describe('a booking is reflected in tomorrow\'s coverage', () => {
  it('clears the Tuesday shortfall and lists the booking as cover on site', () => {
    const s = initialState(fixture)
    const weekId = activeWeekId(s)
    const decisions = draftFor({ fixture, state: s, weekId })
    const bookings = { 'V-027': { vehicleId: 'V-027', startDate: '2026-09-29', days: 1 } }
    const o = fleetOverview({
      fixture,
      today: s.demoDate,
      queueItems: queueFor({ fixture, state: s, weekId }).map((e) => e.item),
      decisions,
      blockers: validatePlan({ fixture, weekId, decisions, bookings }),
      committed: s.committedByWeek[weekId] ?? null,
      deferralHistory: s.deferralHistory,
      bookings,
    })
    expect(o.nextBusinessDay.covered).toBe(true)
    expect(o.nextBusinessDay.coverOnSite).toContain('V-027 replacement')
  })
})

describe('fleet overview after the walkthrough commit', () => {
  const o = overviewFor(committedState())

  it('clears every amber and flips the committed flag', () => {
    expect(o.counts).toEqual({ offRoad: 1, needsDecision: 0, inService: 44 })
    expect(o.committed).toBe(true)
  })

  it('labels booked and watching vans from the committed plan', () => {
    expect(vanOf(o, 'V-118').kind).toBe('in-service')
    expect(vanOf(o, 'V-118').facts).toEqual(['Booked Thu 1 Oct'])
    expect(vanOf(o, 'V-027').facts).toEqual(['Watching · review Mon 2 Nov'])
    expect(vanOf(o, 'V-041').facts).toEqual(['Watching · review Mon 5 Oct'])
  })

  it('keeps the held van red, now also carrying its booking', () => {
    expect(vanOf(o, 'V-012').facts).toEqual([
      'Held · Safety-relevant brake defect recorded at UVV inspection',
      'Booked Tue 29 Sep',
    ])
  })

  it('shows Tuesday clear after the move', () => {
    expect(o.nextBusinessDay.date).toBe('2026-09-29')
    expect(o.nextBusinessDay.covered).toBe(true)
  })
})

describe('fleet overview on the committed Tuesday', () => {
  const s = planReducer(committedState(), { type: 'advance-days', days: 1 }, fixture)
  const o = overviewFor(s)

  it('puts both visiting vans off the road, each exactly once', () => {
    expect(vanOf(o, 'V-012').facts).toEqual([
      'Held · Safety-relevant brake defect recorded at UVV inspection',
      'In workshop · day 1 of 1',
    ])
    expect(vanOf(o, 'V-103').kind).toBe('off-road')
    expect(vanOf(o, 'V-103').facts).toEqual(['In workshop · day 1 of 1'])
    expect(o.counts.offRoad).toBe(2)
    expect(o.onRoad).toBe(43)
  })

  it('still covers today, with both rentals on site', () => {
    expect(o.today.covered).toBe(true)
    expect(o.today.coverOnSite).toEqual(['R-1', 'R-2'])
  })
})

describe('fleet overview with a multi-day visit', () => {
  const twoDay: Fixture = {
    ...fixture,
    items: fixture.items.map((i) => (i.id === 'item-v103' ? { ...i, visitDays: 2 } : i)),
  }
  const s = planReducer(committedState(twoDay), { type: 'advance-days', days: 2 }, twoDay)
  const o = overviewFor(s, twoDay)

  it('counts every covered day with its position in the visit', () => {
    expect(vanOf(o, 'V-103').facts).toEqual(['In workshop · day 2 of 2'])
  })

  it('reproduces the Wednesday shortage, because R-2 does not cover Wednesday', () => {
    expect(o.today.covered).toBe(false)
    expect(o.today.shortfalls.map((s2) => [s2.vehicleClass, s2.shortfall])).toEqual([['standard', 1]])
  })
})

describe('fleet overview in week 41', () => {
  const s = planReducer(committedState(), { type: 'advance-to-next-review' }, fixture)

  it('lands on the review Monday with the resurfaced item amber', () => {
    expect(s.demoDate).toBe('2026-10-05')
    const o = overviewFor(s)
    expect(o.committed).toBe(false)
    expect(vanOf(o, 'V-041').kind).toBe('needs-decision')
    expect(vanOf(o, 'V-041').itemId).toBe('item-v041')
    expect(o.attention[0].vehicleId).toBe('V-041')
    expect(vanOf(o, 'V-012').kind).toBe('off-road')
  })

  it('leaves the held van red with no item, since week 41 queues none for it', () => {
    // The shape the attention card has to survive: red, real facts, nothing to
    // navigate to. Week 41 authors two new cases of its own now, but none for
    // V-012, and its week-40 item was committed, so only the hold is left.
    // [FO spec 4]
    const o = overviewFor(s)
    const v012 = vanOf(o, 'V-012')
    expect(v012.kind).toBe('off-road')
    expect(v012.itemId).toBeNull()
    expect(v012.facts).toEqual(['Held · Safety-relevant brake defect recorded at UVV inspection'])
    // Every amber van, by contrast, always has an item behind it.
    for (const s2 of o.attention) {
      if (s2.kind === 'needs-decision') expect(s2.itemId).not.toBeNull()
    }
  })

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

    // V-105, not V-024: V-024's parts aren't ready until Wednesday, so the
    // slot picker would disable Tuesday for it. V-105 carries no parts
    // requirement, so this is a day a real user could actually pick.
    const moved = planReducer(
      week41,
      {
        type: 'set-decision',
        weekId: '2026-10-05',
        decision: { itemId: 'item-v105', treatment: 'act-now', slotDate: '2026-10-06', deferral: null },
      },
      fixture,
    )
    const afterMove = planReducer(moved, { type: 'advance-days', days: 3 }, fixture)
    expect(overviewFor(afterMove).today.covered).toBe(true)
  })

  it('relocates rather than resolves the shortfall if moved to Monday instead', () => {
    // V-105 again: no parts requirement, so Monday is a reachable slot for it.
    const moved = planReducer(
      week41,
      {
        type: 'set-decision',
        weekId: '2026-10-05',
        decision: { itemId: 'item-v105', treatment: 'act-now', slotDate: '2026-10-05', deferral: null },
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
  // V-027 held for a reason with nothing to do with its item (unlike V-012,
  // whose only fixture hold belongs to a safety-class item that can never
  // reach deferralHistory). Committing week 40 lets item-v027 keep its own
  // default watch proposal, landing a DeferralRecord in the ledger; jumping
  // straight to that item's own review date resurfaces it into the queue,
  // undecided, while the first commit's record still sits in deferralHistory.
  const heldV027: Fixture = {
    ...fixture,
    vehicles: fixture.vehicles.map((v) =>
      v.id === 'V-027'
        ? {
            ...v,
            hold: {
              reason: 'Collision damage from a yard reversing incident',
              since: SEED_DATE,
              releaseRecordedOn: null,
            },
          }
        : v,
    ),
  }
  const resurfaced = planReducer(
    committedState(heldV027),
    { type: 'advance-days', days: daysBetween(SEED_DATE, '2026-11-02') },
    heldV027,
  )
  const o = overviewFor(resurfaced, heldV027)

  it('stays red for the hold alone, with no stale Watching fact for the resurfaced item', () => {
    const v027 = vanOf(o, 'V-027')
    expect(v027.kind).toBe('off-road')
    expect(v027.itemId).toBe('item-v027')
    expect(v027.facts).toEqual(['Held · Collision damage from a yard reversing incident'])
  })
})

describe("fleet overview reads today from the draft, exactly as the band does", () => {
  // Week 41, committed to nothing: the resurfaced specialist item is scheduled
  // onto today and left in draft. The capacity band already counts that van
  // out, and blocks Commit over the gap; the fleet header must name the same
  // gap rather than read committed-only and call the day covered. [FO spec 4, 7]
  const WEEK_41 = '2026-10-05'
  const week41 = planReducer(committedState(), { type: 'advance-to-next-review' }, fixture)
  const scheduled = planReducer(
    week41,
    {
      type: 'set-decision',
      weekId: WEEK_41,
      decision: { itemId: 'item-v041', treatment: 'act-now', slotDate: WEEK_41, deferral: null },
    },
    fixture,
  )

  it('is covered before the draft edit, on the identical committed state', () => {
    const before = overviewFor(week41)
    expect(before.today.date).toBe(WEEK_41)
    expect(before.committed).toBe(false)
    expect(before.today.covered).toBe(true)
  })

  it('flags the shortfall the still-uncommitted draft creates on today', () => {
    const after = overviewFor(scheduled)
    // Nothing is committed for week 41, so a committed-only reading would call
    // this day covered. The only thing that changed is the draft.
    expect(after.committed).toBe(false)
    expect(after.today.date).toBe(WEEK_41)
    expect(after.today.covered).toBe(false)
    expect(after.today.shortfalls.map((s) => [s.vehicleClass, s.shortfall])).toEqual([
      ['specialist', 1],
    ])
  })
})

describe('fleet overview: decisions still waiting', () => {
  it('counts undecided queue items, not attention cards', () => {
    const cold = overviewFor(initialState(fixture))
    // Five queue items are undecided, and V-012 is one of them even though its
    // van is red for the hold. The amber count alone would read 4.
    expect(cold.awaitingDecision).toBe(5)
    expect(cold.attention.length).toBe(5)
    expect(cold.counts.needsDecision).toBe(4)
  })

  it('drops to zero once every item carries a committed disposition', () => {
    const after = overviewFor(committedState())
    expect(after.awaitingDecision).toBe(0)
    // The held van is still an attention card, with nothing left to decide.
    expect(after.attention.map((s) => s.vehicleId)).toEqual(['V-012'])
  })
})

describe('next business day', () => {
  it('is tomorrow inside the week and Monday from Friday', () => {
    expect(nextBusinessDay(fixture, '2026-09-28')).toBe('2026-09-29')
    expect(nextBusinessDay(fixture, '2026-10-02')).toBe('2026-10-05')
  })

  it('previews week 41 from Friday: covered, with R-1 only', () => {
    const s = planReducer(initialState(fixture), { type: 'advance-days', days: 4 }, fixture)
    const o = overviewFor(s)
    expect(o.nextBusinessDay.date).toBe('2026-10-05')
    expect(o.nextBusinessDay.covered).toBe(true)
    expect(o.nextBusinessDay.coverOnSite).toEqual(['R-1'])
  })
})
