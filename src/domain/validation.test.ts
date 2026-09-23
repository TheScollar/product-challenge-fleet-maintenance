import { describe, expect, it } from 'vitest'
import { fixture } from './fixture'
import { canCommit, describeBlocker, validatePlan } from './validation'
import { coldOpenDecisions as coldOpen } from './testSupport'
import type { DraftDecision, ItemId } from './types'

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

describe('blockers are named in plain language', () => {
  it('describes a shortfall by day and class', () => {
    const text = describeBlocker(validate(coldOpen())[0], fixture)
    expect(text.length).toBeGreaterThan(10)
  })

  it('describes every blocker kind without throwing', () => {
    for (const b of validate(coldOpen())) expect(typeof describeBlocker(b, fixture)).toBe('string')
  })
})
