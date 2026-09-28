import { describe, expect, it } from 'vitest'
import { commitPlan, dailyConfirmation, deferralRecordsFrom, summaryFor } from './commit'
import { fixture } from './fixture'
import type { DraftDecision, Fixture, ItemId, ReplacementBooking, VehicleId } from './types'
import { proposedDecisions } from './testSupport'

const WEEK_40 = '2026-09-28'

function committable(): Record<ItemId, DraftDecision> {
  const d = proposedDecisions()
  d['item-v118'] = { ...d['item-v118'], slotDate: '2026-10-01' }
  d['item-v041'] = {
    itemId: 'item-v041',
    treatment: 'watch',
    slotDate: null,
    deferral: {
      reason: 'No specialist cover exists this week.',
      reviewDate: '2026-10-05',
      trigger: { kind: 'event', eventId: 'v041-dtc-recurs', label: 'DTC P0300 recurs' },
    },
  }
  return d
}

// The requested replacements of the walkthrough: V-012 is held all week with
// no pool cover, V-103 visits on Tuesday. [no pool cover spec §3.1]
const WALKTHROUGH_BOOKINGS: Record<VehicleId, ReplacementBooking> = {
  'V-012': { vehicleId: 'V-012', startDate: '2026-09-28', days: 5 },
  'V-103': { vehicleId: 'V-103', startDate: '2026-09-29', days: 1 },
}

describe('committing', () => {
  it('records the week and the demo date it was committed on', () => {
    const plan = commitPlan({ weekId: WEEK_40, decisions: committable(), demoDate: '2026-09-28' })
    expect(plan.weekId).toBe(WEEK_40)
    expect(plan.committedOn).toBe('2026-09-28')
  })

  it('produces an identical plan when committed twice from the same draft', () => {
    const decisions = committable()
    const first = commitPlan({ weekId: WEEK_40, decisions, demoDate: '2026-09-28' })
    const second = commitPlan({ weekId: WEEK_40, decisions, demoDate: '2026-09-28' })
    expect(second).toEqual(first)
  })

  it('never duplicates a visit across repeated commits', () => {
    const decisions = committable()
    const a = summaryFor({ fixture, plan: commitPlan({ weekId: WEEK_40, decisions, demoDate: '2026-09-28' }) })
    const b = summaryFor({ fixture, plan: commitPlan({ weekId: WEEK_40, decisions, demoDate: '2026-09-28' }) })
    expect(b.visits).toEqual(a.visits)
    expect(new Set(b.visits.map((v) => v.itemId)).size).toBe(b.visits.length)
  })

  it('does not mutate the draft it was given', () => {
    const decisions = committable()
    const snapshot = JSON.stringify(decisions)
    commitPlan({ weekId: WEEK_40, decisions, demoDate: '2026-09-28' })
    expect(JSON.stringify(decisions)).toBe(snapshot)
  })

  it('keeps the committed snapshot intact when the draft is edited afterwards', () => {
    const decisions = committable()
    const plan = commitPlan({ weekId: WEEK_40, decisions, demoDate: '2026-09-28' })
    decisions['item-v118'] = { ...decisions['item-v118'], slotDate: '2026-09-30' }
    expect(plan.decisions['item-v118'].slotDate).toBe('2026-10-01')
  })
})

describe('bookings travel with the commit', () => {
  it('snapshots a booking', () => {
    const bookings = { 'V-027': { vehicleId: 'V-027', startDate: '2026-09-29', days: 2 } }
    const plan = commitPlan({ weekId: WEEK_40, decisions: committable(), bookings, demoDate: '2026-09-28' })
    expect(plan.bookings['V-027']).toEqual(bookings['V-027'])
  })

  it('defaults to no bookings when none are given', () => {
    const plan = commitPlan({ weekId: WEEK_40, decisions: committable(), demoDate: '2026-09-28' })
    expect(plan.bookings).toEqual({})
  })

  it('leaves the committed booking intact when the draft is edited afterwards', () => {
    const bookings = { 'V-027': { vehicleId: 'V-027', startDate: '2026-09-29', days: 1 } }
    const plan = commitPlan({ weekId: WEEK_40, decisions: committable(), bookings, demoDate: '2026-09-28' })
    bookings['V-027'] = { vehicleId: 'V-027', startDate: '2026-09-30', days: 3 }
    expect(plan.bookings['V-027'].startDate).toBe('2026-09-29')
  })
})

