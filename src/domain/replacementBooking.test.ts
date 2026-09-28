import { describe, expect, it } from 'vitest'
import {
  adHocCoversFrom,
  bookingAsCover,
  bookingCostEur,
  canCarryBooking,
  eligibleBookings,
  replacementBookingErrors,
} from './replacementBooking'
import { fixture } from './fixture'
import type { ReplacementBooking, Visit } from './types'

const WEEK_40 = '2026-09-28'

describe('replacementBookingErrors', () => {
  it('requires a vehicle', () => {
    expect(replacementBookingErrors(null, { fixture, weekId: WEEK_40 })).toEqual(['A vehicle is required'])
  })

  it('rejects an unknown vehicle', () => {
    expect(
      replacementBookingErrors(
        { vehicleId: 'V-999', startDate: '2026-09-29', days: 1 },
        { fixture, weekId: WEEK_40 },
      ),
    ).toEqual(['Unknown vehicle'])
  })

  it('rejects a specialist vehicle', () => {
    const errors = replacementBookingErrors(
      { vehicleId: 'V-041', startDate: '2026-09-29', days: 1 },
      { fixture, weekId: WEEK_40 },
    )
    expect(errors).toContain('No specialist replacement cover exists')
  })

  it('names a missing start date and a missing day count separately', () => {
    const errors = replacementBookingErrors({ vehicleId: 'V-027' }, { fixture, weekId: WEEK_40 })
    expect(errors).toContain('A start date is required')
    expect(errors).toContain('At least one day is required')
  })

  it('rejects a start date outside the active week', () => {
    const errors = replacementBookingErrors(
      { vehicleId: 'V-027', startDate: '2026-10-05', days: 1 },
      { fixture, weekId: WEEK_40 },
    )
    expect(errors).toContain('Start date must fall within the active week')
  })

  it('rejects a fractional day count', () => {
    const errors = replacementBookingErrors(
      { vehicleId: 'V-027', startDate: '2026-09-29', days: 1.5 },
      { fixture, weekId: WEEK_40 },
    )
    expect(errors).toContain('At least one day is required')
  })

  it('rejects a range that overruns the week', () => {
    const errors = replacementBookingErrors(
      { vehicleId: 'V-027', startDate: '2026-10-02', days: 2 },
      { fixture, weekId: WEEK_40 },
    )
    expect(errors).toContain('The booking cannot extend beyond the active week')
  })

  it('accepts a valid one-day booking', () => {
    const booking = { vehicleId: 'V-027', startDate: '2026-09-29', days: 1 }
    expect(replacementBookingErrors(booking, { fixture, weekId: WEEK_40 })).toEqual([])
  })

  it('accepts a booking that fills the whole week', () => {
    const booking = { vehicleId: 'V-027', startDate: '2026-09-28', days: 5 }
    expect(replacementBookingErrors(booking, { fixture, weekId: WEEK_40 })).toEqual([])
  })
})

describe('bookingCostEur', () => {
  it('multiplies days by the day rate', () => {
    const booking: ReplacementBooking = { vehicleId: 'V-027', startDate: '2026-09-29', days: 3 }
    expect(bookingCostEur(booking, fixture.replacementDayRateEur)).toBe(3 * fixture.replacementDayRateEur)
  })
})

describe('bookingAsCover', () => {
  it('expands into one confirmed date per day, always standard class', () => {
    const booking: ReplacementBooking = { vehicleId: 'V-027', startDate: '2026-09-29', days: 2 }
    const cover = bookingAsCover(booking, 140)
    expect(cover.vehicleClass).toBe('standard')
    expect(cover.confirmedDates).toEqual(['2026-09-29', '2026-09-30'])
    expect(cover.dayRateEur).toBe(140)
    expect(cover.id).toBe('V-027 replacement')
  })
})

describe('adHocCoversFrom', () => {
  it('converts every booking in the map', () => {
    const covers = adHocCoversFrom(
      {
        'V-027': { vehicleId: 'V-027', startDate: '2026-09-29', days: 1 },
        'V-105': { vehicleId: 'V-105', startDate: '2026-09-30', days: 1 },
      },
      140,
    )
    expect(covers).toHaveLength(2)
    expect(covers.map((c) => c.confirmedDates[0]).sort()).toEqual(['2026-09-29', '2026-09-30'])
  })

  it('returns an empty array for no bookings', () => {
    expect(adHocCoversFrom({}, 140)).toEqual([])
  })
})

describe('eligibleBookings', () => {
  const v103: ReplacementBooking = { vehicleId: 'V-103', startDate: '2026-09-29', days: 1 }
  const v012: ReplacementBooking = { vehicleId: 'V-012', startDate: '2026-10-05', days: 1 }
  const v027: ReplacementBooking = { vehicleId: 'V-027', startDate: '2026-09-29', days: 1 }
  const visitV103: Visit = {
    itemId: 'item-v103',
    vehicleId: 'V-103',
    garageId: 'werkstatt-berg',
    startDate: '2026-09-29',
    days: 1,
    scope: 'suspension',
  }

  it('keeps a booking whose vehicle has a visit this week', () => {
    const kept = eligibleBookings({ 'V-103': v103 }, { fixture, weekId: WEEK_40, visits: [visitV103] })
    expect(kept).toEqual({ 'V-103': v103 })
  })

  it('keeps a booking for a vehicle held this week with no visit', () => {
    const kept = eligibleBookings({ 'V-012': v012 }, { fixture, weekId: '2026-10-05', visits: [] })
    expect(kept).toEqual({ 'V-012': v012 })
  })

  it('drops a booking for a vehicle neither visiting nor held', () => {
    expect(eligibleBookings({ 'V-027': v027 }, { fixture, weekId: WEEK_40, visits: [] })).toEqual({})
  })

  it('drops a held vehicle once its hold has ended before the week', () => {
    const later = { vehicleId: 'V-012', startDate: '2026-10-12', days: 1 }
    expect(eligibleBookings({ 'V-012': later }, { fixture, weekId: '2026-10-12', visits: [] })).toEqual({})
  })
})

describe('canCarryBooking', () => {
  it('is true for V-012 in week 41, on its hold alone', () => {
    expect(canCarryBooking('V-012', { fixture, weekId: '2026-10-05', visits: [] })).toBe(true)
  })
  it('is false for an idle van', () => {
    expect(canCarryBooking('V-027', { fixture, weekId: WEEK_40, visits: [] })).toBe(false)
  })
})
