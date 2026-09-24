import { blockersForItem } from '../domain/validation'
import type { Blocker, DraftDecision, ItemId } from '../domain/types'
import { usePlan } from '../state/PlanProvider'
import { activeWeekId, queueFor } from '../state/planReducer'
import { groupQueue } from './grouping'
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
  const groups = groupQueue({ items: entries.map((e) => e.item), decisions, blockers, fixture })

  return (
    <div className="pane left">
      {groups.length === 0 && (
        <p className="empty">
          Nothing needs a decision this week. Deferred items return on their review date or when their
          trigger fires.
        </p>
      )}
      {groups.map((group) => (
        <div className="group" key={group.kind}>
          <p className={`grouptitle${group.kind === 'blocking' ? ' crit' : ''}`}>
            {group.label} <span className="cnt">· {group.items.length}</span>
          </p>
          {group.items.map((item) => {
            const entry = entries.find((e) => e.item.id === item.id)!
            const vehicle = fixture.vehicles.find((v) => v.id === item.vehicleId)!
            return (
              <ItemCard
                key={item.id}
                item={item}
                vehicle={vehicle}
                decision={decisions[item.id]}
                blockers={blockersForItem(blockers, item, fixture)}
                resurfaced={entry.resurfacedBecause !== null}
                groupKind={group.kind}
                selected={selectedItemId === item.id}
                onSelect={() => onSelect(item.id)}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
