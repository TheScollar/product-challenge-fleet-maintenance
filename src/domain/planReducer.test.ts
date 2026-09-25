import { describe, expect, it } from 'vitest'
import { fixture } from './fixture'
import { deferralRecordsFrom, summaryFor } from './commit'
import { nextResurfaceDate } from './deferral'
import {
  activeWeekId,
  bookingsFor,
  draftFor,
  initialState,
  planReducer,
  queueFor,
} from '../state/planReducer'
import type { AppState } from '../state/planReducer'
import { adoptedState } from './testSupport'
import type { Deferral } from './types'

const reduce = (s: AppState, a: Parameters<typeof planReducer>[1]) => planReducer(s, a, fixture)

function committedWeek40(): AppState {
  let s = adoptedState()
  s = reduce(s, {
    type: 'set-decision',
    weekId: '2026-09-28',
    decision: { itemId: 'item-v118', treatment: 'act-now', slotDate: '2026-10-01', deferral: null },
  })
  s = reduce(s, {
    type: 'set-decision',
    weekId: '2026-09-28',
    decision: {
      itemId: 'item-v041',
      treatment: 'watch',
      slotDate: null,
      deferral: {
        reason: 'No specialist cover this week.',
        reviewDate: '2026-10-05',
        trigger: { kind: 'event', eventId: 'v041-dtc-recurs', label: 'DTC P0300 recurs' },
      },
    },
  })
  return reduce(s, { type: 'commit', weekId: '2026-09-28' })
}

describe('initial state', () => {
  const s = initialState(fixture)

  it('opens on the seeded Monday with nothing committed', () => {
    expect(s.demoDate).toBe('2026-09-28')
    expect(activeWeekId(s)).toBe('2026-09-28')
    expect(s.committedByWeek['2026-09-28'] ?? null).toBeNull()
  })

  it('seeds every item open, with the proposal left on the item', () => {
    const draft = draftFor({ fixture, state: s, weekId: '2026-09-28' })
    expect(Object.keys(draft).sort()).toEqual(['item-v012', 'item-v027', 'item-v041', 'item-v103', 'item-v118'])
    for (const d of Object.values(draft)) {
      expect(d).toEqual({ itemId: d.itemId, treatment: null, slotDate: null, deferral: null })
    }
    expect(fixture.items.find((i) => i.id === 'item-v118')!.proposal.slotDate).toBe('2026-09-29')
  })

  it('shows all five items in the week 40 queue', () => {
    expect(queueFor({ fixture, state: s, weekId: '2026-09-28' })).toHaveLength(5)
  })
})

describe('editing the draft', () => {
  it('records a decision without touching the proposal', () => {
    const s = reduce(initialState(fixture), {
      type: 'set-decision',
      weekId: '2026-09-28',
      decision: { itemId: 'item-v118', treatment: 'act-now', slotDate: '2026-10-01', deferral: null },
    })
    expect(draftFor({ fixture, state: s, weekId: '2026-09-28' })['item-v118'].slotDate).toBe('2026-10-01')
    expect(fixture.items.find((i) => i.id === 'item-v118')!.proposal.slotDate).toBe('2026-09-29')
  })
})

describe('committing', () => {
  const s = committedWeek40()

  it('stores a snapshot and the deferral history', () => {
    expect(s.committedByWeek['2026-09-28']!.decisions['item-v118'].slotDate).toBe('2026-10-01')
    expect(Object.keys(s.deferralHistory).sort()).toEqual(['item-v027', 'item-v041'])
  })

  it('leaves the snapshot intact when the draft is edited afterwards', () => {
    const edited = reduce(s, {
      type: 'set-decision',
      weekId: '2026-09-28',
      decision: { itemId: 'item-v118', treatment: 'act-now', slotDate: '2026-09-30', deferral: null },
    })
    expect(edited.committedByWeek['2026-09-28']!.decisions['item-v118'].slotDate).toBe('2026-10-01')
    expect(draftFor({ fixture, state: edited, weekId: '2026-09-28' })['item-v118'].slotDate).toBe('2026-09-30')
  })

  it('does not accumulate duplicate deferral records on recommit', () => {
    const again = reduce(s, { type: 'commit', weekId: '2026-09-28' })
    expect(again.deferralHistory['item-v041']).toHaveLength(1)
  })
})

describe('advancing the clock', () => {
  it('moves the active week when it crosses into the next one', () => {
    const s = reduce(committedWeek40(), { type: 'advance-days', days: 7 })
    expect(s.demoDate).toBe('2026-10-05')
    expect(activeWeekId(s)).toBe('2026-10-05')
  })

  it('finds the next resurface date', () => {
    const s = committedWeek40()
    expect(nextResurfaceDate({ fixture, history: s.deferralHistory, after: '2026-09-28' })).toBe('2026-10-05')
  })

  it('jumps straight to it', () => {
    const s = reduce(committedWeek40(), { type: 'advance-to-next-review' })
    expect(s.demoDate).toBe('2026-10-05')
  })

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

  it('leaves V-027 down, since neither its date nor its trigger has arrived', () => {
    const s = reduce(committedWeek40(), { type: 'advance-to-next-review' })
    expect(queueFor({ fixture, state: s, weekId: '2026-10-05' }).some((q) => q.item.id === 'item-v027')).toBe(false)
  })
})

