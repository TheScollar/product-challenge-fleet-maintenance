import { describe, expect, it } from 'vitest'
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
    weekId,
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

  it('releases the held van once the recorded release date passes', () => {
    const later = overviewFor(planReducer(s, { type: 'advance-days', days: 1 }, fixture))
    expect(vanOf(later, 'V-012').kind).toBe('in-service')
    expect(vanOf(later, 'V-012').facts).toEqual([])
    expect(vanOf(later, 'V-027').facts).toEqual(['Watching · review Mon 2 Nov'])
    expect(later.counts).toEqual({ offRoad: 0, needsDecision: 1, inService: 44 })
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
