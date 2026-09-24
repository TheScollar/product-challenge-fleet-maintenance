import { describe, expect, it } from 'vitest'
import { commitPlan, dailyConfirmation, deferralRecordsFrom, summaryFor } from './commit'
import { fixture } from './fixture'
import type { DraftDecision, ItemId } from './types'
import { coldOpenDecisions } from './testSupport'

const WEEK_40 = '2026-09-28'

function committable(): Record<ItemId, DraftDecision> {
  const d = coldOpenDecisions()
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

describe('the commit summary', () => {
  const plan = commitPlan({ weekId: WEEK_40, decisions: committable(), demoDate: '2026-09-28' })
  const summary = summaryFor({ fixture, plan })

  it('lists the three confirmed visits', () => {
    expect(summary.visits.map((v) => v.itemId).sort()).toEqual(['item-v012', 'item-v103', 'item-v118'])
  })

  it('carries forward availability with no shortfall left', () => {
    expect(summary.availability.every((d) => d.shortfall === 0)).toBe(true)
    expect(summary.availability).toHaveLength(10)
  })

  it('states the cover assumptions explicitly', () => {
    expect(summary.coverAssumptions.join(' ')).toContain('R-1')
    expect(summary.coverAssumptions.join(' ')).toContain('R-2')
    expect(summary.coverAssumptions.join(' ')).toContain('No specialist cover')
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
  it('says so rather than rendering a confirmed sentence with the days missing', () => {
    const plan = commitPlan({ weekId: '2026-10-12', decisions: {}, demoDate: '2026-10-12' })
    const line = summaryFor({ fixture, plan }).coverAssumptions.find((a) => a.startsWith('R-1'))!
    expect(line).toBe('R-1, standard cover, not confirmed for any day this week.')
    expect(line).not.toContain('EUR')
  })
})

describe('the daily confirmation is a read-only projection', () => {
  const plan = commitPlan({ weekId: WEEK_40, decisions: committable(), demoDate: '2026-09-28' })

  it('reports Tuesday with V-012 and V-103 off the road and their reasons', () => {
    const view = dailyConfirmation({ fixture, plan, forDate: '2026-09-29' })
    expect(view.offRoad.map((o) => o.vehicleId).sort()).toEqual(['V-012', 'V-103'])
    expect(view.offRoad.find((o) => o.vehicleId === 'V-012')!.reason).toContain('Held')
    expect(view.offRoad.find((o) => o.vehicleId === 'V-103')!.reason).toContain('visit')
  })

  it('names the cover in use that day', () => {
    expect(dailyConfirmation({ fixture, plan, forDate: '2026-09-29' }).coverInUse.sort()).toEqual(['R-1', 'R-2'])
    expect(dailyConfirmation({ fixture, plan, forDate: '2026-09-30' }).coverInUse).toEqual(['R-1'])
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