describe('resolving a resurfaced item', () => {
  it('stops resurfacing an item once it is decided some other way', () => {
    let s = reduce(committedWeek40(), { type: 'advance-to-next-review' })
    expect(s.demoDate).toBe('2026-10-05')

    s = reduce(s, {
      type: 'set-decision',
      weekId: '2026-10-05',
      decision: { itemId: 'item-v041', treatment: 'act-now', slotDate: '2026-10-06', deferral: null },
    })
    s = reduce(s, { type: 'commit', weekId: '2026-10-05' })

    const later = reduce(s, { type: 'advance-days', days: 7 })
    expect(queueFor({ fixture, state: later, weekId: '2026-10-12' }).some((q) => q.item.id === 'item-v041')).toBe(
      false,
    )
    expect(later.deferralHistory['item-v041'] ?? []).toHaveLength(0)
  })

  it('keeps the history of an item it has not decided yet', () => {
    const advanced = reduce(committedWeek40(), { type: 'advance-to-next-review' })
    expect(advanced.demoDate).toBe('2026-10-05')

    const s = reduce(advanced, { type: 'commit', weekId: '2026-10-05' })

    expect(s.deferralHistory['item-v041']).toHaveLength(1)
    expect(s.deferralHistory['item-v041'][0].deferral.reason).toContain('No specialist cover')
    expect(queueFor({ fixture, state: s, weekId: '2026-10-05' }).map((q) => q.item.id)).toContain('item-v041')
  })
})

describe('a deferral exists only while the treatment is watch', () => {
  const v118Deferral: Deferral = {
    reason: 'The interval is still 2,180 km away on the stated rate.',
    reviewDate: '2026-10-09',
    trigger: {
      kind: 'odometer',
      vehicleId: 'V-118',
      thresholdKm: 49_500,
      label: 'Odometer passes 49,500 km',
    },
  }

  it('stores no deferral when the treatment is not watch', () => {
    const s = reduce(initialState(fixture), {
      type: 'set-decision',
      weekId: '2026-09-28',
      decision: {
        itemId: 'item-v118',
        treatment: 'act-now',
        slotDate: '2026-10-01',
        deferral: v118Deferral,
      },
    })
    expect(draftFor({ fixture, state: s, weekId: '2026-09-28' })['item-v118'].deferral).toBeNull()
  })

  it('books the visit and leaves no follow-up behind when watch is applied and then reversed', () => {
    let s = initialState(fixture)
    // Watch, with a complete deferral applied.
    s = reduce(s, {
      type: 'set-decision',
      weekId: '2026-09-28',
      decision: { itemId: 'item-v118', treatment: 'watch', slotDate: null, deferral: v118Deferral },
    })
    expect(draftFor({ fixture, state: s, weekId: '2026-09-28' })['item-v118'].deferral).not.toBeNull()

    // Act now with a slot, dispatched in the shape that carried the stale
    // deferral through, which is what put the van in both lists at once.
    s = reduce(s, {
      type: 'set-decision',
      weekId: '2026-09-28',
      decision: {
        itemId: 'item-v118',
        treatment: 'act-now',
        slotDate: '2026-10-01',
        deferral: v118Deferral,
      },
    })
    s = reduce(s, { type: 'commit', weekId: '2026-09-28' })

    const plan = s.committedByWeek['2026-09-28']!
    const summary = summaryFor({ fixture, plan })
    expect(summary.visits.map((v) => v.itemId)).toContain('item-v118')
    expect(summary.deferrals.map((d) => d.itemId)).not.toContain('item-v118')
    expect(deferralRecordsFrom(plan).map((r) => r.itemId)).not.toContain('item-v118')
    expect(s.deferralHistory['item-v118'] ?? []).toHaveLength(0)
  })

  it('does not resurface a van the same plan serviced', () => {
    let s = initialState(fixture)
    s = reduce(s, {
      type: 'set-decision',
      weekId: '2026-09-28',
      decision: { itemId: 'item-v118', treatment: 'watch', slotDate: null, deferral: v118Deferral },
    })
    s = reduce(s, {
      type: 'set-decision',
      weekId: '2026-09-28',
      decision: {
        itemId: 'item-v118',
        treatment: 'act-now',
        slotDate: '2026-10-01',
        deferral: v118Deferral,
      },
    })
    s = reduce(s, { type: 'commit', weekId: '2026-09-28' })
    const later = reduce(s, { type: 'advance-days', days: 14 })
    expect(
      queueFor({ fixture, state: later, weekId: '2026-10-12' }).some((q) => q.item.id === 'item-v118'),
    ).toBe(false)
  })
})

