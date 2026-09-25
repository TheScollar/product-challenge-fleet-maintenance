import { describe, expect, it } from 'vitest'
import { fixture } from './fixture'
import {
  addDays,
  daysBetween,
  formatDay,
  formatDayCount,
  hasEventFired,
  isoWeekNumber,
  mondayOf,
  projectedOdometerKm,
  weekDays,
} from './clock'

describe('date arithmetic', () => {
  it('adds days across a month boundary', () => {
    expect(addDays('2026-09-29', 2)).toBe('2026-10-01')
    expect(addDays('2026-10-01', -3)).toBe('2026-09-28')
  })

  it('counts days between two dates', () => {
    expect(daysBetween('2026-09-28', '2026-10-01')).toBe(3)
    expect(daysBetween('2026-09-28', '2026-09-28')).toBe(0)
  })

  it('never shifts a day regardless of local timezone', () => {
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30') // European DST boundary
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
  })
})

describe('week derivation', () => {
  it('returns the Monday of a weekday', () => {
    expect(mondayOf('2026-09-28')).toBe('2026-09-28')
    expect(mondayOf('2026-10-02')).toBe('2026-09-28')
  })

  it('rolls a weekend forward to the next Monday', () => {
    expect(mondayOf('2026-09-26')).toBe('2026-09-28') // Saturday
    expect(mondayOf('2026-09-27')).toBe('2026-09-28') // Sunday
  })

  it('lists Monday to Friday', () => {
    expect(weekDays('2026-09-28')).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ])
  })

  it('computes the ISO week number for the header', () => {
    expect(isoWeekNumber('2026-09-28')).toBe(40)
    expect(isoWeekNumber('2026-10-05')).toBe(41)
    expect(isoWeekNumber('2026-11-02')).toBe(45)
  })

  it('formats a day compactly', () => {
    expect(formatDay('2026-09-29')).toBe('Tue 29 Sep')
  })
})

describe('odometer projection', () => {
  const v118 = fixture.vehicles.find((v) => v.id === 'V-118')!

  it('returns the raw reading on the day it was read', () => {
    expect(projectedOdometerKm(v118, '2026-09-18')).toBe(47_820)
  })

  it('projects forward at the vehicle weekly rate', () => {
    // 560 km per week is 80 km per day, over 7 days.
    expect(projectedOdometerKm(v118, '2026-09-25')).toBe(48_380)
  })

  it('crosses the 49,500 km trigger threshold on 9 Oct', () => {
    expect(projectedOdometerKm(v118, '2026-10-08')).toBeLessThan(49_500)
    expect(projectedOdometerKm(v118, '2026-10-09')).toBeGreaterThanOrEqual(49_500)
  })

  it('never projects backwards before the reading date', () => {
    expect(projectedOdometerKm(v118, '2026-09-01')).toBe(47_820)
  })
})

describe('scheduled events', () => {
  it('has not fired before its date', () => {
    expect(hasEventFired(fixture, 'v041-dtc-recurs', '2026-10-06')).toBe(false)
  })

  it('has fired on and after its date', () => {
    expect(hasEventFired(fixture, 'v041-dtc-recurs', '2026-10-07')).toBe(true)
    expect(hasEventFired(fixture, 'v041-dtc-recurs', '2026-11-30')).toBe(true)
  })

  it('never fires an event the fixture does not schedule', () => {
    expect(hasEventFired(fixture, 'v027-wipe-degrades', '2026-12-31')).toBe(false)
  })
})

describe('formatDayCount', () => {
  it('reads "1 day" for one and "N days" otherwise, zero included', () => {
    expect(formatDayCount(1)).toBe('1 day')
    expect(formatDayCount(2)).toBe('2 days')
    expect(formatDayCount(5)).toBe('5 days')
    expect(formatDayCount(0)).toBe('0 days')
  })
})
