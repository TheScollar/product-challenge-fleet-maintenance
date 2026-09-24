import { useMemo, useState } from 'react'
import { addDays, formatDay, formatLongDay, isoWeekNumber } from '../domain/clock'
import { fleetOverview, type VanStatus } from '../domain/fleetStatus'
import type { Blocker, DraftDecision, ItemId, VehicleId } from '../domain/types'
import { urgencyLabel } from '../domain/urgency'
import { usePlan } from '../state/PlanProvider'
import { activeWeekId, queueFor } from '../state/planReducer'
import { InspectPopover } from './InspectPopover'

export function FleetView({
  decisions,
  blockers,
  onOpenPlan,
}: {
  decisions: Record<ItemId, DraftDecision>
  blockers: Blocker[]
  onOpenPlan: (itemId: ItemId | null) => void
}) {
  const { state, fixture } = usePlan()
  const weekId = activeWeekId(state)
  const [inspected, setInspected] = useState<VehicleId | null>(null)

  const overview = useMemo(
    () =>
      fleetOverview({
        fixture,
        weekId,
        today: state.demoDate,
        queueItems: queueFor({ fixture, state, weekId }).map((e) => e.item),
        decisions,
        blockers,
        committed: state.committedByWeek[weekId] ?? null,
        deferralHistory: state.deferralHistory,
      }),
    [fixture, state, weekId, decisions, blockers],
  )

  const specialists = fixture.vehicles.filter((v) => v.vehicleClass === 'specialist').length
  const next = overview.nextBusinessDay
  const nextLabel = next.date === addDays(state.demoDate, 1) ? 'Tomorrow' : 'Next business day'

  const closeInspect = (vehicleId: VehicleId) => {
    setInspected(null)
    document.getElementById(`tile-${vehicleId}`)?.focus()
  }

  return (
    <>
      <div className="glance">
        <div>
          <h1>Fleet · {formatLongDay(state.demoDate)}</h1>
          <div className="today">
            <b>
              {overview.onRoad} of {fixture.vehicles.length}
            </b>{' '}
            vans on the road ·{' '}
            {overview.today.covered
              ? 'every assignment covered today'
              : overview.today.shortfalls
                  .map((s) => `${s.vehicleClass} short by ${s.shortfall} today`)
                  .join(' · ')}
            {overview.today.coverOnSite.length > 0 && <> · {overview.today.coverOnSite.join(', ')} on site</>}
          </div>
        </div>
        <span className="spacer" />
        <div className="cta">
          <button onClick={() => onOpenPlan(null)}>Open the week plan →</button>
          <div className={`sub${overview.committed ? ' ok' : ''}`}>
            {overview.committed
              ? `Week ${isoWeekNumber(weekId)} committed`
              : `${overview.attention.length} items waiting for week ${isoWeekNumber(weekId)}`}
          </div>
        </div>
        {!next.covered && (
          <div className="tomorrow">
            <span className="dot" />
            {nextLabel}, {formatDay(next.date)}:{' '}
            {next.shortfalls.map((s) => `${s.vehicleClass} short by ${s.shortfall}`).join(', ')} as
            currently planned ·{' '}
            <button className="fix" onClick={() => onOpenPlan(null)}>
              resolve in the week plan
            </button>
          </div>
        )}
      </div>

      <div className="stats">
        <div className="stat crit">
          <div className="n">{overview.counts.offRoad}</div>
          <div className="l">Off the road</div>
        </div>
        <div className="stat warn">
          <div className="n">{overview.counts.needsDecision}</div>
          <div className="l">Need a decision</div>
        </div>
        <div className="stat ok">
          <div className="n">{overview.counts.inService}</div>
          <div className="l">In service today</div>
        </div>
      </div>

      <div className="fleetsection">
        <h2>
          Needs attention <span className="hint">· click a van to open it in the week plan</span>
        </h2>
        {overview.attention.length === 0 && (
          <p className="empty">Nothing needs attention. All {fixture.vehicles.length} vans in service.</p>
        )}
        <div className="attn">
          {overview.attention.map((s) => (
            <AttentionCard key={s.vehicleId} status={s} onOpenPlan={onOpenPlan} />
          ))}
        </div>
      </div>

      <div className="fleetsection">
        <h2>
          In service today · {overview.quiet.length}{' '}
          <span className="hint">· click any van to inspect</span>
        </h2>
        <div className="legend">
          <span>
            <span className="specdot" /> Specialist van ({specialists} in fleet)
          </span>
        </div>
        <div className="fleetgrid">
          {overview.quiet.map((s) => (
            <div className="popwrap" key={s.vehicleId}>
              <button
                id={`tile-${s.vehicleId}`}
                className={`tile${inspected === s.vehicleId ? ' open' : ''}`}
                aria-expanded={inspected === s.vehicleId}
                onClick={() => setInspected(inspected === s.vehicleId ? null : s.vehicleId)}
              >
                {s.vehicleClass === 'specialist' && <span className="specdot" />}
                <span className="vid">{s.vehicleId}</span>
                {s.facts.length > 0 && <span className="s">{s.facts[0]}</span>}
              </button>
              {inspected === s.vehicleId && (
                <InspectPopover
                  vehicle={fixture.vehicles.find((v) => v.id === s.vehicleId)!}
                  facts={s.facts}
                  itemId={s.itemId}
                  onClose={() => closeInspect(s.vehicleId)}
                  onOpenPlan={onOpenPlan}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function AttentionCard({
  status,
  onOpenPlan,
}: {
  status: VanStatus
  onOpenPlan: (itemId: ItemId | null) => void
}) {
  const { fixture } = usePlan()
  const item = fixture.items.find((i) => i.id === status.itemId) ?? null
  return (
    <button
      className={`acard ${status.kind === 'off-road' ? 'crit' : 'warn'}`}
      onClick={() => onOpenPlan(status.itemId)}
    >
      <div className="row1">
        <span className="vid">{status.vehicleId}</span>
        {item !== null && item.safetyClass && <span className="badge safety">Safety · hard stop</span>}
        {status.kind === 'off-road' && <span className="badge held">Off the road</span>}
        {status.vehicleClass === 'specialist' && <span className="badge specialist">Specialist</span>}
        {item !== null && (
          <span className={`urg ${item.urgency.kind}`}>{urgencyLabel(item.urgency.kind)}</span>
        )}
      </div>
      {item !== null && <div className="title">{item.title}</div>}
      <div className="why">
        {status.kind === 'off-road' ? status.facts.join(' · ') : item !== null ? item.urgency.because : ''}
      </div>
      <div className="go">Open in week plan →</div>
    </button>
  )
}
