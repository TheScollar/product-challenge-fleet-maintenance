import { useEffect, useState } from 'react'
import { formatDay } from '../domain/clock'
import { recommendationFor } from '../domain/recommendation'
import { urgencyLabel } from '../domain/urgency'
import type { DraftDecision, ItemId, OpenItem } from '../domain/types'
import { usePlan } from '../state/PlanProvider'
import { activeWeekId, queueFor } from '../state/planReducer'
import { AssumptionBlock } from './AssumptionBlock'
import { ConsequenceBlock } from './ConsequenceBlock'
import { EvidenceBlock } from './EvidenceBlock'
import { SlotPicker } from './SlotPicker'
import { TreatmentForm } from './TreatmentForm'

export function ItemDetail({
  item,
  decisions,
  onApply,
  onPendingChange,
}: {
  item: OpenItem
  decisions: Record<ItemId, DraftDecision>
  onApply: (d: DraftDecision) => void
  onPendingChange: (d: DraftDecision) => void
}) {
  const { state, fixture } = usePlan()
  const vehicle = fixture.vehicles.find((v) => v.id === item.vehicleId)!
  const entry = queueFor({ fixture, state, weekId: activeWeekId(state) }).find(
    (e) => e.item.id === item.id,
  )
  const recommendation = recommendationFor(item)
  const committed = decisions[item.id] ?? {
    itemId: item.id,
    treatment: null,
    slotDate: null,
    deferral: null,
  }
  // App.tsx remounts this component via key={item.id}, so switching items
  // always reseeds from the committed decision and discards whatever was
  // staged here but never applied.
  const [decision, setDecision] = useState<DraftDecision>(committed)

  useEffect(() => {
    onPendingChange(decision)
  }, [decision, onPendingChange])

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
      <div className="because">{item.urgency.because}</div>
      {entry !== undefined && entry.priorDecision !== null && (
        <div className="because">
          Previously: watch, decided {formatDay(entry.priorDecision.decidedOn)}.{' '}
          {entry.priorDecision.deferral.reason}
        </div>
      )}

      <EvidenceBlock recommendation={recommendation} />
      <AssumptionBlock recommendation={recommendation} />
      <ConsequenceBlock recommendation={recommendation} />

      {decision.treatment !== 'watch' && (
        <SlotPicker
          item={item}
          decisions={decisions}
          selectedDate={decision.slotDate}
          onPick={(date) => setDecision({ ...decision, slotDate: date })}
        />
      )}

      <TreatmentForm item={item} vehicle={vehicle} decision={decision} onChange={setDecision} onApply={onApply} />
    </div>
  )
}
