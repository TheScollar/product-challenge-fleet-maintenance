import { formatDay } from '../domain/clock'
import type { VehicleId } from '../domain/types'
import { usePlan } from '../state/PlanProvider'
import { ReplacementBookingControl } from './ReplacementBookingControl'

/**
 * A held van with no item this week. There is no treatment to decide, only
 * cover to request, so the pane shows the hold and the booking control and
 * nothing else. Reached from its shortfall chip or band cell. [no pool cover
 * spec D4, §2.2]
 */
export function HeldVehiclePanel({ vehicleId }: { vehicleId: VehicleId }) {
  const { fixture } = usePlan()
  const vehicle = fixture.vehicles.find((v) => v.id === vehicleId)
  if (vehicle === undefined || vehicle.hold === null) {
    return <p className="empty">This vehicle is not held.</p>
  }
  const { hold } = vehicle
  return (
    <div className="detail">
      <div className="head">
        <span className="vid" style={{ fontSize: 15 }}>
          {vehicle.id}
        </span>
        <span className="urg deadline">Held</span>
      </div>
      <div className="sub">No open item this week · {vehicle.vehicleClass} class</div>
      <div className="because">
        {hold.reason}.{' '}
        {hold.releaseRecordedOn === null
          ? 'No release is recorded yet.'
          : `Release recorded for ${formatDay(hold.releaseRecordedOn)}.`}
      </div>
      <ReplacementBookingControl
        key={vehicle.id}
        vehicleId={vehicle.id}
        vehicleClass={vehicle.vehicleClass}
        appliedVisit={null}
        watched={false}
        held
      />
    </div>
  )
}