describe('reset', () => {
  it('restores the seed and the demo date', () => {
    const s = reduce(committedWeek40(), { type: 'reset' })
    expect(s).toEqual(initialState(fixture))
  })
})

describe('booking a replacement', () => {
  const v118 = { vehicleId: 'V-118', startDate: '2026-09-29', days: 1 }

  it('records a draft booking for a visiting vehicle, scoped to its own week', () => {
    const s = reduce(adoptedState(), { type: 'set-booking', weekId: '2026-09-28', booking: v118 })
    expect(bookingsFor({ state: s, weekId: '2026-09-28' })).toEqual({ 'V-118': v118 })
    expect(bookingsFor({ state: s, weekId: '2026-10-05' })).toEqual({})
  })

  it('ignores a booking for a vehicle whose draft has no visit', () => {
    const s = reduce(adoptedState(), {
      type: 'set-booking',
      weekId: '2026-09-28',
      booking: { vehicleId: 'V-027', startDate: '2026-09-29', days: 1 },
    })
    expect(bookingsFor({ state: s, weekId: '2026-09-28' })).toEqual({})
    expect(s).toEqual(adoptedState())
  })

  it('replaces a prior draft booking for the same vehicle rather than accumulating', () => {
    let s = reduce(adoptedState(), { type: 'set-booking', weekId: '2026-09-28', booking: v118 })
    s = reduce(s, {
      type: 'set-booking',
      weekId: '2026-09-28',
      booking: { vehicleId: 'V-118', startDate: '2026-09-30', days: 3 },
    })
    expect(bookingsFor({ state: s, weekId: '2026-09-28' })).toEqual({
      'V-118': { vehicleId: 'V-118', startDate: '2026-09-30', days: 3 },
    })
  })

  it('clears a booking', () => {
    let s = reduce(adoptedState(), { type: 'set-booking', weekId: '2026-09-28', booking: v118 })
    s = reduce(s, { type: 'clear-booking', weekId: '2026-09-28', vehicleId: 'V-118' })
    expect(bookingsFor({ state: s, weekId: '2026-09-28' })).toEqual({})
  })

  it('drops the booking when the item is switched to watch', () => {
    let s = reduce(adoptedState(), { type: 'set-booking', weekId: '2026-09-28', booking: v118 })
    s = reduce(s, {
      type: 'set-decision',
      weekId: '2026-09-28',
      decision: {
        itemId: 'item-v118',
        treatment: 'watch',
        slotDate: null,
        deferral: {
          reason: 'The interval is still 2,180 km away on the stated rate.',
          reviewDate: '2026-10-09',
          trigger: { kind: 'odometer', vehicleId: 'V-118', thresholdKm: 49_500, label: 'Odometer passes 49,500 km' },
        },
      },
    })
    expect(bookingsFor({ state: s, weekId: '2026-09-28' })).toEqual({})
  })

  it('drops the booking when the treatment is cleared', () => {
    let s = reduce(adoptedState(), { type: 'set-booking', weekId: '2026-09-28', booking: v118 })
    s = reduce(s, {
      type: 'set-decision',
      weekId: '2026-09-28',
      decision: { itemId: 'item-v118', treatment: null, slotDate: null, deferral: null },
    })
    expect(bookingsFor({ state: s, weekId: '2026-09-28' })).toEqual({})
  })

  it('keeps the booking as the user set it when the visit merely moves day', () => {
    let s = reduce(adoptedState(), { type: 'set-booking', weekId: '2026-09-28', booking: v118 })
    s = reduce(s, {
      type: 'set-decision',
      weekId: '2026-09-28',
      decision: { itemId: 'item-v118', treatment: 'act-now', slotDate: '2026-10-01', deferral: null },
    })
    expect(bookingsFor({ state: s, weekId: '2026-09-28' })).toEqual({ 'V-118': v118 })
  })

  it('snapshots the booking on commit and survives a later draft edit', () => {
    let s = reduce(adoptedState(), { type: 'set-booking', weekId: '2026-09-28', booking: v118 })
    s = reduce(s, { type: 'commit', weekId: '2026-09-28' })
    expect(s.committedByWeek['2026-09-28']!.bookings['V-118']).toEqual(v118)

    s = reduce(s, {
      type: 'set-booking',
      weekId: '2026-09-28',
      booking: { vehicleId: 'V-118', startDate: '2026-09-30', days: 2 },
    })
    expect(s.committedByWeek['2026-09-28']!.bookings['V-118'].startDate).toBe('2026-09-29')
  })

  it('clears every booking on reset', () => {
    let s = reduce(adoptedState(), { type: 'set-booking', weekId: '2026-09-28', booking: v118 })
    s = reduce(s, { type: 'reset' })
    expect(s).toEqual(initialState(fixture))
  })
})
