import { weekDays } from './clock'
import type {
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
 * Weeks the fixture does not author fall back to the week 41 template:
 * normal demand, R-1 only, and no new items. [S 3.7]
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
  }
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
    const hold = vehicle.hold
    if (hold && (hold.releaseRecordedOn === null || date < hold.releaseRecordedOn)) {
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
}): DayCapacity {
  const { date, vehicleClass, fixture, visits, week } = args
  const inClass = fixture.vehicles.filter((v) => v.vehicleClass === vehicleClass)
  const unavailableAll = unavailableOn(date, fixture.vehicles, visits)
  const unavailable = inClass.filter((v) => unavailableAll.has(v.id)).map((v) => v.id)

  // Cover carries its own class, so a standard rental can never close a
  // specialist gap. The data model does not allow it. [S 3.1]
  const cover = fixture.covers.filter(
    (c) =>
      week.coverIds.includes(c.id) &&
      c.vehicleClass === vehicleClass &&
      c.confirmedDates.includes(date),
  ).length

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
}): DayCapacity[] {
  const { fixture, weekId, visits } = args
  const week = weekFixtureFor(fixture, weekId)
  const classes: VehicleClass[] = ['standard', 'specialist']
  return week.days.flatMap((date) =>
    classes.map((vehicleClass) =>
      computeDayCapacity({ date, vehicleClass, fixture, visits, week }),
    ),
  )
}
