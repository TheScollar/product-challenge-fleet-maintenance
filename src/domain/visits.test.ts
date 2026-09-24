import { describe, expect, it } from 'vitest'
import { fixture } from './fixture'
import { isVisitDecision, visitsFromDecisions } from './visits'
import type { DraftDecision } from './types'

const d = (partial: Partial<DraftDecision>): DraftDecision => ({
  itemId: 'item-v118',
  treatment: null,
  slotDate: null,
  deferral: null,
  ...partial,
})

describe('a visit is a visit treatment with a slot, nothing less', () => {
  it('counts act-now and bundle with a slot', () => {
    expect(isVisitDecision(d({ treatment: 'act-now', slotDate: '2026-09-29' }))).toBe(true)
    expect(isVisitDecision(d({ treatment: 'bundle', slotDate: '2026-09-29' }))).toBe(true)
  })

  it('does not count a slot with no treatment, which the open backlog can now produce', () => {
    expect(isVisitDecision(d({ treatment: null, slotDate: '2026-09-29' }))).toBe(false)
    expect(visitsFromDecisions({ 'item-v118': d({ slotDate: '2026-09-29' }) }, fixture.items)).toEqual([])
  })

  it('does not count a watch, or a visit treatment without a slot', () => {
    expect(isVisitDecision(d({ treatment: 'watch', slotDate: '2026-09-29' }))).toBe(false)
    expect(isVisitDecision(d({ treatment: 'act-now', slotDate: null }))).toBe(false)
  })
})
