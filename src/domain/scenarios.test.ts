import { describe, expect, it } from 'vitest'
import { computeDayCapacity, unavailableOn, weekFixtureFor } from './capacity'
import { summaryFor } from './commit'
import { fixture } from './fixture'
import { slotBlockers } from './feasibility'
import { watchAvailable } from './recommendation'
import { canCommit, validatePlan } from './validation'
import { adHocCoversFrom } from './replacementBooking'
import { visitsFromDecisions } from './visits'
import { bookingsFor, initialState, planReducer, queueFor, draftFor, type AppState } from '../state/planReducer'
import { adoptedState, item, vehicle } from './testSupport'

const WEEK_40 = '2026-09-28'
const reduce = (s: AppState, a: Parameters<typeof planReducer>[1]) => planReducer(s, a, fixture)
const draftOf = (s: AppState) => draftFor({ fixture, state: s, weekId: WEEK_40 })
const validate = (s: AppState) =>
  validatePlan({ fixture, weekId: WEEK_40, decisions: draftOf(s), bookings: bookingsFor({ state: s, weekId: WEEK_40 }) })
const coversOf = (s: AppState) =>
  adHocCoversFrom(bookingsFor({ state: s, weekId: WEEK_40 }), fixture.replacementDayRateEur)

const V041_DEFERRAL = {
  reason: 'No specialist cover exists this week, and the code has not recurred since 17 Sep.',
  reviewDate: '2026-10-05',
  trigger: { kind: 'event' as const, eventId: 'v041-dtc-recurs', label: 'DTC P0300 recurs' },
}

/** The adopted proposals plus the two requested replacements of the
 *  walkthrough: V-012 Monday for five days, V-103 Tuesday for one. [no pool cover spec §3.1] */
function bookedState(): AppState {
  let s = adoptedState()
  s = reduce(s, { type: 'set-booking', weekId: WEEK_40, booking: { vehicleId: 'V-012', startDate: '2026-09-28', days: 5 } })
  return reduce(s, { type: 'set-booking', weekId: WEEK_40, booking: { vehicleId: 'V-103', startDate: '2026-09-29', days: 1 } })
}

function resolvedState(): AppState {
  let s = bookedState()
  s = reduce(s, {
    type: 'set-decision',
    weekId: WEEK_40,
    decision: { itemId: 'item-v118', treatment: 'act-now', slotDate: '2026-10-01', deferral: null },
  })
  return reduce(s, {
    type: 'set-decision',
    weekId: WEEK_40,
    decision: { itemId: 'item-v041', treatment: 'watch', slotDate: null, deferral: V041_DEFERRAL },
  })
}

describe('1. Known safety-class issue at cold open', () => {
  it('holds V-012 before anything is committed, with no interruption UI involved', () => {
    const s = initialState(fixture)
    expect(s.committedByWeek[WEEK_40] ?? null).toBeNull()
    expect(unavailableOn('2026-09-28', fixture.vehicles, []).has('V-012')).toBe(true)
  })

  it('withholds watch, and a booked visit does not release the hold', () => {
    expect(watchAvailable(item('item-v012'), vehicle('V-012'))).toBe(false)
    const visits = visitsFromDecisions(draftOf(adoptedState()), fixture.items)
    expect(unavailableOn('2026-09-30', fixture.vehicles, visits).has('V-012')).toBe(true)
  })
})

describe('2. Justified routine deferral', () => {
  it('records reason, review date and trigger for V-027 without forcing service', () => {
    const d = draftOf(adoptedState())['item-v027']
    expect(d.treatment).toBe('watch')
    expect(d.deferral!.reason.length).toBeGreaterThan(10)
    expect(d.deferral!.reviewDate).toBe('2026-11-02')
    expect(d.deferral!.trigger).toBeDefined()
    expect(d.slotDate).toBeNull()
  })

  it('is never overturned by the fixture', () => {
    const s = reduce(resolvedState(), { type: 'commit', weekId: WEEK_40 })
    const far = reduce(s, { type: 'advance-days', days: 21 })
    expect(queueFor({ fixture, state: far, weekId: '2026-10-19' }).some((q) => q.item.id === 'item-v027')).toBe(false)
  })
})

describe('3. Tight day with a feasible alternative', () => {
  it('clears the shortfall and enables commit when V-118 moves to Thursday', () => {
    const before = validate(bookedState())
    expect(before.filter((b) => b.kind === 'capacity-shortfall')).toEqual([
      expect.objectContaining({ date: '2026-09-29', vehicleClass: 'standard', shortBy: 1 }),
    ])
    const after = validate(resolvedState())
    expect(after).toEqual([])
    expect(canCommit(after)).toBe(true)
  })
})

describe('4. Aggregate capacity hides a specialist gap', () => {
  it('flags a specialist shortfall that standard cover cannot erase', () => {
    const s = reduce(resolvedState(), {
      type: 'set-decision',
      weekId: WEEK_40,
      decision: { itemId: 'item-v041', treatment: 'act-now', slotDate: '2026-10-01', deferral: null },
    })
    const blockers = validate(s)
    expect(blockers).toEqual([
      expect.objectContaining({ kind: 'capacity-shortfall', date: '2026-10-01', vehicleClass: 'specialist', shortBy: 1 }),
    ])

    // The aggregate reads one van short of 44, which a glance forgives. Per
    // class is what shows the real problem: standard is fully covered, and
    // the specialist gap has no cover at all to close it. The aggregate
    // neither names the van nor shows that nothing available can fill it.
    const week = weekFixtureFor(fixture, WEEK_40)
    const visits = visitsFromDecisions(draftOf(s), fixture.items)
    const adHocCovers = coversOf(s)
    const std = computeDayCapacity({ date: '2026-10-01', vehicleClass: 'standard', fixture, visits, week, adHocCovers })
    const sp = computeDayCapacity({ date: '2026-10-01', vehicleClass: 'specialist', fixture, visits, week, adHocCovers })
    expect(std.shortfall).toBe(0)
    expect(std.available).toBe(std.demand)
    expect(sp.shortfall).toBe(1)
    expect(sp.cover).toBe(0)
    expect(std.available + sp.available).toBe(std.demand + sp.demand - 1)
  })
})

