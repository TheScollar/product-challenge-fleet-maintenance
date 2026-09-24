import { weekDays } from './clock'
import type {
  Cover,
  DayCapacity,
  Fixture,
  ISODate,
  Vehicle,
  VehicleClass,
  VehicleId,
  Visit,
  WeekFixture,
  WeekId,
} from './types'
import { visitCoversDate } from './visits'

/**
 * Weeks the fixture does not author fall back to a default template:
 * normal demand, R-1 only, and no new items. Week 41 is no longer an
 * example of this fallback; it authors its own items. [S 3.7]
 */
export function weekFixtureFor(fixture: Fixture, weekId: WeekId): WeekFixture {
  const authored = fixture.weeks.find((w) => w.weekId === weekId)
  if (authored) return authored
  return {
    weekId,
    days: weekDays(weekId),
    demand: fixture.defaultDemand,
    coverIds: fixture.defaultCoverIds,
    itemIds: [],
    budgetEur: fixture.defaultBudgetEur,
  }
}

/** A hold is never cleared, only stamped with a release, so "held" is always
 *  a question about a specific date. */
export function isHeldOn(vehicle: Vehicle, date: ISODate): boolean {
  const hold = vehicle.hold
  return hold !== null && (hold.releaseRecordedOn === null || date < hold.releaseRecordedOn)
}

/**
 * One Set, so a vehicle that is both held and booked counts once. [S 3.1]
 * A hold persists until the fixture records a release on or before the day.
 */
export function unavailableOn(
  date: ISODate,
  vehicles: Vehicle[],
  visits: Visit[],
): Set<VehicleId> {
  const out = new Set<VehicleId>()
  for (const vehicle of vehicles) {
    if (isHeldOn(vehicle, date)) {
      out.add(vehicle.id)
    }
  }
  for (const visit of visits) {
    if (visitCoversDate(visit, date)) out.add(visit.vehicleId)
  }
  return out
}

export function computeDayCapacity(args: {
  date: ISODate
  vehicleClass: VehicleClass
  fixture: Fixture
  visits: Visit[]
  week: WeekFixture
  adHocCovers?: Cover[]
}): DayCapacity {
  const { date, vehicleClass, fixture, visits, week, adHocCovers = [] } = args
  const inClass = fixture.vehicles.filter((v) => v.vehicleClass === vehicleClass)
  const unavailableAll = unavailableOn(date, fixture.vehicles, visits)
  const unavailable = inClass.filter((v) => unavailableAll.has(v.id)).map((v) => v.id)

  // Cover carries its own class, so a standard rental can never close a
  // specialist gap. The data model does not allow it. [S 3.1]
  const poolCover = fixture.covers.filter(
    (c) =>
      week.coverIds.includes(c.id) &&
      c.vehicleClass === vehicleClass &&
      c.confirmedDates.includes(date),
  ).length
  // A requested replacement booking is merged in as an indistinguishable
  // extra cover source, so it clears a shortfall exactly like R-1 or R-2
  // does, with no second capacity mechanism to keep in sync. [replacement
  // cover spec §4.1]
  const extraCover = adHocCovers.filter(
    (c) => c.vehicleClass === vehicleClass && c.confirmedDates.includes(date),
  ).length
  const cover = poolCover + extraCover

  const owned = inClass.length
  const available = owned - unavailable.length + cover
  const demand = vehicleClass === 'standard' ? week.demand.standard : week.demand.specialist

  return {
    date,
    vehicleClass,
    owned,
    unavailable,
    cover,
    available,
    demand,
    shortfall: Math.max(0, demand - available),
  }
}

export function computeWeekCapacity(args: {
  fixture: Fixture
  weekId: WeekId
  visits: Visit[]
  adHocCovers?: Cover[]
}): DayCapacity[] {
  const { fixture, weekId, visits, adHocCovers = [] } = args
  const week = weekFixtureFor(fixture, weekId)
  const classes: VehicleClass[] = ['standard', 'specialist']
  return week.days.flatMap((date) =>
    classes.map((vehicleClass) =>
      computeDayCapacity({ date, vehicleClass, fixture, visits, week, adHocCovers }),
    ),
  )
}
