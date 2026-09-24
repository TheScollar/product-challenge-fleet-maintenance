import { describe, expect, it } from 'vitest'
import { fixture } from './fixture'
import { blockersForItem, canCommit, describeBlocker, validatePlan } from './validation'
import { coldOpenDecisions as coldOpen, item } from './testSupport'
import type { Blocker, DraftDecision, ItemId } from './types'

const WEEK_40 = '2026-09-28'

const validate = (decisions: Record<ItemId, DraftDecision>) =>
  validatePlan({ fixture, weekId: WEEK_40, decisions })

describe('cold open carries exactly two blockers', () => {
  const blockers = validate(coldOpen())

  it('reports the Tuesday shortfall and the undisposed decision, and nothing else', () => {
    expect(blockers.map((b) => b.kind).sort()).toEqual(['capacity-shortfall', 'undisposed-item'])
  })

  it('names the day, the class and the contributors on the shortfall', () => {
    const shortfall = blockers.find((b) => b.kind === 'capacity-shortfall') as {
      date: string
      vehicleClass: string
      shortBy: number
      contributors: string[]
    }
    expect(shortfall.date).toBe('2026-09-29')
    expect(shortfall.vehicleClass).toBe('standard')
    expect(shortfall.shortBy).toBe(1)
    expect(shortfall.contributors.sort()).toEqual(['V-012', 'V-103', 'V-118'])
  })

  it('does not let the plan commit', () => {
    expect(canCommit(blockers)).toBe(false)
  })

  it('never treats the held vehicle as a blocker on its own', () => {
    expect(blockers.some((b) => b.kind === 'undisposed-item' && b.itemId === 'item-v012')).toBe(false)
  })
})

describe('a requested booking clears a capacity blocker', () => {
  it('removes the Tuesday shortfall once a standard booking covers it', () => {
    const bookings = { 'V-027': { vehicleId: 'V-027', startDate: '2026-09-29', days: 1 } }
    const blockers = validatePlan({ fixture, weekId: WEEK_40, decisions: coldOpen(), bookings })
    expect(blockers.some((b) => b.kind === 'capacity-shortfall')).toBe(false)
  })

  it('does nothing for a booking on a different day', () => {
    const bookings = { 'V-027': { vehicleId: 'V-027', startDate: '2026-09-30', days: 1 } }
    const blockers = validatePlan({ fixture, weekId: WEEK_40, decisions: coldOpen(), bookings })
    expect(blockers.some((b) => b.kind === 'capacity-shortfall')).toBe(true)
  })
})

describe('the journey to a committable plan', () => {
  function resolved(): Record<ItemId, DraftDecision> {
    const d = coldOpen()
    d['item-v118'] = { ...d['item-v118'], slotDate: '2026-10-01' }
    d['item-v041'] = {
      itemId: 'item-v041',
      treatment: 'watch',
      slotDate: null,
      deferral: {
        reason: 'No specialist cover exists this week.',
        reviewDate: '2026-10-05',
        trigger: { kind: 'event', eventId: 'v041-dtc-recurs', label: 'DTC P0300 recurs' },
      },
    }
    return d
  }

  it('clears the shortfall when V-118 moves to Thursday but keeps the undisposed blocker', () => {
    const d = coldOpen()
    d['item-v118'] = { ...d['item-v118'], slotDate: '2026-10-01' }
    expect(validate(d).map((b) => b.kind)).toEqual(['undisposed-item'])
  })

  it('commits once both are resolved', () => {
    const blockers = validate(resolved())
    expect(blockers).toEqual([])
    expect(canCommit(blockers)).toBe(true)
  })

  it('blocks again if V-041 is scheduled instead of deferred, with no lever to close it', () => {
    const d = resolved()
    d['item-v041'] = { itemId: 'item-v041', treatment: 'act-now', slotDate: '2026-10-01', deferral: null }
    const blockers = validate(d)
    const spec = blockers.find(
      (b) => b.kind === 'capacity-shortfall' && b.vehicleClass === 'specialist',
    )
    expect(spec).toBeDefined()
    expect(canCommit(blockers)).toBe(false)
  })

  it('treats a watch with an incomplete deferral as undisposed', () => {
    const d = resolved()
    d['item-v041'] = { itemId: 'item-v041', treatment: 'watch', slotDate: null, deferral: null }
    expect(validate(d).some((b) => b.kind === 'undisposed-item' && b.itemId === 'item-v041')).toBe(true)
  })

  it('reports an infeasible slot rather than accepting it', () => {
    const d = resolved()
    d['item-v118'] = { ...d['item-v118'], slotDate: '2026-09-28' }
    const blockers = validate(d)
    expect(blockers.some((b) => b.kind === 'infeasible-slot' && b.itemId === 'item-v118')).toBe(true)
    expect(canCommit(blockers)).toBe(false)
  })

  it('reports parts not ready with the date', () => {
    const d = resolved()
    d['item-v012'] = { ...d['item-v012'], slotDate: '2026-09-28' }
    const parts = validate(d).find((b) => b.kind === 'parts-not-ready') as { readyOn: string }
    expect(parts.readyOn).toBe('2026-09-29')
  })
})

