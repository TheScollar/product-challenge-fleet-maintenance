import { weekFixtureFor } from './capacity'
import { addDays } from './clock'
import type { Cover, Fixture, ReplacementBooking, VehicleId, Visit, WeekId } from './types'

/**
 * Structural, not trusting: the standard-only rule is checked here too, not
 * only by the control that disables itself. [spec §8]
 */
export function replacementBookingErrors(
  draft: Partial<ReplacementBooking> | null,
  args: { fixture: Fixture; weekId: WeekId },
): string[] {
  const { fixture, weekId } = args
  if (!draft || !draft.vehicleId) return ['A vehicle is required']

  const vehicle = fixture.vehicles.find((v) => v.id === draft.vehicleId)
  if (!vehicle) return ['Unknown vehicle']

  const errors: string[] = []
  if (vehicle.vehicleClass !== 'standard') errors.push('No specialist replacement cover exists')
  if (!draft.startDate) errors.push('A start date is required')
  if (draft.days === undefined || draft.days === null || !Number.isInteger(draft.days) || draft.days < 1) {
    errors.push('At least one day is required')
  }

  if (draft.startDate && draft.days !== undefined && draft.days !== null && draft.days >= 1) {
    const week = weekFixtureFor(fixture, weekId)
    const startIndex = week.days.indexOf(draft.startDate)
    if (startIndex === -1) {
      errors.push('Start date must fall within the active week')
    } else if (startIndex + draft.days > week.days.length) {
      errors.push('The booking cannot extend beyond the active week')
    }
  }

  return errors
}

export function isReplacementBookingComplete(
  draft: Partial<ReplacementBooking> | null,
  args: { fixture: Fixture; weekId: WeekId },
): boolean {
  return replacementBookingErrors(draft, args).length === 0
}

/** Only the decision is stored; cost and downtime are both derived. [spec §3.1] */
export function bookingCostEur(booking: ReplacementBooking, dayRateEur: number): number {
  return booking.days * dayRateEur
}

/**
 * A `Cover`-shaped view of one booking, so the capacity engine never has to
 * know a second kind of cover exists. [spec §3.2, §4.1]
 */
export function bookingAsCover(booking: ReplacementBooking, dayRateEur: number): Cover {
  return {
    id: `${booking.vehicleId} replacement`,
    vehicleClass: 'standard',
    confirmedDates: Array.from({ length: booking.days }, (_, n) => addDays(booking.startDate, n)),
    dayRateEur,
  }
}

export function adHocCoversFrom(
  bookings: Record<VehicleId, ReplacementBooking>,
  dayRateEur: number,
): Cover[] {
  return Object.values(bookings).map((b) => bookingAsCover(b, dayRateEur))
}

/**
 * A replacement belongs to a visit. Every reader filters through here first,
 * so a booking that reached storage by any route other than the reducer, or
 * that outlived its visit, adds neither capacity nor cost. Structural, not
 * trusting, like deferralRecordsFrom. [scenario spec §5.4]
 */
export function bookingsForVisits(
  bookings: Record<VehicleId, ReplacementBooking>,
  visits: Visit[],
): Record<VehicleId, ReplacementBooking> {
  const visiting = new Set(visits.map((v) => v.vehicleId))
  return Object.fromEntries(Object.entries(bookings).filter(([vehicleId]) => visiting.has(vehicleId)))
}
