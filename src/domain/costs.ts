import { weekFixtureFor } from './capacity'
import { bookingCostEur, bookingsForVisits } from './replacementBooking'
import type { DraftDecision, Fixture, ItemId, ReplacementBooking, VehicleId, WeekId } from './types'
import { visitsFromDecisions } from './visits'

export interface CostSummary {
  serviceCostEur: number
  coverCostEur: number
  totalEur: number
  budgetEur: number
  overByEur: number | null
}

/**
 * One function for both the live dashboard and the frozen commit summary, so
 * cost can never disagree with itself between the two surfaces the way
 * capacity once did (5bbdec1, 25dee47). [replacement cover spec §4.2]
 *
 * Service cost is charged for every item with a visit this week. Cover cost
 * is charged only for a replacement the user actually requested, and only
 * while its vehicle has a visit; the pre-confirmed rentals R-1 and R-2 are
 * fixture inputs, like the budget itself, and never enter this total.
 * Operational disruption is not part of it either: it stays a count, never
 * money [C §3.6, as amended 2026-09-24]. [scenario spec §5.6]
 */
export function costSummaryFor(args: {
  fixture: Fixture
  weekId: WeekId
  decisions: Record<ItemId, DraftDecision>
  bookings: Record<VehicleId, ReplacementBooking>
}): CostSummary {
  const { fixture, weekId, decisions, bookings } = args
  const week = weekFixtureFor(fixture, weekId)
  const visits = visitsFromDecisions(decisions, fixture.items)
  const visitedItemIds = new Set(visits.map((v) => v.itemId))

  let serviceCostEur = 0
  for (const item of fixture.items) {
    if (visitedItemIds.has(item.id)) serviceCostEur += item.consequence.serviceCostEur ?? 0
  }

  let coverCostEur = 0
  for (const booking of Object.values(bookingsForVisits(bookings, visits))) {
    coverCostEur += bookingCostEur(booking, fixture.replacementDayRateEur)
  }

  const totalEur = serviceCostEur + coverCostEur
  const overByEur = totalEur > week.budgetEur ? totalEur - week.budgetEur : null

  return { serviceCostEur, coverCostEur, totalEur, budgetEur: week.budgetEur, overByEur }
}
