import { describe, expect, it } from 'vitest'
import { fixture } from '../domain/fixture'
import { proposedDecisions } from '../domain/testSupport'
import { validatePlan } from '../domain/validation'
import type { DraftDecision } from '../domain/types'
import { activeWeekId, draftFor, initialState, queueFor } from '../state/planReducer'
import { blockerChips, classifyItem, groupQueue } from './grouping'

const state = initialState(fixture)
const weekId = activeWeekId(state)
const entries = queueFor({ fixture, state, weekId })
const items = entries.map((e) => e.item)
const idOf = (vehicleId: string) => items.find((i) => i.vehicleId === vehicleId)!.id

describe('groupQueue at the true cold open', () => {
  const decisions = draftFor({ fixture, state, weekId })
  const blockers = validatePlan({ fixture, weekId, decisions })
  const groups = groupQueue({ items, decisions, blockers, fixture })

  it('renders one To decide group holding every item, in queue order', () => {
    expect(groups.map((g) => [g.kind, g.label])).toEqual([['open', 'To decide']])
    expect(groups[0].items.map((i) => i.vehicleId)).toEqual(['V-012', 'V-027', 'V-103', 'V-118', 'V-041'])
  })

  it('collapses the five undecided items into one amber chip that selects the first of them', () => {
    const chips = blockerChips({ blockers, items, decisions, fixture })
    expect(chips).toEqual([
      { key: 'undisposed-all', label: '5 to decide', targetItemId: idOf('V-012'), tone: 'warn' },
    ])
  })
})

describe('groupQueue with every proposal adopted', () => {
  const decisions = proposedDecisions()
  const blockers = validatePlan({ fixture, weekId, decisions })
  const groups = groupQueue({ items, decisions, blockers, fixture })

  it('renders blocking, then to decide, then settled', () => {
    expect(groups.map((g) => g.kind)).toEqual(['blocking', 'open', 'settled'])
    expect(groups.map((g) => g.label)).toEqual(['Blocking the week', 'To decide', 'Settled'])
  })

  it('blocks only the two vans whose Tuesday visits cause the shortfall', () => {
    expect(groups[0].items.map((i) => i.vehicleId)).toEqual(['V-103', 'V-118'])
  })

  it('leaves the slotless specialist proposal to decide, not blocking', () => {
    expect(groups[1].items.map((i) => i.vehicleId)).toEqual(['V-041'])
  })

  it('settles the booked hard stop and the watched item', () => {
    // V-012 is held, so the Tue shortfall is not attributed to it. [S 4.5]
    expect(groups[2].items.map((i) => i.vehicleId)).toEqual(['V-012', 'V-027'])
  })

  it('renders one chip per blocker, a single undecided item by name', () => {
    const chips = blockerChips({ blockers, items, decisions, fixture })
    expect(chips.map((c) => [c.label, c.tone])).toEqual([
      ['V-041 · no decision', 'warn'],
      ['Tue 29 Sep · standard short 1', 'crit'],
    ])
    expect(chips[0].targetItemId).toBe(idOf('V-041'))
    expect(chips[1].targetItemId).toBe(idOf('V-103'))
  })
})

describe('groupQueue once the week is clear', () => {
  const decisions = proposedDecisions()
  const v041 = items.find((i) => i.vehicleId === 'V-041')!
  const cleared: Record<string, DraftDecision> = {
    ...decisions,
    [idOf('V-041')]: {
      itemId: idOf('V-041'),
      treatment: 'watch',
      slotDate: null,
      deferral: {
        reason: 'No specialist cover exists this week.',
        reviewDate: '2026-10-05',
        trigger: v041.triggerOptions[0],
      },
    },
    // Moving V-118 to Thursday clears the Tuesday shortfall.
    [idOf('V-118')]: { ...decisions[idOf('V-118')], slotDate: '2026-10-01' },
  }
  const clearedBlockers = validatePlan({ fixture, weekId, decisions: cleared })

  it('has no blockers left', () => {
    expect(clearedBlockers).toEqual([])
  })

  it('renders a single settled group of five', () => {
    const groups = groupQueue({ items, decisions: cleared, blockers: clearedBlockers, fixture })
    expect(groups.map((g) => g.kind)).toEqual(['settled'])
    expect(groups[0].items).toHaveLength(5)
  })
})

describe('classifyItem', () => {
  const v041 = items.find((i) => i.vehicleId === 'V-041')!
  const v118 = items.find((i) => i.vehicleId === 'V-118')!

  it('reads an undecided item as open even though validation blocks the commit on it', () => {
    const blockers = [{ kind: 'undisposed-item' as const, itemId: v041.id }]
    expect(classifyItem({ item: v041, decision: undefined, blockers, fixture })).toBe('open')
  })

  it('reads a visit treatment without a slot, and a watch without a record, as open', () => {
    const noSlot: DraftDecision = { itemId: v118.id, treatment: 'act-now', slotDate: null, deferral: null }
    const noRecord: DraftDecision = { itemId: v118.id, treatment: 'watch', slotDate: null, deferral: null }
    expect(classifyItem({ item: v118, decision: noSlot, blockers: [], fixture })).toBe('open')
    expect(classifyItem({ item: v118, decision: noRecord, blockers: [], fixture })).toBe('open')
  })

  it('reads a hard blocker as blocking whatever the decision says', () => {
    const blockers = [
      {
        kind: 'capacity-shortfall' as const,
        date: '2026-09-29',
        vehicleClass: 'standard' as const,
        shortBy: 1,
        contributors: ['V-118'],
      },
    ]
    const booked: DraftDecision = { itemId: v118.id, treatment: 'act-now', slotDate: '2026-09-29', deferral: null }
    expect(classifyItem({ item: v118, decision: booked, blockers, fixture })).toBe('blocking')
  })
})
