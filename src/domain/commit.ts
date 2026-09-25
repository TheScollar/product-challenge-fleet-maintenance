import { computeDayCapacity, computeWeekCapacity, isHeldOn, unavailableOn, weekFixtureFor } from './capacity'
import { formatDay, formatLongDay } from './clock'
import { adHocCoversFrom, bookingsForVisits } from './replacementBooking'
import type {
  CommittedPlan,
  DayCapacity,
  DeferralRecord,
  DraftDecision,
  Fixture,
  ISODate,
  ItemId,
  ReplacementBooking,
  VehicleClass,
  VehicleId,
  WeekId,
} from './types'
import { visitCoversDate, visitsFromDecisions } from './visits'

/**
 * The snapshot is a deep copy, so editing the draft afterwards leaves the
 * last committed plan intact until recommit. [S 2.3] `bookings` defaults to
 * empty so every existing caller keeps compiling unchanged. [replacement
 * cover spec §5]
 */
export function commitPlan(args: {
  weekId: WeekId
  decisions: Record<ItemId, DraftDecision>
  bookings?: Record<VehicleId, ReplacementBooking>
  demoDate: ISODate
}): CommittedPlan {
  const { weekId, decisions, bookings = {}, demoDate } = args
  return {
    weekId,
    committedOn: demoDate,
    decisions: JSON.parse(JSON.stringify(decisions)) as Record<ItemId, DraftDecision>,
    bookings: JSON.parse(JSON.stringify(bookings)) as Record<VehicleId, ReplacementBooking>,
  }
}

/**
 * Structural, not trusting: a follow-up exists only where the treatment is
 * watch. A decision moved to a visit keeps no deferral, whatever its stored
 * deferral field still says.
 */
export function deferralRecordsFrom(plan: CommittedPlan): DeferralRecord[] {
  return Object.values(plan.decisions)
    .filter((d) => d.treatment === 'watch' && d.deferral !== null)
    .map((d) => ({
      itemId: d.itemId,
      deferral: d.deferral!,
      decidedOn: plan.committedOn,
      weekId: plan.weekId,
    }))
    .sort((a, b) => a.itemId.localeCompare(b.itemId))
}

export interface CommitSummaryView {
  weekId: WeekId
  committedOn: ISODate
  visits: Array<{
    itemId: ItemId
    vehicleId: VehicleId
    garage: string
    dateLabel: string
    days: number
    scope: string
  }>
  availability: DayCapacity[]
  coverAssumptions: string[]
  /** The committed bookings that still have a visit to cover, sorted by vehicle. Stale or
   *  hand-edited bookings for a vehicle with no visit are excluded here, exactly as they are
   *  excluded from capacity and cost. [scenario spec §5.4] */
  bookings: ReplacementBooking[]
  deferrals: Array<{
    itemId: ItemId
    vehicleId: VehicleId
    title: string
    reason: string
    reviewDate: ISODate
    triggerLabel: string
  }>
  holds: Array<{ vehicleId: VehicleId; reason: string; releaseRecordedOn: ISODate | null }>
}

