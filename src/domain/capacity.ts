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
 * normal demand, no cover, and no new items. Week 41 is no longer an
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

/** A day override wins for the class it names; everything else is the week's. [no pool cover spec D5] */
export function demandOn(week: WeekFixture, date: ISODate, vehicleClass: VehicleClass): number {
  return week.demandByDay?.[date]?.[vehicleClass] ?? week.demand[vehicleClass]
}

/** A hold is never cleared, only stamped with a release, so "held" is always
 *  a question about a specific date. */
export function isHeldOn(vehicle: Vehicle, date: ISODate): boolean {
  const hold = vehicle.hold
  return hold !== null && (hold.releaseRecordedOn === null || date < hold.releaseRecordedOn)
}

/** The first of `vehicleIds` held on `date`, or null. One definition for the
 *  shortfall chip and the band cell. [no pool cover spec §2.2] */
export function heldAmong(vehicleIds: VehicleId[], date: ISODate, fixture: Fixture): VehicleId | null {
  return (
    vehicleIds.find((id) => {
      const v = fixture.vehicles.find((x) => x.id === id)
      return v !== undefined && isHeldOn(v, date)
    }) ?? null
  )
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

  // Cover carries its own class, so a standard replacement can never close a
  // specialist gap. The data model does not allow it. [S 3.1]
  const poolCovers = fixture.covers.filter(
    (c) =>
      week.coverIds.includes(c.id) &&
      c.vehicleClass === vehicleClass &&
      c.confirmedDates.includes(date),
  )
  // A requested replacement booking is merged in as an extra cover source,
  // so it clears a shortfall with no second capacity mechanism to keep in
  // sync. [replacement cover spec §4.1, as amended by no pool cover spec D1]
  const extraCovers = adHocCovers.filter(
    (c) => c.vehicleClass === vehicleClass && c.confirmedDates.includes(date),
  )
  const coverIds = [...poolCovers, ...extraCovers].map((c) => c.id)
  const cover = coverIds.length

  const owned = inClass.length
  const available = owned - unavailable.length + cover
  const demand = demandOn(week, date, vehicleClass)

  return {
    date,
    vehicleClass,
    owned,
    unavailable,
    cover,
    coverIds,
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

/**
 * Own vans and replacements, stated separately, so a day where replacements
 * outnumber outages reads `37 + 2 / 38` rather than one total larger than
 * the fleet. The `+ n` term appears only where cover exists. Short, spare,
 * impacted and candidate states still key off `available` against `demand`;
 * this changes the words, not the arithmetic. [scenario spec §7]
 */
export function capacityFigure(day: DayCapacity): string {
  const own = day.owned - day.unavailable.length
  return day.cover > 0 ? `${own} + ${day.cover} / ${day.demand}` : `${own} / ${day.demand}`
}

/** The parts behind the figure, for the cell's tooltip. [scenario spec §7] */
export function capacityBreakdown(day: DayCapacity): string {
  const offRoad =
    day.unavailable.length === 0 ? 'none off the road' : `off the road: ${day.unavailable.join(', ')}`
  const cover =
    day.coverIds.length === 0 ? 'no replacement on site' : `replacements on site: ${day.coverIds.join(', ')}`
  return `${day.owned} owned · ${offRoad} · ${cover}`
}