describe('the commit summary', () => {
  const plan = commitPlan({
    weekId: WEEK_40,
    decisions: committable(),
    bookings: WALKTHROUGH_BOOKINGS,
    demoDate: '2026-09-28',
  })
  const summary = summaryFor({ fixture, plan })

  it('lists the three confirmed visits', () => {
    expect(summary.visits.map((v) => v.itemId).sort()).toEqual(['item-v012', 'item-v103', 'item-v118'])
  })

  it('carries forward availability with no shortfall left', () => {
    expect(summary.availability.every((d) => d.shortfall === 0)).toBe(true)
    expect(summary.availability).toHaveLength(10)
    const standard = summary.availability.filter((d) => d.vehicleClass === 'standard')
    expect(standard.map((d) => [d.owned - d.unavailable.length, d.cover, d.demand])).toEqual([
      [37, 1, 38],
      [36, 2, 38],
      [37, 1, 38],
      [36, 1, 37],
      [37, 1, 38],
    ])
  })

  it('lists the two requested replacements', () => {
    expect(summary.bookings).toEqual([WALKTHROUGH_BOOKINGS['V-012'], WALKTHROUGH_BOOKINGS['V-103']])
  })

  it('states the cover assumptions explicitly', () => {
    expect(summary.coverAssumptions).toEqual([
      'No specialist cover is available this week. A standard rental does not substitute.',
    ])
  })

  it('lists both deferred follow-ups with their review date and trigger', () => {
    expect(summary.deferrals.map((d) => d.itemId).sort()).toEqual(['item-v027', 'item-v041'])
    const v041 = summary.deferrals.find((d) => d.itemId === 'item-v041')!
    expect(v041.reviewDate).toBe('2026-10-05')
    expect(v041.triggerLabel).toContain('P0300')
  })

  it('states the outstanding hold and the release the fixture records', () => {
    expect(summary.holds.map((h) => h.vehicleId)).toEqual(['V-012'])
    expect(summary.holds[0].releaseRecordedOn).toBe('2026-10-06')
  })
})

describe('deferral records extracted from a commit', () => {
  it('produces one record per deferred item, stamped with the commit date', () => {
    const plan = commitPlan({ weekId: WEEK_40, decisions: committable(), demoDate: '2026-09-28' })
    const records = deferralRecordsFrom(plan)
    expect(records.map((r) => r.itemId).sort()).toEqual(['item-v027', 'item-v041'])
    expect(records[0].decidedOn).toBe('2026-09-28')
    expect(records[0].weekId).toBe(WEEK_40)
  })

  it('ignores a stale deferral left on a decision that is not a watch', () => {
    const decisions = committable()
    decisions['item-v118'] = {
      itemId: 'item-v118',
      treatment: 'act-now',
      slotDate: '2026-10-01',
      deferral: {
        reason: 'Left behind by an earlier watch.',
        reviewDate: '2026-10-09',
        trigger: {
          kind: 'odometer',
          vehicleId: 'V-118',
          thresholdKm: 49_500,
          label: 'Odometer passes 49,500 km',
        },
      },
    }
    const plan = commitPlan({ weekId: WEEK_40, decisions, demoDate: '2026-09-28' })
    expect(deferralRecordsFrom(plan).map((r) => r.itemId)).not.toContain('item-v118')
    expect(summaryFor({ fixture, plan }).deferrals.map((d) => d.itemId)).not.toContain('item-v118')
  })
})

describe('a cover the week carries but no day confirms', () => {
  // The fixture carries no pool cover any more, so this guard is exercised
  // on a fixture that does. [no pool cover spec D1]
  const withPool: Fixture = {
    ...fixture,
    covers: [{ id: 'P-1', vehicleClass: 'standard', confirmedDates: [], dayRateEur: 95 }],
    defaultCoverIds: ['P-1'],
  }

  it('says so rather than rendering a confirmed sentence with the days missing', () => {
    const plan = commitPlan({ weekId: '2026-10-12', decisions: {}, demoDate: '2026-10-12' })
    const line = summaryFor({ fixture: withPool, plan }).coverAssumptions.find((a) => a.startsWith('P-1'))!
    expect(line).toBe('P-1, standard cover, not confirmed for any day this week.')
    expect(line).not.toContain('EUR')
  })
})

describe('the daily confirmation is a read-only projection', () => {
  const plan = commitPlan({
    weekId: WEEK_40,
    decisions: committable(),
    bookings: WALKTHROUGH_BOOKINGS,
    demoDate: '2026-09-28',
  })

  it('reports Tuesday with V-012 and V-103 off the road and their reasons', () => {
    const view = dailyConfirmation({ fixture, plan, forDate: '2026-09-29' })
    expect(view.offRoad.map((o) => o.vehicleId).sort()).toEqual(['V-012', 'V-103'])
    expect(view.offRoad.find((o) => o.vehicleId === 'V-012')!.reason).toContain('Held')
    expect(view.offRoad.find((o) => o.vehicleId === 'V-103')!.reason).toContain('visit')
  })

  it('names the cover in use that day', () => {
    expect(dailyConfirmation({ fixture, plan, forDate: '2026-09-29' }).coverInUse).toEqual([
      'V-012 replacement',
      'V-103 replacement',
    ])
    expect(dailyConfirmation({ fixture, plan, forDate: '2026-09-30' }).coverInUse).toEqual(['V-012 replacement'])
  })

  it('shows both classes meeting demand', () => {
    const view = dailyConfirmation({ fixture, plan, forDate: '2026-09-29' })
    expect(view.rows).toHaveLength(2)
    expect(view.rows.every((r) => r.shortfall === 0)).toBe(true)
  })
})

