import { describe, expect, it } from 'vitest'
import { costSummaryFor } from './costs'
import { fixture } from './fixture'
import { coldOpenDecisions } from './testSupport'
import type { ReplacementBooking, VehicleId } from './types'

const WEEK_40 = '2026-09-28'

describe('costSummaryFor', () => {
  it('sums service and cover cost only for items with a scheduled visit', () => {
    const summary = costSummaryFor({ fixture, weekId: WEEK_40, decisions: coldOpenDecisions(), bookings: {} })
    // Visited at cold open: V-012 (480+700), V-103 (620+140), V-118 (340+140).
    // V-041 is undisposed and V-027 is watched, so neither contributes.
    expect(summary.serviceCostEur).toBe(480 + 620 + 340)
    expect(summary.coverCostEur).toBe(700 + 140 + 140)
    expect(summary.totalEur).toBe(summary.serviceCostEur + summary.coverCostEur)
  })

  it('adds a booking cost on top of the item-level cover cost', () => {
    const bookings: Record<VehicleId, ReplacementBooking> = {
      'V-027': { vehicleId: 'V-027', startDate: '2026-09-29', days: 2 },
    }
    const withBooking = costSummaryFor({ fixture, weekId: WEEK_40, decisions: coldOpenDecisions(), bookings })
    const without = costSummaryFor({ fixture, weekId: WEEK_40, decisions: coldOpenDecisions(), bookings: {} })
    expect(withBooking.coverCostEur).toBe(without.coverCostEur + 2 * fixture.replacementDayRateEur)
    expect(withBooking.serviceCostEur).toBe(without.serviceCostEur)
  })

  it('reports no overage under budget, and the exact overage above it', () => {
    const under = costSummaryFor({ fixture, weekId: WEEK_40, decisions: coldOpenDecisions(), bookings: {} })
    expect(under.overByEur).toBeNull()
    expect(under.budgetEur).toBe(3000)

    const bigBookings: Record<VehicleId, ReplacementBooking> = {
      'V-001': { vehicleId: 'V-001', startDate: '2026-09-28', days: 5 },
      'V-002': { vehicleId: 'V-002', startDate: '2026-09-28', days: 5 },
    }
    const over = costSummaryFor({ fixture, weekId: WEEK_40, decisions: coldOpenDecisions(), bookings: bigBookings })
    expect(over.overByEur).toBe(over.totalEur - over.budgetEur)
    expect(over.overByEur).toBeGreaterThan(0)
  })

  it('never counts an item that is watched or undecided', () => {
    const summary = costSummaryFor({ fixture, weekId: WEEK_40, decisions: {}, bookings: {} })
    expect(summary.serviceCostEur).toBe(0)
    expect(summary.coverCostEur).toBe(0)
    expect(summary.totalEur).toBe(0)
  })
})
