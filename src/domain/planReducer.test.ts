import { describe, expect, it } from 'vitest'
import { fixture } from './fixture'
import { deferralRecordsFrom, summaryFor } from './commit'
import { nextResurfaceDate } from './deferral'
import { activeWeekId, draftFor, initialState, planReducer, queueFor } from '../state/planReducer'
import type { AppState } from '../state/planReducer'
import type { Deferral } from './types'

const reduce = (s: AppState, a: Parameters<typeof planReducer>[1]) => planReducer(s, a, fixture)

function committedWeek40(): AppState {
  let s = initialState(fixture)
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

  it('seeds the draft from the system proposals, undisposed items included', () => {
    const draft = draftFor({ fixture, state: s, weekId: '2026-09-28' })
    expect(Object.keys(draft)).toHaveLength(5)
    expect(draft['item-v118'].slotDate).toBe('2026-09-29')
    expect(draft['item-v041'].slotDate).toBeNull()
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
    expect(queue.map((q) => q.item.id)).toEqual(['item-v041'])
    expect(queue[0].resurfacedBecause).toContain('Review date')
    expect(queue[0].priorDecision!.deferral.reason).toContain('No specialist cover')
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
