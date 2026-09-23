import { computeWeekCapacity } from './capacity'
import { formatDay } from './clock'
import { isDeferralComplete } from './deferral'
import { slotBlockers } from './feasibility'
import type { Blocker, DraftDecision, Fixture, ItemId, OpenItem, WeekId } from './types'
import { visitsFromDecisions } from './visits'

/**
 * A blocked plan is a legitimate outcome, not an error state. The draft
 * survives, the blocker is named, and no success state is reachable. [WP E2.5]
 */
export function validatePlan(args: {
  fixture: Fixture
  weekId: WeekId
  decisions: Record<ItemId, DraftDecision>
}): Blocker[] {
  const { fixture, weekId, decisions } = args
  // Every item the caller has a decision slot for, which is the week's queue.
  // Filtering on week.itemIds would skip resurfaced items entirely, since weeks
  // after the first author none of their own.
  const items = fixture.items.filter((i) => decisions[i.id] !== undefined)
  const visits = visitsFromDecisions(decisions, fixture.items)
  const out: Blocker[] = []

  for (const item of items) {
    const decision = decisions[item.id]
    if (!decision || decision.treatment === null) {
      out.push({ kind: 'undisposed-item', itemId: item.id })
      continue
    }
    if (decision.treatment === 'watch') {
      if (!isDeferralComplete(decision.deferral)) {
        out.push({ kind: 'undisposed-item', itemId: item.id })
      }
      continue
    }
    if (decision.slotDate === null) {
      out.push({ kind: 'undisposed-item', itemId: item.id })
      continue
    }
    out.push(...slotBlockers({ item, date: decision.slotDate, fixture, visits }))
  }

  for (const day of computeWeekCapacity({ fixture, weekId, visits })) {
    if (day.shortfall > 0) {
      out.push({
        kind: 'capacity-shortfall',
        date: day.date,
        vehicleClass: day.vehicleClass,
        shortBy: day.shortfall,
        contributors: day.unavailable,
      })
    }
  }
  return out
}

/**
 * A held vehicle is not a blocker on its own: it may stay held provided cover
 * exists and a next step is recorded. Nothing above adds one. [S 3.5]
 */
export function canCommit(blockers: Blocker[]): boolean {
  return blockers.length === 0
}

export function blockersForItem(blockers: Blocker[], item: OpenItem): Blocker[] {
  return blockers.filter((b) => {
    if (b.kind === 'capacity-shortfall') return b.contributors.includes(item.vehicleId)
    return b.itemId === item.id
  })
}

export function describeBlocker(b: Blocker, fixture: Fixture): string {
  switch (b.kind) {
    case 'capacity-shortfall':
      return `${formatDay(b.date)}: ${b.vehicleClass} short by ${b.shortBy}. Off the road: ${b.contributors.join(', ')}.`
    case 'infeasible-slot':
      return `${titleOf(fixture, b.itemId)}: ${b.reasons.join('. ')}.`
    case 'parts-not-ready':
      return `${titleOf(fixture, b.itemId)}: ${b.partName} is not ready until ${formatDay(b.readyOn)}.`
    case 'undisposed-item':
      return `${titleOf(fixture, b.itemId)}: no decision recorded yet.`
  }
}

function titleOf(fixture: Fixture, itemId: ItemId): string {
  const item = fixture.items.find((i) => i.id === itemId)
  return item ? `${item.vehicleId} ${item.title.toLowerCase()}` : itemId
}
