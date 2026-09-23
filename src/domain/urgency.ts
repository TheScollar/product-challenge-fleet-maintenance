import type { Blocker, DraftDecision, ItemId, OpenItem, UrgencyKind } from './types'

export function urgencyRank(kind: UrgencyKind): number {
  return kind === 'deadline' ? 0 : kind === 'estimate' ? 1 : 2
}

export function urgencyLabel(kind: UrgencyKind): string {
  return kind === 'deadline' ? 'Deadline' : kind === 'estimate' ? 'Estimate' : 'Assessment needed'
}

/**
 * G1 turns on what the queue puts first, so the order is fixed rather than
 * left to urgency alone:
 *   0 safety class
 *   1 undisposed, a required decision is missing
 *   2 contributing to a capacity shortfall
 *   3 everything else
 * Ties break on urgency rank, then on item id, so the order is deterministic.
 */
function tierOf(item: OpenItem, blockers: Blocker[]): number {
  if (item.safetyClass) return 0
  if (blockers.some((b) => b.kind === 'undisposed-item' && b.itemId === item.id)) return 1
  const contributes = blockers.some(
    (b) => b.kind === 'capacity-shortfall' && b.contributors.includes(item.vehicleId),
  )
  if (contributes) return 2
  return 3
}

export function orderQueue(args: {
  items: OpenItem[]
  decisions: Record<ItemId, DraftDecision>
  blockers: Blocker[]
}): OpenItem[] {
  const { items, blockers } = args
  return [...items].sort((a, b) => {
    const tier = tierOf(a, blockers) - tierOf(b, blockers)
    if (tier !== 0) return tier
    const urgency = urgencyRank(a.urgency.kind) - urgencyRank(b.urgency.kind)
    if (urgency !== 0) return urgency
    return a.id.localeCompare(b.id)
  })
}
