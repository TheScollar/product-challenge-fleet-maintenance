import { describe, expect, it } from 'vitest'
import { fixture } from './fixture'
import { blockersForItem, canCommit, describeBlocker, validatePlan } from './validation'
import { proposedDecisions as proposed, item } from './testSupport'
import { draftFor, initialState } from '../state/planReducer'
import type { Blocker, DraftDecision, ItemId } from './types'

const WEEK_40 = '2026-09-28'

const validate = (decisions: Record<ItemId, DraftDecision>) =>
  validatePlan({ fixture, weekId: WEEK_40, decisions })

type Shortfall = Extract<Blocker, { kind: 'capacity-shortfall' }>
const shortfalls = (blockers: Blocker[]) =>
  blockers.filter((b): b is Shortfall => b.kind === 'capacity-shortfall')

// V-012 is held all week and no pool cover exists, so its replacement is an
// explicit request, Monday for five days. [no pool cover spec §3.1]
const V012_COVER = { vehicleId: 'V-012', startDate: '2026-09-28', days: 5 }
const V103_COVER = { vehicleId: 'V-103', startDate: '2026-09-29', days: 1 }

describe('the adopted proposals carry the V-041 decision and the uncovered days', () => {
  const blockers = validate(proposed())

  it('reports the undisposed V-041 decision and a standard shortfall on every day but Thursday', () => {
    expect(blockers.filter((b) => b.kind === 'undisposed-item')).toEqual([
      { kind: 'undisposed-item', itemId: 'item-v041' },
    ])
    expect(shortfalls(blockers).map((b) => [b.date, b.vehicleClass, b.shortBy])).toEqual([
      ['2026-09-28', 'standard', 1],
      ['2026-09-29', 'standard', 3],
      ['2026-09-30', 'standard', 1],
      ['2026-10-02', 'standard', 1],
    ])
    expect(blockers).toHaveLength(5)
  })

  it('names the day, the class and the contributors on the Tuesday shortfall', () => {
    const tue = shortfalls(blockers).find((b) => b.date === '2026-09-29')!
    expect(tue.vehicleClass).toBe('standard')
    expect(tue.shortBy).toBe(3)
    expect([...tue.contributors].sort()).toEqual(['V-012', 'V-103', 'V-118'])
  })

  it('does not let the plan commit', () => {
    expect(canCommit(blockers)).toBe(false)
  })

  it('never treats the held vehicle as a blocker on its own', () => {
    expect(blockers.some((b) => b.kind === 'undisposed-item' && b.itemId === 'item-v012')).toBe(false)
  })
})

describe('a requested booking clears a capacity blocker only for a vehicle with a visit or a hold', () => {
  it('removes a Tuesday shortfall once the visiting van is covered', () => {
    const without = validatePlan({ fixture, weekId: WEEK_40, decisions: proposed() })
    const bookings = { 'V-118': { vehicleId: 'V-118', startDate: '2026-09-29', days: 1 } }
    const blockers = validatePlan({ fixture, weekId: WEEK_40, decisions: proposed(), bookings })
    const tueShort = (bs: Blocker[]) => shortfalls(bs).find((b) => b.date === '2026-09-29')?.shortBy
    expect(tueShort(without)).toBe(3)
    expect(tueShort(blockers)).toBe(2)
  })

  it('clears every shortfall for the held V-012, which has no visit', () => {
    const open = draftFor({ fixture, state: initialState(fixture), weekId: WEEK_40 })
    const bookings = { 'V-012': V012_COVER }
    expect(shortfalls(validate(open))).toHaveLength(4)
    const blockers = validatePlan({ fixture, weekId: WEEK_40, decisions: open, bookings })
    expect(shortfalls(blockers)).toEqual([])
  })

  it('does nothing for a booking on a different day', () => {
    const bookings = { 'V-118': { vehicleId: 'V-118', startDate: '2026-09-30', days: 1 } }
    const blockers = validatePlan({ fixture, weekId: WEEK_40, decisions: proposed(), bookings })
    expect(shortfalls(blockers).find((b) => b.date === '2026-09-29')?.shortBy).toBe(3)
  })

  it('does nothing for a vehicle that has no visit and no hold', () => {
    const bookings = { 'V-027': { vehicleId: 'V-027', startDate: '2026-09-29', days: 1 } }
    const blockers = validatePlan({ fixture, weekId: WEEK_40, decisions: proposed(), bookings })
    expect(blockers).toEqual(validate(proposed()))
  })
})

