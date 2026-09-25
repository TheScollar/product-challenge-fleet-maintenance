import { describe, expect, it } from 'vitest'
import { computeDayCapacity, weekFixtureFor } from './capacity'
import { slotBlockers, slotOptions } from './feasibility'
import { fixture } from './fixture'
import { proposedDecisions, item } from './testSupport'
import { visitsFromDecisions } from './visits'

const WEEK_40 = '2026-09-28'

describe('slot blockers', () => {
  const visits = visitsFromDecisions(proposedDecisions(), fixture.items)

  it('accepts the proposed Tuesday slot for V-118', () => {
    expect(slotBlockers({ item: item('item-v118'), date: '2026-09-29', fixture, visits })).toEqual([])
  })

  it('rejects Monday for V-118 because the garage is fully booked', () => {
    const blockers = slotBlockers({ item: item('item-v118'), date: '2026-09-28', fixture, visits })
    expect(blockers).toHaveLength(1)
    expect(blockers[0].kind).toBe('infeasible-slot')
    expect((blockers[0] as { reasons: string[] }).reasons.join(' ')).toContain('fully booked')
  })

  it('reports BOTH reasons for V-012 on Monday, not just the first', () => {
    const blockers = slotBlockers({ item: item('item-v012'), date: '2026-09-28', fixture, visits })
    expect(blockers.map((b) => b.kind).sort()).toEqual(['infeasible-slot', 'parts-not-ready'])
    const parts = blockers.find((b) => b.kind === 'parts-not-ready') as {
      partName: string
      readyOn: string
    }
    expect(parts.partName).toBe('Front brake pad set')
    expect(parts.readyOn).toBe('2026-09-29')
  })

  it('accepts Tuesday for V-012, the day its parts are ready', () => {
    expect(slotBlockers({ item: item('item-v012'), date: '2026-09-29', fixture, visits })).toEqual([])
  })

  it('checks every day a multi-day visit would cover', () => {
    const extended = { ...item('item-v103'), visitDays: 2 }
    // Tuesday plus Wednesday: Wednesday has one free bay, which is enough.
    expect(slotBlockers({ item: extended, date: '2026-09-29', fixture, visits: [] })).toEqual([])
    // Starting Wednesday would spill into Thursday, and both have bays.
    expect(slotBlockers({ item: extended, date: '2026-09-30', fixture, visits: [] })).toEqual([])
  })

  it('never counts the item own existing visit against itself', () => {
    expect(slotBlockers({ item: item('item-v103'), date: '2026-09-29', fixture, visits })).toEqual([])
  })
})

describe('slot options offered to the user', () => {
  const decisions = proposedDecisions()

  it('offers every weekday, marking the infeasible ones with their reason', () => {
    const options = slotOptions({ item: item('item-v118'), fixture, decisions, weekId: WEEK_40 })
    expect(options.map((o) => o.date)).toEqual([
      '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02',
    ])
    const monday = options.find((o) => o.date === '2026-09-28')!
    expect(monday.feasible).toBe(false)
    expect(monday.reasons.length).toBeGreaterThan(0)
    expect(options.find((o) => o.date === '2026-10-01')!.feasible).toBe(true)
  })

  it('gives V-041 several feasible days, so its blocker is capacity and not the garage', () => {
    const options = slotOptions({ item: item('item-v041'), fixture, decisions, weekId: WEEK_40 })
    const feasible = options.filter((o) => o.feasible).map((o) => o.date)
    expect(feasible.length).toBeGreaterThanOrEqual(3)
    // Every feasible day still breaks the specialist class.
    const week = weekFixtureFor(fixture, WEEK_40)
    for (const date of feasible) {
      const withV041 = { ...decisions, 'item-v041': { ...decisions['item-v041'], slotDate: date } }
      const spec = computeDayCapacity({
        date,
        vehicleClass: 'specialist',
        fixture,
        visits: visitsFromDecisions(withV041, fixture.items),
        week,
      })
      expect(spec.shortfall).toBe(1)
    }
  })
})
