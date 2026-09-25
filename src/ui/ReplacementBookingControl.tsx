import { useState } from 'react'
import { weekFixtureFor } from '../domain/capacity'
import { formatDay } from '../domain/clock'
import { bookingCostEur, replacementBookingErrors } from '../domain/replacementBooking'
import type { ReplacementBooking, VehicleClass, VehicleId, Visit } from '../domain/types'
import { usePlan } from '../state/PlanProvider'
import { activeWeekId } from '../state/planReducer'

/**
 * A replacement belongs to a visit. Mounted only in the weekly plan's detail
 * pane, and it offers the request only once a visit is applied for this
 * vehicle; the dashboard reports a committed booking as a fact and offers no
 * control. Callers mount it with a key that changes with the vehicle and with whether a visit is applied, so editing state never outlives the gate. [scenario spec §5.1, §5.2]
 */
export function ReplacementBookingControl({
  vehicleId,
  vehicleClass,
  appliedVisit,
  watched,
}: {
  vehicleId: VehicleId
  vehicleClass: VehicleClass
  /** The vehicle's applied visit this week, or null when there is none. */
  appliedVisit: Visit | null
  /** True when the item's applied treatment is watch, for the explanatory line. */
  watched: boolean
}) {
  const { state, dispatch, fixture } = usePlan()
  const weekId = activeWeekId(state)
  const week = weekFixtureFor(fixture, weekId)
  const booking = appliedVisit === null ? null : (state.draftBookingsByWeek[weekId]?.[vehicleId] ?? null)
  const [editing, setEditing] = useState(false)
  // Defaults follow the visit: its day, its length. Both stay editable within
  // the week, so a held van can be covered Monday to Friday.
  const defaults = (): Partial<ReplacementBooking> => ({
    vehicleId,
    startDate: appliedVisit?.startDate ?? week.days[0],
    days: appliedVisit?.days ?? 1,
  })
  const [draft, setDraft] = useState<Partial<ReplacementBooking>>(booking ?? defaults())

  if (appliedVisit === null) {
    return (
      <div className="block">
        <div className="blocktitle">Replacement cover</div>
        <div className="bookinginfo">
          {watched ? 'Not needed while this vehicle is watched.' : 'Apply a visit before requesting a replacement.'}
        </div>
      </div>
    )
  }

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

  if (!booking && !editing) {
    return (
      <div className="block">
        <div className="blocktitle">Replacement cover</div>
        <div className="bookinginfo">No replacement requested.</div>
        <div className="actions">
          <button
            className="primary"
            onClick={() => {
              setDraft(defaults())
              setEditing(true)
            }}
          >
            Request replacement
          </button>
        </div>
      </div>
    )
  }

  const errors = replacementBookingErrors(draft, { fixture, weekId })
  const previewDays =
    draft.days !== undefined && draft.days !== null && Number.isInteger(draft.days) && draft.days >= 1
      ? draft.days
      : 0
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
          step={1}
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
        <button className="ghost" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    </div>
  )
}
