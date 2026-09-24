import { capacityFigure } from '../domain/capacity'
import { addDays } from '../domain/clock'
import { dailyConfirmation } from '../domain/commit'
import type { CommittedPlan } from '../domain/types'
import { usePlan } from '../state/PlanProvider'

export function DailyConfirmation({ plan }: { plan: CommittedPlan }) {
  const { state, fixture } = usePlan()
  const tomorrow = addDays(state.demoDate, 1)
  const view = dailyConfirmation({ fixture, plan, forDate: tomorrow })

  return (
    <section>
      <h3>Daily confirmation · {view.dateLabel}</h3>
      <div className="row">
        {view.rows.map((r) => (
          <div key={r.vehicleClass}>
            <span className="n">{capacityFigure(r)}</span> {r.vehicleClass} assignments covered
            {r.shortfall > 0 && <strong style={{ color: 'var(--crit)' }}> · short {r.shortfall}</strong>}
          </div>
        ))}
        <div className="meta">
          {view.coverInUse.length > 0
            ? `Cover in use: ${view.coverInUse.join(', ')}.`
            : 'No replacement cover in use.'}
        </div>
      </div>
      {view.offRoad.length > 0 && (
        <ul>
          {view.offRoad.map((o) => (
            <li key={o.vehicleId}>
              <strong>{o.vehicleId}</strong> off the road. {o.reason}.
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
