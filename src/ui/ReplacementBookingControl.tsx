import { useState } from 'react'
import { weekFixtureFor } from '../domain/capacity'
import { formatDay } from '../domain/clock'
import { bookingCostEur, replacementBookingErrors } from '../domain/replacementBooking'
import type { ReplacementBooking, VehicleClass, VehicleId } from '../domain/types'
import { usePlan } from '../state/PlanProvider'
import { activeWeekId } from '../state/planReducer'

/**
 * Freestanding from the maintenance queue: any standard-class vehicle can be
 * booked here, any time, for as little as a day. Mounted wherever a single
 * vehicle is already shown, rather than behind a new screen. [replacement
 * cover spec §2, §7.1]
 */
export function ReplacementBookingControl({
  vehicleId,
  vehicleClass,
}: {
  vehicleId: VehicleId
  vehicleClass: VehicleClass
}) {
  const { state, dispatch, fixture } = usePlan()
  const weekId = activeWeekId(state)
  const week = weekFixtureFor(fixture, weekId)
  const booking = state.draftBookingsByWeek[weekId]?.[vehicleId] ?? null
  // Callers must mount this component with key={vehicleId} to reseed state per vehicle.
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<ReplacementBooking>>(
    booking ?? { vehicleId, startDate: week.days[0], days: 1 },
  )

  if (vehicleClass === 'specialist') {
    return (
      <div className="block">
        <div className="blocktitle">Replacement cover</div>
        <div className="blockedreason">No specialist replacement cover exists.</div>
      </div>
    )
  }

  if (booking && !editing) {
    const cost = bookingCostEur(booking, fixture.replacementDayRateEur)
    return (
      <div className="block">
        <div className="blocktitle">Replacement cover</div>
        <div className="bookinginfo">
          Booked {booking.days} {booking.days === 1 ? 'day' : 'days'} from {formatDay(booking.startDate)} ·
          EUR {cost.toLocaleString('en-GB')}
        </div>
        <div className="actions">
          <button
            className="ghost"
            onClick={() => {
              setDraft(booking)
              setEditing(true)
            }}
          >
            Change
          </button>
          <button className="ghost" onClick={() => dispatch({ type: 'clear-booking', weekId, vehicleId })}>
            Cancel booking
          </button>
        </div>
      </div>
    )
  }

  const errors = replacementBookingErrors(draft, { fixture, weekId })
  const previewDays = draft.days !== undefined && draft.days !== null && draft.days >= 1 ? draft.days : 0
  const previewCost = bookingCostEur({ ...draft, days: previewDays } as ReplacementBooking, fixture.replacementDayRateEur)
  const fieldId = (name: string) => `${vehicleId}-booking-${name}`

  return (
    <div className="block">
      <div className="blocktitle">Replacement cover</div>
      <div className="field">
        <label htmlFor={fieldId('start')}>Start date</label>
        <select
          id={fieldId('start')}
          value={draft.startDate ?? ''}
          onChange={(e) => setDraft({ ...draft, vehicleId, startDate: e.target.value })}
        >
          <option value="">Choose a day</option>
          {week.days.map((d) => (
            <option key={d} value={d}>
              {formatDay(d)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={fieldId('days')}>Days</label>
        <input
          id={fieldId('days')}
          type="number"
          min={1}
          max={week.days.length}
          value={draft.days ?? 1}
          onChange={(e) => setDraft({ ...draft, vehicleId, days: Number(e.target.value) })}
        />
      </div>
      <div className="bookinginfo">
        Downtime: {previewDays} {previewDays === 1 ? 'day' : 'days'} · EUR {previewCost.toLocaleString('en-GB')}
      </div>
      {errors.length > 0 && <div className="missing">{errors.join('. ')}.</div>}
      <div className="actions">
        <button
          className="primary"
          disabled={errors.length > 0}
          onClick={() => {
            dispatch({ type: 'set-booking', weekId, booking: draft as ReplacementBooking })
            setEditing(false)
          }}
        >
          Request replacement
        </button>
        {editing && (
          <button className="ghost" onClick={() => setEditing(false)}>
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
