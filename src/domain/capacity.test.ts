import { describe, expect, it } from 'vitest'
import { computeDayCapacity, computeWeekCapacity, isHeldOn, unavailableOn, weekFixtureFor } from './capacity'
import { fixture } from './fixture'
import { visitCoversDate, visitsFromDecisions } from './visits'
import { coldOpenDecisions, vehicle } from './testSupport'
import type { ItemId, Visit } from './types'

const WEEK_40 = '2026-09-28'

function standardFor(visits: Visit[], date: string) {
  const week = weekFixtureFor(fixture, WEEK_40)
  return computeDayCapacity({ date, vehicleClass: 'standard', fixture, visits, week })
}

describe('derived visits', () => {
  it('produces one visit per scheduled item, and none for a watch', () => {
    const visits = visitsFromDecisions(coldOpenDecisions(), fixture.items)
    expect(visits.map((v) => v.itemId).sort()).toEqual(['item-v012', 'item-v103', 'item-v118'])
  })

  it('cannot duplicate a visit however many times it is derived', () => {
    const decisions = coldOpenDecisions()
    const once = visitsFromDecisions(decisions, fixture.items)
    const twice = visitsFromDecisions(decisions, fixture.items)
    expect(twice).toEqual(once)
    expect(new Set(twice.map((v) => v.itemId)).size).toBe(twice.length)
  })

  it('counts every day a multi-day visit covers', () => {
    const visit: Visit = {
      itemId: 'item-v103',
      vehicleId: 'V-103',
      garageId: 'werkstatt-berg',
      startDate: '2026-09-29',
      days: 2,
      scope: 'suspension',
    }
    expect(visitCoversDate(visit, '2026-09-28')).toBe(false)
    expect(visitCoversDate(visit, '2026-09-29')).toBe(true)
    expect(visitCoversDate(visit, '2026-09-30')).toBe(true)
    expect(visitCoversDate(visit, '2026-10-01')).toBe(false)
  })
})

describe('unavailability is a set, so nothing is subtracted twice', () => {
  it('counts a held vehicle with a booked visit exactly once', () => {
    const visits = visitsFromDecisions(coldOpenDecisions(), fixture.items)
    const unavailable = unavailableOn('2026-09-29', fixture.vehicles, visits)
    expect([...unavailable].sort()).toEqual(['V-012', 'V-103', 'V-118'])
  })

  it('keeps the held vehicle unavailable on a day it has no visit', () => {
    const unavailable = unavailableOn('2026-09-30', fixture.vehicles, [])
    expect([...unavailable]).toEqual(['V-012'])
  })

  it('keeps the held vehicle unavailable for the whole planning week', () => {
    for (const date of ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']) {
      expect(unavailableOn(date, fixture.vehicles, []).has('V-012')).toBe(true)
    }
  })

  it('releases it only on the date the fixture records, not before', () => {
    expect(unavailableOn('2026-10-05', fixture.vehicles, []).has('V-012')).toBe(true)
    expect(unavailableOn('2026-10-06', fixture.vehicles, []).has('V-012')).toBe(false)
  })
})

describe('isHeldOn is the single definition of "held on a date"', () => {
  it('is true the day before the recorded release and false from the release date on', () => {
    expect(isHeldOn(vehicle('V-012'), '2026-10-05')).toBe(true)
    expect(isHeldOn(vehicle('V-012'), '2026-10-06')).toBe(false)
  })

  it('is false for a vehicle that has never been held', () => {
    expect(isHeldOn(vehicle('V-103'), '2026-10-05')).toBe(false)
  })
})

