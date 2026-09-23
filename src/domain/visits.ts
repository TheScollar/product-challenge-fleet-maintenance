import { addDays } from './clock'
import type { DraftDecision, ISODate, ItemId, OpenItem, Visit } from './types'

export function visitCoversDate(visit: Visit, date: ISODate): boolean {
  return date >= visit.startDate && date < addDays(visit.startDate, visit.days)
}

/**
 * Visits are derived from the decision set and keyed by item, never appended
 * to a list. Re-committing therefore cannot duplicate one. [S 2.2]
 */
export function visitsFromDecisions(
  decisions: Record<ItemId, DraftDecision>,
  items: OpenItem[],
): Visit[] {
  const byId = new Map(items.map((i) => [i.id, i]))
  return Object.values(decisions)
    .filter((d) => d.slotDate !== null && d.treatment !== 'watch')
    .flatMap((d) => {
      const item = byId.get(d.itemId)
      if (!item) return []
      return [
        {
          itemId: item.id,
          vehicleId: item.vehicleId,
          garageId: item.garageId,
          startDate: d.slotDate as ISODate,
          days: item.visitDays,
          scope: item.title,
        },
      ]
    })
    .sort((a, b) => a.itemId.localeCompare(b.itemId))
}
