import { describe, expect, it } from 'vitest'
import { fixture } from '../domain/fixture'
import { validatePlan } from '../domain/validation'
import type { DraftDecision } from '../domain/types'
import { activeWeekId, initialState, queueFor } from '../state/planReducer'
import { proposedDecisions } from '../domain/testSupport'
import { blockerChips, classifyItem, groupQueue } from './grouping'

const state = initialState(fixture)
const weekId = activeWeekId(state)
const entries = queueFor({ fixture, state, weekId })
const items = entries.map((e) => e.item)
const decisions = proposedDecisions()
const blockers = validatePlan({ fixture, weekId, decisions })

const idOf = (vehicleId: string) => items.find((i) => i.vehicleId === vehicleId)!.id

describe('groupQueue with every proposal adopted', () => {
  const groups = groupQueue({ items, decisions, blockers, fixture })

  it('renders exactly two groups: blocking, then settled', () => {
    expect(groups.map((g) => g.kind)).toEqual(['blocking', 'settled'])
    expect(groups.map((g) => g.label)).toEqual(['Blocking the week', 'Settled'])
  })

  it('puts the blocked items first, in orderQueue order', () => {
    expect(groups[0].items.map((i) => i.vehicleId)).toEqual(['V-041', 'V-103', 'V-118'])
  })

  it('settles the booked hard stop and the watched item', () => {
    // V-012 is held, so the Tue shortfall is not attributed to it. [S 4.5]
    expect(groups[1].items.map((i) => i.vehicleId)).toEqual(['V-012', 'V-027'])
  })
})

describe('groupQueue once the week is clear', () => {
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
    // Moving V-118 to Thursday clears the Tuesday shortfall (README step 2).
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
  it('classifies undecided-with-no-blockers as open, though validation never produces it', () => {
    // [D §4]: the third state is unreachable under current validation rules,
    // but the classifier stays total.
    const v041 = items.find((i) => i.vehicleId === 'V-041')!
    expect(classifyItem({ item: v041, decision: undefined, blockers: [], fixture })).toBe('open')
  })
})

describe('blockerChips with every proposal adopted', () => {
  const chips = blockerChips({ blockers, items, decisions, fixture })

  it('renders one chip per blocker with the spec copy', () => {
    expect(chips.map((c) => c.label)).toEqual([
      'V-041 · no decision',
      'Tue 29 Sep · standard short 1',
    ])
  })

  it('targets the undisposed item directly', () => {
    expect(chips[0].targetItemId).toBe(idOf('V-041'))
  })

  it('targets the first contributing item in queue order for the capacity blocker', () => {
    expect(chips[1].targetItemId).toBe(idOf('V-103'))
  })
})
