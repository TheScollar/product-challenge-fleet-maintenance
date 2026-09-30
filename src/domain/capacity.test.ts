import { describe, expect, it } from 'vitest'
import {
  capacityBreakdown,
  capacityFigure,
  computeDayCapacity,
  computeWeekCapacity,
  demandOn,
  heldAmong,
  isHeldOn,
  unavailableOn,
  weekFixtureFor,
} from './capacity'
import { fixture } from './fixture'
import { adHocCoversFrom } from './replacementBooking'
import { visitCoversDate, visitsFromDecisions } from './visits'
import { proposedDecisions, vehicle } from './testSupport'
import type { Cover, ItemId, Visit } from './types'

const WEEK_40 = '2026-09-28'

function standardFor(visits: Visit[], date: string, adHocCovers: Cover[] = []) {
  const week = weekFixtureFor(fixture, WEEK_40)
  return computeDayCapacity({ date, vehicleClass: 'standard', fixture, visits, week, adHocCovers })
}

describe('derived visits', () => {
  it('produces one visit per scheduled item, and none for a watch', () => {
    const visits = visitsFromDecisions(proposedDecisions(), fixture.items)
    expect(visits.map((v) => v.itemId).sort()).toEqual(['item-v012', 'item-v103', 'item-v118'])
  })

  it('cannot duplicate a visit however many times it is derived', () => {
    const decisions = proposedDecisions()
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
    const visits = visitsFromDecisions(proposedDecisions(), fixture.items)
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

describe('heldAmong', () => {
  it('finds V-012 among the Monday contributors of week 41', () => {
    expect(heldAmong(['V-024', 'V-012'], '2026-10-05', fixture)).toBe('V-012')
  })

  it('is null once the hold has ended', () => {
    expect(heldAmong(['V-012'], '2026-10-06', fixture)).toBeNull()
  })
})

describe('demandOn reads a day override and falls back to the week', () => {
  it('uses the override for the class it names', () => {
    expect(demandOn(weekFixtureFor(fixture, '2026-09-28'), '2026-10-01', 'standard')).toBe(37)
  })
  it('falls back to week.demand for a class the override omits', () => {
    expect(demandOn(weekFixtureFor(fixture, '2026-09-28'), '2026-10-01', 'specialist')).toBe(7)
  })
  it('falls back to week.demand on a day with no override', () => {
    expect(demandOn(weekFixtureFor(fixture, '2026-09-28'), '2026-09-29', 'standard')).toBe(38)
  })
  it('holds V-012 on every day of week 40 and on Monday of week 41 only', () => {
    const v012 = vehicle('V-012')
    for (const d of ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-05']) {
      expect(isHeldOn(v012, d)).toBe(true)
    }
    for (const d of ['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']) {
      expect(isHeldOn(v012, d)).toBe(false)
    }
  })
})

describe('the adopted proposals reproduce the scripted scenario', () => {
  const visits = visitsFromDecisions(proposedDecisions(), fixture.items)

  it('leaves Tuesday three standard vans short', () => {
    const tue = standardFor(visits, '2026-09-29')
    expect(tue.owned).toBe(38)
    expect(tue.unavailable.sort()).toEqual(['V-012', 'V-103', 'V-118'])
    expect(tue.cover).toBe(0)
    expect(tue.available).toBe(35)
    expect(tue.demand).toBe(38)
    expect(tue.shortfall).toBe(3)
  })

  it('leaves every other day one short, except the light Thursday', () => {
    for (const date of ['2026-09-28', '2026-09-30', '2026-10-02']) {
      const day = standardFor(visits, date)
      expect(day.available).toBe(37)
      expect(day.demand).toBe(38)
      expect(day.shortfall).toBe(1)
    }
    const thu = standardFor(visits, '2026-10-01')
    expect(thu.available).toBe(37)
    expect(thu.demand).toBe(37)
    expect(thu.shortfall).toBe(0)
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
  // V-012 is held all week with no pool cover, so every lever below is read
  // with its requested replacement in place, Monday for five days. [no pool cover spec §3.1]
  const v012Cover = adHocCoversFrom(
    { 'V-012': { vehicleId: 'V-012', startDate: '2026-09-28', days: 5 } },
    fixture.replacementDayRateEur,
  )

  function withSlot(itemId: ItemId, slotDate: string | null, days?: number) {
    const decisions = proposedDecisions()
    decisions[itemId] = { ...decisions[itemId], slotDate }
    const items = days
      ? fixture.items.map((i) => (i.id === itemId ? { ...i, visitDays: days } : i))
      : fixture.items
    return visitsFromDecisions(decisions, items)
  }

  it('moves V-118 to Thursday for free, leaving Tuesday one short', () => {
    const visits = withSlot('item-v118', '2026-10-01')
    const tue = standardFor(visits, '2026-09-29', v012Cover)
    expect(capacityFigure(tue)).toBe('36 + 1 / 38')
    expect(tue.shortfall).toBe(1)
    const thu = standardFor(visits, '2026-10-01', v012Cover)
    expect(capacityFigure(thu)).toBe('36 + 1 / 37')
    expect(thu.shortfall).toBe(0)
  })

  it('only relocates the shortfall when V-118 moves to Wednesday', () => {
    const visits = withSlot('item-v118', '2026-09-30')
    expect(standardFor(visits, '2026-09-29', v012Cover).shortfall).toBe(1)
    const wed = standardFor(visits, '2026-09-30', v012Cover)
    expect(capacityFigure(wed)).toBe('36 + 1 / 38')
    expect(wed.shortfall).toBe(1)
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
    expect(standardFor(visits, '2026-09-30', v012Cover).shortfall).toBe(1)
    expect(standardFor(visits, '2026-09-30').shortfall).toBe(2)
    expect(standardFor(visits, '2026-09-30').unavailable.sort()).toEqual(['V-012', 'V-103'])
  })

  it('uses the week 41 template, with no cover and the V-012 hold on Monday', () => {
    const week = weekFixtureFor(fixture, '2026-10-05')
    const day = (date: string) =>
      computeDayCapacity({ date, vehicleClass: 'standard', fixture, visits: [], week })
    const mon = day('2026-10-05')
    expect(mon.cover).toBe(0)
    expect(mon.unavailable).toEqual(['V-012'])
    expect(capacityFigure(mon)).toBe('37 / 38')
    expect(mon.shortfall).toBe(1)
    for (const date of ['2026-10-07', '2026-10-08']) {
      expect(capacityFigure(day(date))).toBe('38 / 37')
      expect(day(date).shortfall).toBe(0)
    }
  })

  it('falls back to the default template for weeks the fixture does not author', () => {
    const week = weekFixtureFor(fixture, '2026-11-02')
    expect(week.itemIds).toEqual([])
    expect(week.coverIds).toEqual([])
    expect(week.budgetEur).toBe(fixture.defaultBudgetEur)
    expect(week.days).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
    ])
    for (const date of week.days) {
      expect(demandOn(week, date, 'standard')).toBe(38)
    }
  })
})

describe('computeWeekCapacity', () => {
  it('returns ten rows, five days by two classes', () => {
    const rows = computeWeekCapacity({ fixture, weekId: WEEK_40, visits: [] })
    expect(rows).toHaveLength(10)
    expect(new Set(rows.map((r) => r.date)).size).toBe(5)
  })
})

describe('an ad hoc cover adds capacity on the days it confirms', () => {
  it('adds to the standard count on the days it confirms', () => {
    const visits = visitsFromDecisions(proposedDecisions(), fixture.items)
    const tue = standardFor(visits, '2026-09-29')
    expect(tue.shortfall).toBe(3)

    const extra: Cover = {
      id: 'V-103 replacement',
      vehicleClass: 'standard',
      confirmedDates: ['2026-09-29'],
      dayRateEur: 140,
    }
    const tueWithBooking = standardFor(visits, '2026-09-29', [extra])
    expect(tueWithBooking.cover).toBe(1)
    expect(tueWithBooking.available).toBe(36)
    expect(tueWithBooking.shortfall).toBe(2)
    expect(standardFor(visits, '2026-09-30', [extra]).cover).toBe(0)
  })

  it('never contributes to a class it was not confirmed for', () => {
    const specOnly: Cover = {
      id: 'x',
      vehicleClass: 'specialist',
      confirmedDates: ['2026-09-29'],
      dayRateEur: 140,
    }
    const tue = standardFor([], '2026-09-29', [specOnly])
    expect(tue.cover).toBe(0)
  })

  it('defaults to no ad hoc cover when the argument is omitted', () => {
    const week = weekFixtureFor(fixture, WEEK_40)
    const tue = computeDayCapacity({ date: '2026-09-29', vehicleClass: 'standard', fixture, visits: [], week })
    expect(tue.cover).toBe(0)
  })
})

describe('capacity figures name own vans and cover separately', () => {
  const adopted = visitsFromDecisions(proposedDecisions(), fixture.items)
  const week = weekFixtureFor(fixture, WEEK_40)
  const v012Cover = adHocCoversFrom(
    { 'V-012': { vehicleId: 'V-012', startDate: '2026-09-28', days: 5 } },
    fixture.replacementDayRateEur,
  )

  it('reads own + cover / demand where a replacement is on site', () => {
    const mon = standardFor([], '2026-09-28', v012Cover)
    expect(mon.coverIds).toEqual(['V-012 replacement'])
    expect(capacityFigure(mon)).toBe('37 + 1 / 38')
    expect(capacityFigure(standardFor(adopted, '2026-09-29', v012Cover))).toBe('35 + 1 / 38')
    expect(capacityFigure(standardFor([], '2026-09-30'))).toBe('37 / 38')
  })

  it('drops the cover term where no cover exists', () => {
    const spec = computeDayCapacity({ date: '2026-10-01', vehicleClass: 'specialist', fixture, visits: adopted, week })
    expect(spec.coverIds).toEqual([])
    expect(capacityFigure(spec)).toBe('7 / 7')
  })

  it('lists an ad hoc cover by its id', () => {
    const extra: Cover = { id: 'V-118 replacement', vehicleClass: 'standard', confirmedDates: ['2026-09-29'], dayRateEur: 140 }
    const tue = standardFor(adopted, '2026-09-29', [extra])
    expect(tue.coverIds).toEqual(['V-118 replacement'])
    expect(capacityFigure(tue)).toBe('35 + 1 / 38')
  })

  it('spells the breakdown out for the cell tooltip', () => {
    expect(capacityBreakdown(standardFor(adopted, '2026-10-01', v012Cover))).toBe(
      '38 owned · off the road: V-012 · replacements on site: V-012 replacement',
    )
    expect(capacityBreakdown(standardFor(adopted, '2026-10-01'))).toBe(
      '38 owned · off the road: V-012 · no replacement on site',
    )
    const spec = computeDayCapacity({ date: '2026-10-01', vehicleClass: 'specialist', fixture, visits: adopted, week })
    expect(capacityBreakdown(spec)).toBe('7 owned · none off the road · no replacement on site')
  })
})
