import { weekFixtureFor } from './capacity'
import { addDays, formatDay } from './clock'
import type {
  Blocker,
  DraftDecision,
  Fixture,
  ISODate,
  ItemId,
  OpenItem,
  Visit,
  WeekId,
} from './types'
import { visitCoversDate, visitsFromDecisions } from './visits'

export interface SlotOption {
  date: ISODate
  feasible: boolean
  reasons: string[]
}

function coveredDates(start: ISODate, days: number): ISODate[] {
  return Array.from({ length: days }, (_, n) => addDays(start, n))
}

function freeBaysOn(fixture: Fixture, garageId: string, date: ISODate): number | null {
  const garage = fixture.garages.find((g) => g.id === garageId)
  const day = garage?.days.find((d) => d.date === date)
  return day ? day.freeBays : null
}

function baysUsedOn(visits: Visit[], garageId: string, date: ISODate, excludeItemId: ItemId): number {
  return visits.filter(
    (v) => v.garageId === garageId && v.itemId !== excludeItemId && visitCoversDate(v, date),
  ).length
}

/**
 * Returns EVERY applicable reason rather than the first. Monday blocks V-012
 * on both the bay and the parts date, and reporting one would mislead. [S 3.8]
 */
export function slotBlockers(args: {
  item: OpenItem
  date: ISODate
  fixture: Fixture
  visits: Visit[]
}): Blocker[] {
  const { item, date, fixture, visits } = args
  const out: Blocker[] = []
  const reasons: string[] = []

  for (const day of coveredDates(date, item.visitDays)) {
    const free = freeBaysOn(fixture, item.garageId, day)
    const garageName = fixture.garages.find((g) => g.id === item.garageId)?.name ?? item.garageId
    if (free === null) {
      reasons.push(`${garageName} has no opening hours on ${formatDay(day)}`)
      continue
    }
    if (free - baysUsedOn(visits, item.garageId, day, item.id) < 1) {
      reasons.push(`${garageName} is fully booked on ${formatDay(day)}`)
    }
  }
  if (reasons.length > 0) out.push({ kind: 'infeasible-slot', itemId: item.id, reasons })

  if (item.parts && date < item.parts.readyOn) {
    out.push({
      kind: 'parts-not-ready',
      itemId: item.id,
      partName: item.parts.name,
      readyOn: item.parts.readyOn,
    })
  }
  return out
}

export function slotOptions(args: {
  item: OpenItem
  fixture: Fixture
  decisions: Record<ItemId, DraftDecision>
  weekId: WeekId
}): SlotOption[] {
  const { item, fixture, decisions, weekId } = args
  const week = weekFixtureFor(fixture, weekId)
  const visits = visitsFromDecisions(decisions, fixture.items)

  return week.days.map((date) => {
    const blockers = slotBlockers({ item, date, fixture, visits })
    const reasons = blockers.flatMap((b) =>
      b.kind === 'infeasible-slot'
        ? b.reasons
        : b.kind === 'parts-not-ready'
          ? [`${b.partName} ready ${formatDay(b.readyOn)}`]
          : [],
    )
    return { date, feasible: reasons.length === 0, reasons }
  })
}
