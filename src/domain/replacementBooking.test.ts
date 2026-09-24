import { describe, expect, it } from 'vitest'
import {
  adHocCoversFrom,
  bookingAsCover,
  bookingCostEur,
  isReplacementBookingComplete,
  replacementBookingErrors,
} from './replacementBooking'
import { fixture } from './fixture'
import type { ReplacementBooking } from './types'

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
    expect(isReplacementBookingComplete(booking, { fixture, weekId: WEEK_40 })).toBe(true)
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
