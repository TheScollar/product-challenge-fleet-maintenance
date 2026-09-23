import { orderQueue } from '../domain/urgency'
import { blockersForItem } from '../domain/validation'
import type { Blocker, DraftDecision, ItemId } from '../domain/types'
import { usePlan } from '../state/PlanProvider'
import { activeWeekId, queueFor } from '../state/planReducer'
import { ItemCard } from './ItemCard'

export function DecisionQueue({
  decisions,
  blockers,
  selectedItemId,
  onSelect,
}: {
  decisions: Record<ItemId, DraftDecision>
  blockers: Blocker[]
  selectedItemId: ItemId | null
  onSelect: (id: ItemId) => void
}) {
  const { state, fixture } = usePlan()
  const weekId = activeWeekId(state)
  const entries = queueFor({ fixture, state, weekId })
  const ordered = orderQueue({ items: entries.map((e) => e.item), decisions, blockers })

  return (
    <div className="pane left">
      <p className="panetitle">Decisions needing attention · {ordered.length}</p>
      {ordered.length === 0 && (
        <p className="empty">
          Nothing needs a decision this week. Deferred items return on their review date or when their
          trigger fires.
        </p>
      )}
      {ordered.map((item) => {
        const entry = entries.find((e) => e.item.id === item.id)!
        const vehicle = fixture.vehicles.find((v) => v.id === item.vehicleId)!
        return (
          <ItemCard
            key={item.id}
            item={item}
            vehicle={vehicle}
            decision={decisions[item.id]}
            blockers={blockersForItem(blockers, item, fixture)}
            resurfacedBecause={entry.resurfacedBecause}
            priorDecision={entry.priorDecision}
            selected={selectedItemId === item.id}
            onSelect={() => onSelect(item.id)}
          />
        )
      })}
    </div>
  )
}
