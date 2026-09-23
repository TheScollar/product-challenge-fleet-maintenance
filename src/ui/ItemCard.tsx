import { formatDay } from '../domain/clock'
import { urgencyLabel } from '../domain/urgency'
import type { Blocker, DeferralRecord, DraftDecision, OpenItem, Vehicle } from '../domain/types'

export function ItemCard({
  item,
  vehicle,
  decision,
  blockers,
  resurfacedBecause,
  priorDecision,
  selected,
  onSelect,
}: {
  item: OpenItem
  vehicle: Vehicle
  decision: DraftDecision | undefined
  blockers: Blocker[]
  resurfacedBecause: string | null
  priorDecision: DeferralRecord | null
  selected: boolean
  onSelect: () => void
}) {
  const state = dispositionLabel(decision, blockers)

  return (
    <button className={`card${selected ? ' sel' : ''}`} onClick={onSelect}>
      <div className="row1">
        <span className="vid">{item.vehicleId}</span>
        {item.safetyClass && <span className="badge safety">Safety · hard stop</span>}
        {vehicle.hold !== null && <span className="badge held">Held since {formatDay(vehicle.hold.since)}</span>}
        {vehicle.vehicleClass === 'specialist' && <span className="badge specialist">Specialist</span>}
        {resurfacedBecause !== null && <span className="badge resurfaced">Resurfaced</span>}
      </div>
      <div className="title">{item.title}</div>
      <div className="why">
        <span className={`urg ${item.urgency.kind}`}>{urgencyLabel(item.urgency.kind)}</span>
        {item.urgency.because}
      </div>
      <div className={`state ${state.tone}`}>{state.text}</div>
      {priorDecision !== null && (
        <div className="prior">
          Previously: watch, decided {formatDay(priorDecision.decidedOn)}. {priorDecision.deferral.reason}
        </div>
      )}
    </button>
  )
}

function dispositionLabel(
  decision: DraftDecision | undefined,
  blockers: Blocker[],
): { text: string; tone: string } {
  if (blockers.some((b) => b.kind === 'capacity-shortfall')) {
    return { text: 'Causes a shortfall', tone: 'warn' }
  }
  if (blockers.some((b) => b.kind === 'infeasible-slot' || b.kind === 'parts-not-ready')) {
    return { text: 'Slot not bookable', tone: 'crit' }
  }
  if (!decision || decision.treatment === null) return { text: 'Decision needed', tone: 'crit' }
  if (decision.treatment === 'watch') {
    return decision.deferral === null
      ? { text: 'Watch, incomplete', tone: 'crit' }
      : { text: `Watch until ${formatDay(decision.deferral.reviewDate)}`, tone: '' }
  }
  if (decision.slotDate === null) return { text: 'No slot chosen', tone: 'crit' }
  return { text: `${formatDay(decision.slotDate)} booked`, tone: '' }
}