describe('the journey to a committable plan', () => {
  const WALKTHROUGH_BOOKINGS = { 'V-012': V012_COVER, 'V-103': V103_COVER }

  function watchV041(d: Record<ItemId, DraftDecision>) {
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
  }

  function resolved(): Record<ItemId, DraftDecision> {
    const d = proposed()
    d['item-v118'] = { ...d['item-v118'], slotDate: '2026-10-01' }
    watchV041(d)
    return d
  }

  const validateWith = (decisions: Record<ItemId, DraftDecision>, bookings = WALKTHROUGH_BOOKINGS) =>
    validatePlan({ fixture, weekId: WEEK_40, decisions, bookings })

  it('follows the capacity table one step at a time, and commits only after all four', () => {
    const d = proposed()

    // 1. Book V-012 Monday for five days: only Tuesday stays short, by 2.
    let blockers = validatePlan({ fixture, weekId: WEEK_40, decisions: d, bookings: { 'V-012': V012_COVER } })
    expect(shortfalls(blockers).map((b) => [b.date, b.shortBy])).toEqual([['2026-09-29', 2]])
    expect(canCommit(blockers)).toBe(false)

    // 2. Move V-118 to Thursday: Tuesday is short by 1, Thursday holds.
    d['item-v118'] = { ...d['item-v118'], slotDate: '2026-10-01' }
    blockers = validatePlan({ fixture, weekId: WEEK_40, decisions: d, bookings: { 'V-012': V012_COVER } })
    expect(shortfalls(blockers).map((b) => [b.date, b.shortBy])).toEqual([['2026-09-29', 1]])
    expect(canCommit(blockers)).toBe(false)

    // 3. Book V-103 Tuesday for one day: the band is clear, V-041 is still undecided.
    blockers = validateWith(d)
    expect(blockers).toEqual([{ kind: 'undisposed-item', itemId: 'item-v041' }])
    expect(canCommit(blockers)).toBe(false)

    // 4. Watch V-041 with a complete deferral: nothing blocks.
    watchV041(d)
    blockers = validateWith(d)
    expect(blockers).toEqual([])
    expect(canCommit(blockers)).toBe(true)
  })

  it('commits once every step is taken', () => {
    const blockers = validateWith(resolved())
    expect(blockers).toEqual([])
    expect(canCommit(blockers)).toBe(true)
  })

  it('blocks again if V-041 is scheduled instead of deferred, with no lever to close it', () => {
    const d = resolved()
    d['item-v041'] = { itemId: 'item-v041', treatment: 'act-now', slotDate: '2026-10-01', deferral: null }
    const blockers = validateWith(d)
    const spec = blockers.find(
      (b) => b.kind === 'capacity-shortfall' && b.vehicleClass === 'specialist',
    )
    expect(spec).toBeDefined()
    expect(canCommit(blockers)).toBe(false)
  })

  it('treats a watch with an incomplete deferral as undisposed', () => {
    const d = resolved()
    d['item-v041'] = { itemId: 'item-v041', treatment: 'watch', slotDate: null, deferral: null }
    expect(validateWith(d).some((b) => b.kind === 'undisposed-item' && b.itemId === 'item-v041')).toBe(true)
  })

  it('reports an infeasible slot rather than accepting it', () => {
    const d = resolved()
    d['item-v118'] = { ...d['item-v118'], slotDate: '2026-09-28' }
    const blockers = validateWith(d)
    expect(blockers.some((b) => b.kind === 'infeasible-slot' && b.itemId === 'item-v118')).toBe(true)
    expect(canCommit(blockers)).toBe(false)
  })

  it('reports parts not ready with the date', () => {
    const d = resolved()
    d['item-v012'] = { ...d['item-v012'], slotDate: '2026-09-28' }
    const parts = validateWith(d).find((b) => b.kind === 'parts-not-ready') as { readyOn: string }
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
  const blockers = validate(proposed())

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
    const tue = shortfalls(validate(proposed())).find((b) => b.date === '2026-09-29')!
    expect(describeBlocker(tue, fixture)).toBe(
      'Tue 29 Sep: standard short by 3. Off the road: V-012, V-103, V-118.',
    )
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
    for (const b of validate(proposed())) expect(typeof describeBlocker(b, fixture)).toBe('string')
  })
})

describe('the true cold open', () => {
  it('carries one undisposed blocker per item and four shortfalls, because V-012 is held with no cover', () => {
    const open = draftFor({ fixture, state: initialState(fixture), weekId: WEEK_40 })
    const blockers = validate(open)
    expect(blockers.filter((b) => b.kind === 'undisposed-item')).toHaveLength(5)
    expect(shortfalls(blockers).map((b) => [b.date, b.vehicleClass, b.shortBy])).toEqual([
      ['2026-09-28', 'standard', 1],
      ['2026-09-29', 'standard', 1],
      ['2026-09-30', 'standard', 1],
      ['2026-10-02', 'standard', 1],
    ])
    expect(blockers).toHaveLength(9)
    expect(canCommit(blockers)).toBe(false)
  })
})
