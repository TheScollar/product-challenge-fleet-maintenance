import { formatDay } from '../domain/clock'
import { urgencyLabel } from '../domain/urgency'
import type { Blocker, DraftDecision, OpenItem, Vehicle } from '../domain/types'
import type { QueueGroupKind } from './grouping'

export function ItemCard({
  item,
  vehicle,
  decision,
  blockers,
  resurfaced,
  groupKind,
  selected,
  onSelect,
}: {
  item: OpenItem
  vehicle: Vehicle
  decision: DraftDecision | undefined
  blockers: Blocker[]
  resurfaced: boolean
  groupKind: QueueGroupKind
  selected: boolean
  onSelect: () => void
}) {
  const state = dispositionLabel(decision, blockers)

  return (
    <button className={`card ${groupKind}${selected ? ' sel' : ''}`} onClick={onSelect}>
      <div className="r1">
        <span className="vid">{item.vehicleId}</span>
        {item.safetyClass && <span className="badge safety">Safety · hard stop</span>}
        {vehicle.hold !== null && <span className="badge">Held since {formatDay(vehicle.hold.since)}</span>}
        {vehicle.vehicleClass === 'specialist' && <span className="badge specialist">Specialist</span>}
        {resurfaced && <span className="badge resurfaced">Resurfaced</span>}
        <span className="spacer" />
        <span className={`status ${state.tone}`}>{state.text}</span>
      </div>
      <div className="r2">
        <span className="title">{item.title}</span>
        <span className="spacer" />
        <span className={`urg ${item.urgency.kind}`}>{urgencyLabel(item.urgency.kind)}</span>
      </div>
    </button>
  )
}

/** Status copy per [D §3]. The weekday is the first token of formatDay. */
function dispositionLabel(
  decision: DraftDecision | undefined,
  blockers: Blocker[],
): { text: string; tone: string } {
  const short = blockers.find(
    (b): b is Extract<Blocker, { kind: 'capacity-shortfall' }> => b.kind === 'capacity-shortfall',
  )
  if (short) {
    return { text: `Causes ${formatDay(short.date).split(' ')[0]} shortfall`, tone: 'crit' }
  }
  if (blockers.some((b) => b.kind === 'infeasible-slot' || b.kind === 'parts-not-ready')) {
    return { text: 'Slot not bookable', tone: 'crit' }
  }
  if (!decision || decision.treatment === null) return { text: 'No decision', tone: 'crit' }
  if (decision.treatment === 'watch') {
    return decision.deferral === null
      ? { text: 'Watch, incomplete', tone: 'crit' }
      : { text: `Watch until ${formatDay(decision.deferral.reviewDate)}`, tone: '' }
  }
  if (decision.slotDate === null) return { text: 'No slot chosen', tone: 'crit' }
  return { text: `${formatDay(decision.slotDate)} booked`, tone: 'ok' }
}
