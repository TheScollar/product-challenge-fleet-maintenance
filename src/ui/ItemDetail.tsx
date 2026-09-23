import { recommendationFor } from '../domain/recommendation'
import { urgencyLabel } from '../domain/urgency'
import type { DraftDecision, ItemId, OpenItem } from '../domain/types'
import { usePlan } from '../state/PlanProvider'
import { AssumptionBlock } from './AssumptionBlock'
import { ConsequenceBlock } from './ConsequenceBlock'
import { EvidenceBlock } from './EvidenceBlock'
import { SlotPicker } from './SlotPicker'
import { TreatmentForm } from './TreatmentForm'

export function ItemDetail({
  item,
  decisions,
  onChange,
}: {
  item: OpenItem
  decisions: Record<ItemId, DraftDecision>
  onChange: (d: DraftDecision) => void
}) {
  const { fixture } = usePlan()
  const vehicle = fixture.vehicles.find((v) => v.id === item.vehicleId)!
  const recommendation = recommendationFor(item)
  const decision = decisions[item.id] ?? {
    itemId: item.id,
    treatment: null,
    slotDate: null,
    deferral: null,
  }

  return (
    <div className="detail">
      <div className="head">
        <span className="vid" style={{ fontSize: 15 }}>
          {item.vehicleId}
        </span>
        <span className={`urg ${item.urgency.kind}`}>{urgencyLabel(item.urgency.kind)}</span>
        {vehicle.vehicleClass === 'specialist' && <span className="badge specialist">Specialist</span>}
      </div>
      <div className="sub">
        {item.title} · {vehicle.vehicleClass} class
      </div>

      <EvidenceBlock recommendation={recommendation} />
      <AssumptionBlock recommendation={recommendation} />
      <ConsequenceBlock recommendation={recommendation} />

      {decision.treatment !== 'watch' && (
        <SlotPicker
          item={item}
          decisions={decisions}
          selectedDate={decision.slotDate}
          onPick={(date) => onChange({ ...decision, slotDate: date })}
        />
      )}

      <TreatmentForm item={item} vehicle={vehicle} decision={decision} onChange={onChange} />
    </div>
  )
}
