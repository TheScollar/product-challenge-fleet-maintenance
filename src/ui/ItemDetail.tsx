import { useEffect, useState } from 'react'
import { formatDay } from '../domain/clock'
import { recommendationFor } from '../domain/recommendation'
import { bookingCostEur, bookingsForVisits } from '../domain/replacementBooking'
import { urgencyLabel } from '../domain/urgency'
import { visitsFromDecisions } from '../domain/visits'
import type { DraftDecision, ItemId, OpenItem } from '../domain/types'
import { usePlan } from '../state/PlanProvider'
import { activeWeekId, bookingsFor, queueFor } from '../state/planReducer'
import { AssumptionBlock } from './AssumptionBlock'
import { ConsequenceBlock } from './ConsequenceBlock'
import { EvidenceBlock } from './EvidenceBlock'
import { ReplacementBookingControl } from './ReplacementBookingControl'
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
  const weekId = activeWeekId(state)
  const vehicle = fixture.vehicles.find((v) => v.id === item.vehicleId)!
  const entry = queueFor({ fixture, state, weekId }).find((e) => e.item.id === item.id)
  // The applied decision, as the plan holds it. The staged one lives below.
  const applied = decisions[item.id] ?? {
    itemId: item.id,
    treatment: null,
    slotDate: null,
    deferral: null,
  }
  // A replacement belongs to an applied visit, so both the control and the
  // Consequence tile's cover figure read the applied draft, never the staged
  // one. [scenario spec §5.1, §5.5]
  const draftVisits = visitsFromDecisions(decisions, fixture.items)
  const appliedVisit = draftVisits.find((v) => v.itemId === item.id) ?? null
  const booking = bookingsForVisits(bookingsFor({ state, weekId }), draftVisits)[item.vehicleId] ?? null
  const recommendation = recommendationFor(
    item,
    booking === null ? null : bookingCostEur(booking, fixture.replacementDayRateEur),
  )
  // App.tsx remounts this component via key={item.id}, so switching items
  // always reseeds from the applied decision and discards whatever was
  // staged here but never applied.
  const [decision, setDecision] = useState<DraftDecision>(applied)

  useEffect(() => {
    onPendingChange(decision)
  }, [decision, onPendingChange])

  const stagingVisit = decision.treatment === 'act-now' || decision.treatment === 'bundle'

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

      <TreatmentForm
        item={item}
        vehicle={vehicle}
        decision={decision}
        proposedAction={recommendation.proposedAction}
        onChange={setDecision}
        onApply={onApply}
      />

      {stagingVisit && (
        <SlotPicker
          item={item}
          decisions={decisions}
          selectedDate={decision.slotDate}
          onPick={(date) => setDecision({ ...decision, slotDate: date })}
        />
      )}

      <ReplacementBookingControl
        // Remount when the visit gate flips, so an open request form and its
        // draft never outlive the visit they were opened for. [scenario spec §5.2]
        key={`${item.vehicleId}-${appliedVisit === null ? 'none' : 'visit'}`}
        vehicleId={item.vehicleId}
        vehicleClass={vehicle.vehicleClass}
        appliedVisit={appliedVisit}
        watched={applied.treatment === 'watch'}
      />
    </div>
  )
}