describe('cold open capacity matches the seeded scenario', () => {
  const visits = visitsFromDecisions(coldOpenDecisions(), fixture.items)

  it('leaves Tuesday one standard van short', () => {
    const tue = standardFor(visits, '2026-09-29')
    expect(tue.owned).toBe(38)
    expect(tue.unavailable.sort()).toEqual(['V-012', 'V-103', 'V-118'])
    expect(tue.cover).toBe(2)
    expect(tue.available).toBe(37)
    expect(tue.demand).toBe(38)
    expect(tue.shortfall).toBe(1)
  })

  it('meets demand on every other day, with one spare on Thursday', () => {
    expect(standardFor(visits, '2026-09-28').available).toBe(38)
    expect(standardFor(visits, '2026-09-30').available).toBe(38)
    expect(standardFor(visits, '2026-10-01').available).toBe(39)
    expect(standardFor(visits, '2026-10-02').available).toBe(38)
  })

  it('leaves the specialist class untouched, because V-041 is undisposed', () => {
    const week = weekFixtureFor(fixture, WEEK_40)
    for (const date of week.days) {
      const spec = computeDayCapacity({ date, vehicleClass: 'specialist', fixture, visits, week })
      expect(spec.available).toBe(7)
      expect(spec.shortfall).toBe(0)
    }
  })
})

describe('the levers behave as the scenario requires', () => {
  function withSlot(itemId: ItemId, slotDate: string | null, days?: number) {
    const decisions = coldOpenDecisions()
    decisions[itemId] = { ...decisions[itemId], slotDate }
    const items = days
      ? fixture.items.map((i) => (i.id === itemId ? { ...i, visitDays: days } : i))
      : fixture.items
    return visitsFromDecisions(decisions, items)
  }

  it('clears the shortfall when V-118 moves to Thursday', () => {
    const visits = withSlot('item-v118', '2026-10-01')
    expect(standardFor(visits, '2026-09-29').shortfall).toBe(0)
    expect(standardFor(visits, '2026-10-01').shortfall).toBe(0)
  })

  it('only relocates the shortfall when V-118 moves to Wednesday', () => {
    const visits = withSlot('item-v118', '2026-09-30')
    expect(standardFor(visits, '2026-09-29').shortfall).toBe(0)
    expect(standardFor(visits, '2026-09-30').shortfall).toBe(1)
  })

  it('breaks the specialist class when V-041 is scheduled, on any day', () => {
    const week = weekFixtureFor(fixture, WEEK_40)
    for (const date of week.days) {
      const visits = withSlot('item-v041', date)
      const spec = computeDayCapacity({ date, vehicleClass: 'specialist', fixture, visits, week })
      expect(spec.available).toBe(6)
      expect(spec.shortfall).toBe(1)
      expect(spec.cover).toBe(0)
    }
  })

  it('reproduces a Wednesday shortage when V-103 extends to a second day', () => {
    const visits = withSlot('item-v103', '2026-09-29', 2)
    // V-118 is still on Tuesday here, so Tuesday stays short as well.
    expect(standardFor(visits, '2026-09-30').shortfall).toBe(1)
    expect(standardFor(visits, '2026-09-30').unavailable.sort()).toEqual(['V-012', 'V-103'])
  })

  it('uses the week 41 template, where R-2 does not exist', () => {
    const week = weekFixtureFor(fixture, '2026-10-05')
    const mon = computeDayCapacity({
      date: '2026-10-05',
      vehicleClass: 'standard',
      fixture,
      visits: [],
      week,
    })
    expect(mon.cover).toBe(1)
    expect(mon.available).toBe(38)
  })

  it('falls back to the default template for weeks the fixture does not author', () => {
    const week = weekFixtureFor(fixture, '2026-11-02')
    expect(week.itemIds).toEqual([])
    expect(week.coverIds).toEqual(['R-1'])
    expect(week.days).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
    ])
  })
})

describe('computeWeekCapacity', () => {
  it('returns ten rows, five days by two classes', () => {
    const rows = computeWeekCapacity({ fixture, weekId: WEEK_40, visits: [] })
    expect(rows).toHaveLength(10)
    expect(new Set(rows.map((r) => r.date)).size).toBe(5)
  })
})
