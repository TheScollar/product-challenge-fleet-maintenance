import { describe, expect, it } from 'vitest'
import { deferralErrors, isDeferralComplete, resurfacedItems, resurfacing, triggerFired } from './deferral'
import { fixture } from './fixture'
import type { DeferralRecord, ItemId, Trigger } from './types'

const v041Record: DeferralRecord = {
  itemId: 'item-v041',
  weekId: '2026-09-28',
  decidedOn: '2026-09-28',
  deferral: {
    reason: 'No specialist cover exists this week and the code has not recurred since 17 Sep.',
    reviewDate: '2026-10-05',
    trigger: { kind: 'event', eventId: 'v041-dtc-recurs', label: 'DTC P0300 recurs' },
  },
}

describe('all three fields are required', () => {
  it('rejects an empty deferral', () => {
    expect(deferralErrors(null)).toContain('Rationale is required')
    expect(deferralErrors(null).length).toBe(3)
  })

  it('rejects whitespace-only rationale', () => {
    const errors = deferralErrors({ reason: '   ', reviewDate: '2026-10-05', trigger: v041Record.deferral.trigger })
    expect(errors).toEqual(['Rationale is required'])
  })

  it('names each missing field separately', () => {
    expect(deferralErrors({ reason: 'ok' })).toEqual(['Review date is required', 'Trigger is required'])
  })

  it('accepts a complete deferral', () => {
    expect(deferralErrors(v041Record.deferral)).toEqual([])
    expect(isDeferralComplete(v041Record.deferral)).toBe(true)
  })
})

describe('triggers fire by advancing the clock, with no cheat button', () => {
  const odometer: Trigger = {
    kind: 'odometer',
    vehicleId: 'V-118',
    thresholdKm: 49_500,
    label: 'Odometer passes 49,500 km',
  }

  it('fires an odometer trigger when the projection crosses the threshold', () => {
    expect(triggerFired(odometer, fixture, '2026-10-08')).toBe(false)
    expect(triggerFired(odometer, fixture, '2026-10-09')).toBe(true)
  })

  it('fires an event trigger on the date the fixture schedules', () => {
    const t = v041Record.deferral.trigger
    expect(triggerFired(t, fixture, '2026-10-06')).toBe(false)
    expect(triggerFired(t, fixture, '2026-10-07')).toBe(true)
  })

  it('never fires the V-027 trigger, because the fixture never schedules it', () => {
    const t: Trigger = { kind: 'event', eventId: 'v027-wipe-degrades', label: 'Wipe quality degrades' }
    expect(triggerFired(t, fixture, '2027-12-31')).toBe(false)
  })
})

describe('resurfacing', () => {
  it('stays down before the review date', () => {
    expect(resurfacing(v041Record, fixture, '2026-10-02').resurfaced).toBe(false)
  })

  it('comes back when the review date arrives, and says why', () => {
    const r = resurfacing(v041Record, fixture, '2026-10-05')
    expect(r.resurfaced).toBe(true)
    expect(r.because).toContain('Review date')
  })

  it('comes back early if the trigger fires first', () => {
    const early: DeferralRecord = {
      ...v041Record,
      deferral: { ...v041Record.deferral, reviewDate: '2026-11-30' },
    }
    const r = resurfacing(early, fixture, '2026-10-07')
    expect(r.resurfaced).toBe(true)
    expect(r.because).toContain('Trigger fired')
  })

  it('returns the item with its prior decision intact', () => {
    const history: Record<ItemId, DeferralRecord[]> = { 'item-v041': [v041Record] }
    const out = resurfacedItems({ fixture, history, demoDate: '2026-10-05' })
    expect(out).toHaveLength(1)
    expect(out[0].item.id).toBe('item-v041')
    expect(out[0].record.deferral.reason).toContain('No specialist cover')
    expect(out[0].record.decidedOn).toBe('2026-09-28')
  })

  it('uses the most recent record when an item has been deferred more than once', () => {
    const older: DeferralRecord = { ...v041Record, decidedOn: '2026-09-21', deferral: { ...v041Record.deferral, reason: 'older' } }
    const history: Record<ItemId, DeferralRecord[]> = { 'item-v041': [older, v041Record] }
    const out = resurfacedItems({ fixture, history, demoDate: '2026-10-05' })
    expect(out[0].record.deferral.reason).toContain('No specialist cover')
  })

  it('keeps V-027 down, since neither its date nor its trigger has arrived', () => {
    const history: Record<ItemId, DeferralRecord[]> = {
      'item-v027': [
        {
          itemId: 'item-v027',
          weekId: '2026-09-28',
          decidedOn: '2026-09-28',
          deferral: fixture.items.find((i) => i.id === 'item-v027')!.proposal.deferral!,
        },
      ],
    }
    expect(resurfacedItems({ fixture, history, demoDate: '2026-10-19' })).toHaveLength(0)
  })
})