describe('a released hold does not overshadow a later visit', () => {
  it('labels a released van by its visit, not by its stale hold record', () => {
    const decisions: Record<ItemId, DraftDecision> = {
      'item-v012': { itemId: 'item-v012', treatment: 'act-now', slotDate: '2026-10-06', deferral: null },
    }
    const plan = commitPlan({ weekId: '2026-10-05', decisions, demoDate: '2026-10-05' })
    const view = dailyConfirmation({ fixture, plan, forDate: '2026-10-06' })
    const v012 = view.offRoad.find((o) => o.vehicleId === 'V-012')!
    expect(v012.reason).toContain('In for a visit')
    expect(v012.reason).not.toContain('Held')
  })
})

describe('a committed booking is cover in the summary and the daily confirmation', () => {
  // V-118 back on Tuesday beside V-012 and V-103: short by one with only the
  // walkthrough replacements on site.
  function tuesdayHeavy(): Record<ItemId, DraftDecision> {
    const d = committable()
    d['item-v118'] = { ...d['item-v118'], slotDate: '2026-09-29' }
    return d
  }
  const bookings = {
    ...WALKTHROUGH_BOOKINGS,
    'V-118': { vehicleId: 'V-118', startDate: '2026-09-29', days: 1 },
  }
  const tuesdayStandard = (rows: { date: string; vehicleClass: string; shortfall: number }[]) =>
    rows.find((a) => a.date === '2026-09-29' && a.vehicleClass === 'standard')!

  it('clears the Tuesday shortfall in forward availability', () => {
    const without = summaryFor({
      fixture,
      plan: commitPlan({
        weekId: WEEK_40,
        decisions: tuesdayHeavy(),
        bookings: WALKTHROUGH_BOOKINGS,
        demoDate: '2026-09-28',
      }),
    })
    expect(tuesdayStandard(without.availability).shortfall).toBe(1)

    const withBooking = summaryFor({
      fixture,
      plan: commitPlan({ weekId: WEEK_40, decisions: tuesdayHeavy(), bookings, demoDate: '2026-09-28' }),
    })
    expect(tuesdayStandard(withBooking.availability).shortfall).toBe(0)
  })

  it('lists the booking as cover in use on its day, and not on others', () => {
    const plan = commitPlan({ weekId: WEEK_40, decisions: tuesdayHeavy(), bookings, demoDate: '2026-09-28' })
    expect(dailyConfirmation({ fixture, plan, forDate: '2026-09-29' }).coverInUse).toEqual([
      'V-012 replacement',
      'V-103 replacement',
      'V-118 replacement',
    ])
    expect(dailyConfirmation({ fixture, plan, forDate: '2026-09-29' }).rows.every((r) => r.shortfall === 0)).toBe(true)
    expect(dailyConfirmation({ fixture, plan, forDate: '2026-09-30' }).coverInUse).toEqual(['V-012 replacement'])
  })

  it('ignores a committed booking whose vehicle has no visit and no hold', () => {
    const stale = {
      ...WALKTHROUGH_BOOKINGS,
      'V-027': { vehicleId: 'V-027', startDate: '2026-09-29', days: 1 },
    }
    const plan = commitPlan({ weekId: WEEK_40, decisions: tuesdayHeavy(), bookings: stale, demoDate: '2026-09-28' })
    expect(tuesdayStandard(summaryFor({ fixture, plan }).availability).shortfall).toBe(1)
    expect(dailyConfirmation({ fixture, plan, forDate: '2026-09-29' }).coverInUse).toEqual([
      'V-012 replacement',
      'V-103 replacement',
    ])
  })

  it('lists only bookings whose vehicle has a visit or a hold, sorted by vehicle', () => {
    const mixed = {
      'V-118': { vehicleId: 'V-118', startDate: '2026-09-29', days: 1 },
      'V-027': { vehicleId: 'V-027', startDate: '2026-09-29', days: 1 },
      'V-012': { vehicleId: 'V-012', startDate: '2026-09-28', days: 5 },
    }
    const plan = commitPlan({ weekId: WEEK_40, decisions: tuesdayHeavy(), bookings: mixed, demoDate: '2026-09-28' })
    expect(summaryFor({ fixture, plan }).bookings.map((b) => b.vehicleId)).toEqual(['V-012', 'V-118'])
  })
})
