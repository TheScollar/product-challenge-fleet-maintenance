import { weekFixtureFor } from './capacity'
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
 * Operational disruption is not part of this total: it stays a count,
 * never money, per the cover note's "three cost figures stay apart"
 * [C §3.6]. This function deliberately narrows that principle to combine
 * only service cost and cover cost, which are both spend.
 */
export function costSummaryFor(args: {
  fixture: Fixture
  weekId: WeekId
  decisions: Record<ItemId, DraftDecision>
  bookings: Record<VehicleId, ReplacementBooking>
}): CostSummary {
  const { fixture, weekId, decisions, bookings } = args
  const week = weekFixtureFor(fixture, weekId)
  const visitedItemIds = new Set(visitsFromDecisions(decisions, fixture.items).map((v) => v.itemId))

  let serviceCostEur = 0
  let coverCostEur = 0
  for (const item of fixture.items) {
    if (!visitedItemIds.has(item.id)) continue
    serviceCostEur += item.consequence.serviceCostEur ?? 0
    coverCostEur += item.consequence.coverCostEur ?? 0
  }
  for (const booking of Object.values(bookings)) {
    coverCostEur += booking.days * fixture.replacementDayRateEur
  }

  const totalEur = serviceCostEur + coverCostEur
  const overByEur = totalEur > week.budgetEur ? totalEur - week.budgetEur : null

  return { serviceCostEur, coverCostEur, totalEur, budgetEur: week.budgetEur, overByEur }
}
