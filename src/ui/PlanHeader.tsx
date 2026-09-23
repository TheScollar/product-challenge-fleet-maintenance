import { formatDay, isoWeekNumber } from '../domain/clock'
import { weekFixtureFor } from '../domain/capacity'
import { canCommit, describeBlocker } from '../domain/validation'
import type { Blocker } from '../domain/types'
import { usePlan } from '../state/PlanProvider'
import { activeWeekId } from '../state/planReducer'

export function PlanHeader({ blockers, onCommit }: { blockers: Blocker[]; onCommit: () => void }) {
  const { state, fixture } = usePlan()
  const weekId = activeWeekId(state)
  const week = weekFixtureFor(fixture, weekId)
  const committed = state.committedByWeek[weekId] ?? null
  const ready = canCommit(blockers)

  return (
    <header className="planheader">
      <h1>Weekly maintenance plan</h1>
      <span className="week">
        Week {isoWeekNumber(weekId)} · {formatDay(week.days[0])} to {formatDay(week.days[4])} 2026 ·{' '}
        {fixture.depot} · {fixture.vehicles.length} vans
      </span>
      <span className="spacer" />
      <div>
        <button className="commit" onClick={onCommit} disabled={!ready}>
          {committed === null ? 'Commit plan' : 'Recommit plan'}
        </button>
        {ready ? (
          committed !== null && (
            <div className="committed">Committed {formatDay(committed.committedOn)}. Simulated, nothing was sent.</div>
          )
        ) : (
          <div className="blocked">
            {blockers.length} {blockers.length === 1 ? 'blocker' : 'blockers'}:{' '}
            {describeBlocker(blockers[0], fixture)}
            {blockers.length > 1 && ` (and ${blockers.length - 1} more below)`}
          </div>
        )}
      </div>
    </header>
  )
}
