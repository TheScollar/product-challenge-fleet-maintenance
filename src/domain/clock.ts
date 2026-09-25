import type { Fixture, ISODate, Vehicle, WeekId } from './types'

const MS_PER_DAY = 24 * 60 * 60 * 1000

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Every Date in this module is UTC, so no local timezone can shift a day. */
export function parseISO(d: ISODate): Date {
  const parsed = new Date(`${d}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid ISODate: ${d}`)
  return parsed
}

export function toISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10)
}

export function addDays(d: ISODate, n: number): ISODate {
  return toISO(new Date(parseISO(d).getTime() + n * MS_PER_DAY))
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / MS_PER_DAY)
}

/**
 * The Monday of the week containing `d`, or the next Monday if `d` is a
 * weekend. The plan week follows the demo clock. [S 3.7]
 */
export function mondayOf(d: ISODate): WeekId {
  const dow = parseISO(d).getUTCDay() // 0 = Sunday
  const delta = dow === 0 ? 1 : dow === 6 ? 2 : 1 - dow
  return addDays(d, delta)
}

export function weekDays(monday: WeekId): ISODate[] {
  return [0, 1, 2, 3, 4].map((n) => addDays(monday, n))
}

/** Display only. The state layer keys weeks by their Monday, not by number. */
export function isoWeekNumber(d: ISODate): number {
  const t = parseISO(d)
  const mondayIndex = (t.getUTCDay() + 6) % 7
  t.setUTCDate(t.getUTCDate() - mondayIndex + 3) // the Thursday of this week
  const jan4 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4))
  const jan4MondayIndex = (jan4.getUTCDay() + 6) % 7
  jan4.setUTCDate(jan4.getUTCDate() - jan4MondayIndex + 3)
  return 1 + Math.round((t.getTime() - jan4.getTime()) / (7 * MS_PER_DAY))
}

export function formatDay(d: ISODate): string {
  const t = parseISO(d)
  return `${DAYS_SHORT[t.getUTCDay()]} ${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}`
}

export function formatLongDay(d: ISODate): string {
  const t = parseISO(d)
  return `${DAYS_LONG[t.getUTCDay()]} ${t.getUTCDate()} ${MONTHS_LONG[t.getUTCMonth()]} ${t.getUTCFullYear()}`
}

/** A count of days, read as "1 day", "3 days", "0 days". One definition for every surface. */
export function formatDayCount(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'}`
}

/**
 * Odometer triggers project against this rather than against live data,
 * so advancing the clock is the only action needed to fire one. [S 3.6]
 */
export function projectedOdometerKm(vehicle: Vehicle, on: ISODate): number {
  const elapsed = daysBetween(vehicle.odometerReadOn, on)
  if (elapsed <= 0) return vehicle.odometerKm
  return Math.round(vehicle.odometerKm + (vehicle.weeklyRateKm / 7) * elapsed)
}

export function hasEventFired(fixture: Fixture, eventId: string, on: ISODate): boolean {
  const event = fixture.events.find((e) => e.eventId === eventId)
  if (!event) return false
  return on >= event.firesOn
}