describe('5. Multi-day visit overlaps an existing hold', () => {
  it('counts every affected day, each vehicle once, without implying a release', () => {
    const items = fixture.items.map((i) => (i.id === 'item-v103' ? { ...i, visitDays: 2 } : i))
    const s = resolvedState()
    const visits = visitsFromDecisions(draftOf(s), items)
    const week = weekFixtureFor(fixture, WEEK_40)
    const day = (date: string, adHocCovers = coversOf(s)) =>
      computeDayCapacity({ date, vehicleClass: 'standard', fixture, visits, week, adHocCovers })
    // Tuesday: V-012 held and visiting counts once; V-103 is covered that day.
    expect(day('2026-09-29').unavailable.sort()).toEqual(['V-012', 'V-103'])
    expect(day('2026-09-29').shortfall).toBe(0)
    // Wednesday: the second day has no V-103 replacement, so only V-012's is on site.
    expect(day('2026-09-30').unavailable.sort()).toEqual(['V-012', 'V-103'])
    expect(day('2026-09-30').shortfall).toBe(1)
    expect(day('2026-09-30', []).shortfall).toBe(2)
    expect(unavailableOn('2026-09-30', fixture.vehicles, visits).has('V-012')).toBe(true)
  })
})

describe('6. Slot or part unavailable', () => {
  it('refuses Monday for V-012 and names both reasons', () => {
    const blockers = slotBlockers({ item: item('item-v012'), date: '2026-09-28', fixture, visits: [] })
    expect(blockers.map((b) => b.kind).sort()).toEqual(['infeasible-slot', 'parts-not-ready'])
  })

  it('keeps the plan uncommittable while an infeasible slot is chosen', () => {
    const s = reduce(resolvedState(), {
      type: 'set-decision',
      weekId: WEEK_40,
      decision: { itemId: 'item-v118', treatment: 'act-now', slotDate: '2026-09-28', deferral: null },
    })
    expect(canCommit(validate(s))).toBe(false)
  })
})

describe('7. Evidence insufficient', () => {
  it('shows assessment-needed rather than an invented waiting period', () => {
    expect(item('item-v041').urgency.kind).toBe('assessment-needed')
    expect(item('item-v041').urgency.relevantDate).toBeNull()
    expect(item('item-v041').assumption).toBeNull()
  })
})

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

describe('9. No feasible plan exists', () => {
  it('keeps the draft recoverable, shows the shortage, and claims no readiness', () => {
    const s = reduce(resolvedState(), {
      type: 'set-decision',
      weekId: WEEK_40,
      decision: { itemId: 'item-v041', treatment: 'act-now', slotDate: '2026-09-30', deferral: null },
    })
    const blockers = validate(s)
    expect(canCommit(blockers)).toBe(false)
    expect(blockers.some((b) => b.kind === 'capacity-shortfall')).toBe(true)
    // The draft survives the failed state.
    expect(draftOf(s)['item-v041'].slotDate).toBe('2026-09-30')
    expect(draftOf(s)['item-v118'].slotDate).toBe('2026-10-01')
  })
})

describe('10. Commit, edit, recommit, reload, reset', () => {
  it('matches the summary to the committed decisions', () => {
    const s = reduce(resolvedState(), { type: 'commit', weekId: WEEK_40 })
    const summary = summaryFor({ fixture, plan: s.committedByWeek[WEEK_40]! })
    expect(summary.visits.map((v) => v.itemId).sort()).toEqual(['item-v012', 'item-v103', 'item-v118'])
    expect(summary.deferrals.map((d) => d.itemId).sort()).toEqual(['item-v027', 'item-v041'])
  })

  it('produces no duplicates on recommit', () => {
    let s = reduce(resolvedState(), { type: 'commit', weekId: WEEK_40 })
    s = reduce(s, { type: 'commit', weekId: WEEK_40 })
    s = reduce(s, { type: 'commit', weekId: WEEK_40 })
    const summary = summaryFor({ fixture, plan: s.committedByWeek[WEEK_40]! })
    expect(summary.visits).toHaveLength(3)
    expect(s.deferralHistory['item-v041']).toHaveLength(1)
  })

  it('leaves the snapshot intact while the draft is edited, until recommit', () => {
    const committed = reduce(resolvedState(), { type: 'commit', weekId: WEEK_40 })
    const edited = reduce(committed, {
      type: 'set-decision',
      weekId: WEEK_40,
      decision: { itemId: 'item-v118', treatment: 'act-now', slotDate: '2026-09-30', deferral: null },
    })
    expect(edited.committedByWeek[WEEK_40]!.decisions['item-v118'].slotDate).toBe('2026-10-01')
    const recommitted = reduce(edited, { type: 'commit', weekId: WEEK_40 })
    expect(recommitted.committedByWeek[WEEK_40]!.decisions['item-v118'].slotDate).toBe('2026-09-30')
  })

  it('survives a serialisation round trip, which is what reload does', () => {
    const s = reduce(resolvedState(), { type: 'commit', weekId: WEEK_40 })
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
  })

  it('restores the seed on reset', () => {
    const s = reduce(resolvedState(), { type: 'commit', weekId: WEEK_40 })
    expect(reduce(s, { type: 'reset' })).toEqual(initialState(fixture))
  })
})
