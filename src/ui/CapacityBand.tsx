import { computeWeekCapacity, weekFixtureFor } from '../domain/capacity'
import { formatDay } from '../domain/clock'
import { adHocCoversFrom } from '../domain/replacementBooking'
import type { DayCapacity, DraftDecision, ISODate, ItemId, ReplacementBooking, VehicleId } from '../domain/types'
import { visitsFromDecisions } from '../domain/visits'
import { usePlan } from '../state/PlanProvider'
import { activeWeekId } from '../state/planReducer'

export function CapacityBand({
  decisions,
  selectedItemId,
  bookings,
}: {
  decisions: Record<ItemId, DraftDecision>
  selectedItemId: ItemId | null
  bookings: Record<VehicleId, ReplacementBooking>
}) {
  const { state, fixture } = usePlan()
  const weekId = activeWeekId(state)
  const week = weekFixtureFor(fixture, weekId)
  const visits = visitsFromDecisions(decisions, fixture.items)
  const adHocCovers = adHocCoversFrom(bookings, fixture.replacementDayRateEur)
  const rows = computeWeekCapacity({ fixture, weekId, visits, adHocCovers })

  const cellFor = (date: ISODate, vehicleClass: 'standard' | 'specialist') =>
    rows.find((r) => r.date === date && r.vehicleClass === vehicleClass) as DayCapacity

  const selected = fixture.items.find((i) => i.id === selectedItemId) ?? null
  const shortDays = rows.filter((r) => r.shortfall > 0)
  const spareDays = rows.filter((r) => r.available > r.demand)

  const covers = fixture.covers.filter((c) => week.coverIds.includes(c.id))
  const hasSpecialistCover = covers.some((c) => c.vehicleClass === 'specialist')

  return (
    <div className="band">
      <div className="head">
        <span className="t">Week capacity · available / demand</span>
        {selected !== null && <span className="live">Reacting to {selected.vehicleId}</span>}
        <span className="spacer" />
        <span className="cover">
          {covers.map((c) => (
            <span key={c.id}>
              <b>{c.id}</b> {coverSummary(c.confirmedDates, week.days)} ·{' '}
            </span>
          ))}
          {!hasSpecialistCover && <span className="none">no specialist cover</span>}
        </span>
      </div>

      <div className="days">
        <div className="rowlab">
          <span className="top">Standard</span>
          <span>Specialist</span>
        </div>
        {week.days.map((date) => {
          const std = cellFor(date, 'standard')
          const spec = cellFor(date, 'specialist')
          const impacted = std.shortfall > 0 || spec.shortfall > 0
          const candidate = !impacted && (std.available > std.demand || spec.available > spec.demand)
          const exception = impacted || candidate
          return (
            <div
              key={date}
              className={`day${exception ? ' exc' : ''}${impacted ? ' impacted' : ''}${candidate ? ' candidate' : ''}`}
            >
              <div className="dh">{formatDay(date)}</div>
              <Cell capacity={std} />
              <Cell capacity={spec} />
            </div>
          )
        })}
      </div>

      <div className="flagline">
        {shortDays.map((r) => (
          <span className="flag" key={`${r.date}-${r.vehicleClass}`}>
            <span className="dot" />
            {formatDay(r.date)}: {r.vehicleClass} short by {r.shortfall}. Off the road:{' '}
            {r.unavailable.join(', ')}
          </span>
        ))}
        {shortDays.length === 0 && spareDays.length > 0 && (
          <span className="flag ok">
            <span className="dot" />
            Every day is covered. Spare capacity on{' '}
            {[...new Set(spareDays.map((r) => formatDay(r.date)))].join(', ')}
          </span>
        )}
        {shortDays.length === 0 && spareDays.length === 0 && (
          <span className="flag ok">
            <span className="dot" />
            Every day is covered, with no spare van in the week
          </span>
        )}
      </div>
    </div>
  )
}

function Cell({ capacity }: { capacity: DayCapacity }) {
  const short = capacity.shortfall > 0
  const spare = capacity.available > capacity.demand
  return (
    <div className={`c${short ? ' short' : spare ? ' spare' : ''}`}>
      <span className="n">
        {capacity.available} / {capacity.demand}
      </span>
      {short && <span className="sub">short {capacity.shortfall}</span>}
      {spare && <span className="sub">+{capacity.available - capacity.demand}</span>}
    </div>
  )
}

function coverSummary(confirmed: ISODate[], weekDays: ISODate[]): string {
  const inWeek = weekDays.filter((d) => confirmed.includes(d))
  if (inWeek.length === weekDays.length) return 'Mon to Fri'
  if (inWeek.length === 0) return 'not this week'
  return inWeek.map((d) => formatDay(d).slice(0, 3)).join(' and ') + ' only'
}