describe('a resurfaced-only week', () => {
  it('reports its undecided resurfaced item as undisposed, so the plan cannot commit with nothing decided', () => {
    const decisions: Record<ItemId, DraftDecision> = {
      'item-v041': { itemId: 'item-v041', treatment: null, slotDate: null, deferral: null },
    }
    const blockers = validatePlan({ fixture, weekId: '2026-10-05', decisions })
    expect(blockers.some((b) => b.kind === 'undisposed-item' && b.itemId === 'item-v041')).toBe(true)
    expect(canCommit(blockers)).toBe(false)
  })
})

describe('attributing a shortfall to an item', () => {
  const blockers = validate(coldOpen())

  it('does not attribute it to a van that is already held that day', () => {
    // V-012 is off the road before the plan starts, so its Tuesday visit
    // subtracts nothing further and the shortfall is not its doing. [S 4.5]
    const attributed = blockersForItem(blockers, item('item-v012'), fixture)
    expect(attributed.some((b) => b.kind === 'capacity-shortfall')).toBe(false)
  })

  it('attributes it to the vans whose visits do subtract from the day', () => {
    for (const id of ['item-v103', 'item-v118']) {
      const attributed = blockersForItem(blockers, item(id), fixture)
      expect(attributed.some((b) => b.kind === 'capacity-shortfall')).toBe(true)
    }
  })

  it('leaves an item its own blockers, whatever the shortfall says', () => {
    expect(blockersForItem(blockers, item('item-v041'), fixture)).toEqual([
      { kind: 'undisposed-item', itemId: 'item-v041' },
    ])
  })
})

describe('blockers are named in plain language', () => {
  it('describes a shortfall by day and class', () => {
    const shortfall = validate(coldOpen()).find((b) => b.kind === 'capacity-shortfall')!
    const text = describeBlocker(shortfall, fixture)
    expect(text).toContain('Tue 29 Sep')
    expect(text).toContain('standard')
    expect(text).toContain('short by 1')
  })

  it('describes an infeasible slot with its reasons and the vehicle', () => {
    const b: Blocker = {
      kind: 'infeasible-slot',
      itemId: 'item-v118',
      reasons: ['Werkstatt Berg is fully booked on Mon 28 Sep'],
    }
    const text = describeBlocker(b, fixture)
    expect(text).toContain('V-118')
    expect(text).toContain('Werkstatt Berg is fully booked on Mon 28 Sep')
  })

  it('describes parts not ready with the part and the date', () => {
    const b: Blocker = {
      kind: 'parts-not-ready',
      itemId: 'item-v012',
      partName: 'Front brake pad set',
      readyOn: '2026-09-29',
    }
    const text = describeBlocker(b, fixture)
    expect(text).toContain('Front brake pad set')
    expect(text).toContain('Tue 29 Sep')
  })

  it('falls back to the raw id for an item the fixture does not carry', () => {
    const b: Blocker = { kind: 'undisposed-item', itemId: 'item-nonexistent' }
    expect(() => describeBlocker(b, fixture)).not.toThrow()
    expect(describeBlocker(b, fixture)).toContain('item-nonexistent')
  })

  it('describes every blocker kind without throwing', () => {
    for (const b of validate(coldOpen())) expect(typeof describeBlocker(b, fixture)).toBe('string')
  })
})
