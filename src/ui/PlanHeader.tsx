import { formatDay, isoWeekNumber } from '../domain/clock'
import { weekFixtureFor } from '../domain/capacity'
import { canCommit } from '../domain/validation'
import type { Blocker, DraftDecision, ItemId } from '../domain/types'
import { usePlan } from '../state/PlanProvider'
import { activeWeekId, queueFor } from '../state/planReducer'
import { blockerChips } from './grouping'

export function PlanHeader({
  blockers,
  decisions,
  onCommit,
  onSelectItem,
}: {
  blockers: Blocker[]
  decisions: Record<ItemId, DraftDecision>
  onCommit: () => void
  onSelectItem: (id: ItemId) => void
}) {
  const { state, fixture } = usePlan()
  const weekId = activeWeekId(state)
  const week = weekFixtureFor(fixture, weekId)
  const committed = state.committedByWeek[weekId] ?? null
  const ready = canCommit(blockers)
  const chips = blockerChips({
    blockers,
    items: queueFor({ fixture, state, weekId }).map((e) => e.item),
    decisions,
    fixture,
  })

  return (
    <header className="planheader">
      <h1>Weekly maintenance plan</h1>
      <span className="week">
        Week {isoWeekNumber(weekId)} · {formatDay(week.days[0])} to {formatDay(week.days[4])} 2026 ·{' '}
        {fixture.depot} · {fixture.vehicles.length} vans
      </span>
      <span className="spacer" />
      {!ready && (
        <div className="blockerchips">
          {chips.map((chip) => (
            <button
              key={chip.key}
              className={`bchip ${chip.tone}`}
              disabled={chip.targetItemId === null}
              onClick={() => chip.targetItemId !== null && onSelectItem(chip.targetItemId)}
            >
              <span className="dot" />
              {chip.label}
            </button>
          ))}
        </div>
      )}
      <div>
        <button className="commit" onClick={onCommit} disabled={!ready}>
          {committed === null ? 'Commit plan' : 'Recommit plan'}
        </button>
        {ready && committed !== null && (
          <div className="committed">Committed {formatDay(committed.committedOn)}. Simulated, nothing was sent.</div>
        )}
      </div>
    </header>
  )
}
