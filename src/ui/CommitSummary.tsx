import { capacityFigure } from '../domain/capacity'
import { formatDay } from '../domain/clock'
import { costSummaryFor } from '../domain/costs'
import { bookingCostEur } from '../domain/replacementBooking'
import { summaryFor } from '../domain/commit'
import { usePlan } from '../state/PlanProvider'
import { activeWeekId } from '../state/planReducer'
import { CostAgainstBudget } from './CostAgainstBudget'
import { DailyConfirmation } from './DailyConfirmation'

export function CommitSummary({ onEdit }: { onEdit: () => void }) {
  const { state, fixture } = usePlan()
  const plan = state.committedByWeek[activeWeekId(state)] ?? null
  if (plan === null) return null
  const summary = summaryFor({ fixture, plan })
  const cost = costSummaryFor({ fixture, weekId: plan.weekId, decisions: plan.decisions, bookings: plan.bookings })
  const bookingRows = Object.values(plan.bookings).sort((a, b) => a.vehicleId.localeCompare(b.vehicleId))

  return (
    <div className="summary">
      <h2>Week plan committed</h2>
      <p className="lead">Committed {formatDay(summary.committedOn)}.</p>

      <div className="sim">
        Simulated commitment. The fixture guarantees these slots and confirms them with the plan.
        Nothing was sent to a garage, and no external booking exists.
      </div>

      <section>
        <h3>Confirmed visits · {summary.visits.length}</h3>
        {summary.visits.map((v) => (
          <div className="row" key={v.itemId}>
            <strong>{v.vehicleId}</strong> · {v.scope}
            <div className="meta">
              {v.garage}, {v.dateLabel}, {v.days === 1 ? '1 day' : `${v.days} days`}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h3>Forward availability</h3>
        <div className="avail">
          {[...new Set(summary.availability.map((a) => a.date))].map((date) => (
            <div className="d" key={date}>
              <div className="lbl">{formatDay(date)}</div>
              {summary.availability
                .filter((a) => a.date === date)
                .map((a) => (
                  <div key={a.vehicleClass}>
                    <span className="n">{capacityFigure(a)}</span> {a.vehicleClass}
                  </div>
                ))}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3>Cover assumptions</h3>
        <ul>
          {summary.coverAssumptions.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Cost against budget</h3>
        <CostAgainstBudget summary={cost} />
        {bookingRows.length > 0 && (
          <ul>
            {bookingRows.map((b) => (
              <li key={b.vehicleId}>
                {b.vehicleId}: {b.days} {b.days === 1 ? 'day' : 'days'} from {formatDay(b.startDate)}, EUR{' '}
                {bookingCostEur(b, fixture.replacementDayRateEur).toLocaleString('en-GB')}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3>Deferred follow-ups · {summary.deferrals.length}</h3>
        {summary.deferrals.length === 0 && <p className="lead">Nothing was deferred this week.</p>}
        {summary.deferrals.map((d) => (
          <div className="row" key={d.itemId}>
            <strong>{d.vehicleId}</strong> · {d.title}
            <div className="meta">{d.reason}</div>
            <div className="meta">
              Review {formatDay(d.reviewDate)}, or sooner if the trigger fires: {d.triggerLabel}.
            </div>
          </div>
        ))}
      </section>

      {summary.holds.length > 0 && (
        <section>
          <h3>Still held out of service</h3>
          {summary.holds.map((h) => (
            <div className="row" key={h.vehicleId}>
              <strong>{h.vehicleId}</strong>
              <div className="meta">{h.reason}.</div>
              <div className="meta">
                {h.releaseRecordedOn === null
                  ? 'No release recorded. The van stays out of service.'
                  : `Release recorded for ${formatDay(h.releaseRecordedOn)}, after repair and UVV re-inspection. Booking a visit does not release it.`}
              </div>
            </div>
          ))}
        </section>
      )}

      <DailyConfirmation plan={plan} />

      <div className="actions">
        <button className="ghost" onClick={onEdit}>
          Edit plan
        </button>
      </div>
    </div>
  )
}
