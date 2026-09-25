import { describe, expect, it } from 'vitest'
import { costSummaryFor } from './costs'
import { fixture } from './fixture'
import { proposedDecisions } from './testSupport'
import { draftFor, initialState } from '../state/planReducer'
import type { DraftDecision, ItemId, ReplacementBooking, VehicleId } from './types'

const WEEK_40 = '2026-09-28'
const rate = fixture.replacementDayRateEur

describe('costSummaryFor', () => {
  it('charges nothing at the true cold open, where nothing is decided', () => {
    const open = draftFor({ fixture, state: initialState(fixture), weekId: WEEK_40 })
    expect(costSummaryFor({ fixture, weekId: WEEK_40, decisions: open, bookings: {} })).toEqual({
      serviceCostEur: 0,
      coverCostEur: 0,
      totalEur: 0,
      budgetEur: 3000,
      overByEur: null,
    })
  })

  it('sums service cost for visited items only, and no cover until one is requested', () => {
    const s = costSummaryFor({ fixture, weekId: WEEK_40, decisions: proposedDecisions(), bookings: {} })
    // Visited once adopted: V-012 (480), V-103 (620), V-118 (340). V-041 has
    // no slot and V-027 is watched, so neither contributes.
    expect(s.serviceCostEur).toBe(480 + 620 + 340)
    expect(s.coverCostEur).toBe(0)
    expect(s.totalEur).toBe(1440)
  })

  it('adds a requested booking for a visiting vehicle', () => {
    const bookings: Record<VehicleId, ReplacementBooking> = {
      'V-012': { vehicleId: 'V-012', startDate: '2026-09-28', days: 5 },
    }
    const s = costSummaryFor({ fixture, weekId: WEEK_40, decisions: proposedDecisions(), bookings })
    expect(s.coverCostEur).toBe(5 * rate)
    expect(s.totalEur).toBe(1440 + 5 * rate)
  })

  it('ignores a booking for a vehicle without a visit', () => {
    const bookings: Record<VehicleId, ReplacementBooking> = {
      'V-027': { vehicleId: 'V-027', startDate: '2026-09-29', days: 2 },
    }
    const s = costSummaryFor({ fixture, weekId: WEEK_40, decisions: proposedDecisions(), bookings })
    expect(s.coverCostEur).toBe(0)
    expect(s.totalEur).toBe(1440)
  })

  it('never counts an item that is watched or undecided', () => {
    const decisions: Record<ItemId, DraftDecision> = {
      'item-v012': { itemId: 'item-v012', treatment: 'act-now', slotDate: '2026-09-29', deferral: null },
      'item-v041': { itemId: 'item-v041', treatment: 'watch', slotDate: null, deferral: null },
      'item-v027': { itemId: 'item-v027', treatment: null, slotDate: null, deferral: null },
    }
    const s = costSummaryFor({ fixture, weekId: WEEK_40, decisions, bookings: {} })
    expect(s.serviceCostEur).toBe(480)
    expect(s.coverCostEur).toBe(0)
    expect(s.totalEur).toBe(480)
  })

  it('reports no overage under budget, and the exact overage above it', () => {
    const under = costSummaryFor({ fixture, weekId: WEEK_40, decisions: proposedDecisions(), bookings: {} })
    expect(under.overByEur).toBeNull()
    expect(under.budgetEur).toBe(3000)

    // Five days of cover for each of the three visiting vans: 3 × 700 on top of 1,440.
    const bookings: Record<VehicleId, ReplacementBooking> = {
      'V-012': { vehicleId: 'V-012', startDate: '2026-09-28', days: 5 },
      'V-103': { vehicleId: 'V-103', startDate: '2026-09-28', days: 5 },
      'V-118': { vehicleId: 'V-118', startDate: '2026-09-28', days: 5 },
    }
    const over = costSummaryFor({ fixture, weekId: WEEK_40, decisions: proposedDecisions(), bookings })
    expect(over.totalEur).toBe(1440 + 3 * 5 * rate)
    expect(over.overByEur).toBe(1440 + 3 * 5 * rate - 3000)
  })
})
