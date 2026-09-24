import { useEffect, useRef } from 'react'
import { formatDay } from '../domain/clock'
import type { ItemId, Vehicle } from '../domain/types'
import { ReplacementBookingControl } from './ReplacementBookingControl'

/**
 * Read-only inspection of one van. Click-away and Escape close it; near the
 * right viewport edge it opens leftward so it never clips. [FO spec 6]
 */
export function InspectPopover({
  vehicle,
  facts,
  itemId,
  onClose,
  onOpenPlan,
}: {
  vehicle: Vehicle
  facts: string[]
  itemId: ItemId | null
  /** The caller needs to know which path closed it: only the keyboard one
   *  leaves the tile on screen to hand focus back to. [FO spec 6] */
  onClose: (reason: 'key' | 'pointer') => void
  onOpenPlan: (itemId: ItemId | null) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el !== null && el.getBoundingClientRect().right > window.innerWidth - 16) {
      el.classList.add('flip')
    }
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Element | null
      if (target === null || target.closest('.popwrap') === null) onClose('pointer')
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose('key')
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div ref={ref} className="popover" role="dialog" aria-label={`${vehicle.id} details`}>
      <div className="head">
        <span className="vid">{vehicle.id}</span>
        <span className="badge cls">{vehicle.vehicleClass === 'specialist' ? 'Specialist' : 'Standard'}</span>
      </div>
      <dl className="kv">
        <dt>Model year</dt>
        <dd>{vehicle.modelYear}</dd>
        <dt>Odometer</dt>
        <dd>
          {vehicle.odometerKm.toLocaleString('en-GB')} km · read {formatDay(vehicle.odometerReadOn)}
        </dd>
        <dt>Typical week</dt>
        <dd>≈ {vehicle.weeklyRateKm.toLocaleString('en-GB')} km</dd>
        <dt>Status</dt>
        <dd>{facts.length > 0 ? facts.join(' · ') : 'In service · not held'}</dd>
      </dl>
      <ReplacementBookingControl key={vehicle.id} vehicleId={vehicle.id} vehicleClass={vehicle.vehicleClass} />
      {itemId !== null ? (
        <button className="foot" onClick={() => onOpenPlan(itemId)}>
          View in week plan →
        </button>
      ) : (
        <div className="foot">{facts.length > 0 ? 'Follow-up recorded' : 'Nothing open for this van'}</div>
      )}
    </div>
  )
}