export function summaryFor(args: { fixture: Fixture; plan: CommittedPlan }): CommitSummaryView {
  const { fixture, plan } = args
  const week = weekFixtureFor(fixture, plan.weekId)
  const visits = visitsFromDecisions(plan.decisions, fixture.items)
  const visitBookings = bookingsForVisits(plan.bookings, visits)
  // A committed replacement is cover in the summary too. Until now the band
  // counted it and this table did not. [scenario spec §6]
  const adHocCovers = adHocCoversFrom(visitBookings, fixture.replacementDayRateEur)

  const coverAssumptions = fixture.covers
    .filter((c) => week.coverIds.includes(c.id))
    .map((c) => {
      const inWeek = c.confirmedDates.filter((d) => week.days.includes(d))
      // A cover the week carries but no day confirms is stated as that, not as
      // a confirmed sentence with the days missing from it.
      if (inWeek.length === 0) return `${c.id}, ${c.vehicleClass} cover, not confirmed for any day this week.`
      return `${c.id}, ${c.vehicleClass} cover, confirmed ${inWeek.map(formatDay).join(', ')} at EUR ${c.dayRateEur} per day.`
    })
  if (!fixture.covers.some((c) => week.coverIds.includes(c.id) && c.vehicleClass === 'specialist')) {
    coverAssumptions.push('No specialist cover is available this week. A standard rental does not substitute.')
  }

  return {
    weekId: plan.weekId,
    committedOn: plan.committedOn,
    visits: visits.map((v) => ({
      itemId: v.itemId,
      vehicleId: v.vehicleId,
      garage: fixture.garages.find((g) => g.id === v.garageId)?.name ?? v.garageId,
      dateLabel: formatDay(v.startDate),
      days: v.days,
      scope: v.scope,
    })),
    availability: computeWeekCapacity({ fixture, weekId: plan.weekId, visits, adHocCovers }),
    coverAssumptions,
    bookings: Object.values(visitBookings).sort((a, b) => a.vehicleId.localeCompare(b.vehicleId)),
    // Same structural test as deferralRecordsFrom: the summary must not list a
    // van as a deferred follow-up when the same plan books it a visit.
    deferrals: Object.values(plan.decisions)
      .filter((d) => d.treatment === 'watch' && d.deferral !== null)
      .map((d) => {
        const item = fixture.items.find((i) => i.id === d.itemId)
        return {
          itemId: d.itemId,
          vehicleId: item?.vehicleId ?? '',
          title: item?.title ?? d.itemId,
          reason: d.deferral!.reason,
          reviewDate: d.deferral!.reviewDate,
          triggerLabel: d.deferral!.trigger.label,
        }
      })
      .sort((a, b) => a.itemId.localeCompare(b.itemId)),
    holds: fixture.vehicles
      .filter((v) => v.hold !== null)
      .map((v) => ({
        vehicleId: v.id,
        reason: v.hold!.reason,
        releaseRecordedOn: v.hold!.releaseRecordedOn,
      })),
  }
}

export interface DailyConfirmationView {
  date: ISODate
  dateLabel: string
  rows: DayCapacity[]
  offRoad: Array<{ vehicleId: VehicleId; reason: string }>
  coverInUse: string[]
}

/** Static and read-only. Route reassignment is not built: under a fleet with
 *  no reserve it cannot create capacity. [S 6.2, WP E8.4] */
export function dailyConfirmation(args: {
  fixture: Fixture
  plan: CommittedPlan
  forDate: ISODate
}): DailyConfirmationView {
  const { fixture, plan, forDate } = args
  const week = weekFixtureFor(fixture, plan.weekId)
  const visits = visitsFromDecisions(plan.decisions, fixture.items)
  const adHocCovers = adHocCoversFrom(bookingsForVisits(plan.bookings, visits), fixture.replacementDayRateEur)
  const classes: VehicleClass[] = ['standard', 'specialist']

  const offRoad = [...unavailableOn(forDate, fixture.vehicles, visits)]
    .sort()
    .map((vehicleId) => {
      const vehicle = fixture.vehicles.find((v) => v.id === vehicleId)
      const visit = visits.find((v) => v.vehicleId === vehicleId && visitCoversDate(v, forDate))
      if (vehicle && isHeldOn(vehicle, forDate)) {
        // The reason is shown as recorded. Lowercasing it to blend into the
        // sentence also mangled domain terms: UVV became uvv.
        return { vehicleId, reason: `Held out of service: ${vehicle.hold!.reason}` }
      }
      return { vehicleId, reason: `In for a visit: ${visit?.scope ?? 'scheduled work'}` }
    })

  return {
    date: forDate,
    dateLabel: formatLongDay(forDate),
    rows: classes.map((vehicleClass) =>
      computeDayCapacity({ date: forDate, vehicleClass, fixture, visits, week, adHocCovers }),
    ),
    offRoad,
    coverInUse: [
      ...fixture.covers.filter((c) => week.coverIds.includes(c.id) && c.confirmedDates.includes(forDate)),
      ...adHocCovers.filter((c) => c.confirmedDates.includes(forDate)),
    ]
      .map((c) => c.id)
      .sort(),
  }
}
