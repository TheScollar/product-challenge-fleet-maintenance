import { computeDayCapacity, weekFixtureFor } from '../domain/capacity'
import { formatDay } from '../domain/clock'
import { slotOptions } from '../domain/feasibility'
import type { DraftDecision, ISODate, ItemId, OpenItem } from '../domain/types'
import { visitsFromDecisions } from '../domain/visits'
import { usePlan } from '../state/PlanProvider'
import { activeWeekId } from '../state/planReducer'

export function SlotPicker({
  item,
  decisions,
  selectedDate,
  onPick,
}: {
  item: OpenItem
  decisions: Record<ItemId, DraftDecision>
  selectedDate: ISODate | null
  onPick: (date: ISODate) => void
}) {
  const { state, fixture } = usePlan()
  const weekId = activeWeekId(state)
  const week = weekFixtureFor(fixture, weekId)
  const garage = fixture.garages.find((g) => g.id === item.garageId)?.name ?? item.garageId
  const options = slotOptions({ item, fixture, decisions, weekId })

  /** What picking this day would do to capacity, computed by actually trying it. */
  function effectOf(date: ISODate): { text: string; tone: string } {
    const trial = { ...decisions, [item.id]: { ...decisions[item.id], itemId: item.id, slotDate: date } }
    const visits = visitsFromDecisions(trial, fixture.items)
    const shortfalls = week.days.flatMap((day) =>
      (['standard', 'specialist'] as const)
        .map((vehicleClass) => computeDayCapacity({ date: day, vehicleClass, fixture, visits, week }))
        .filter((c) => c.shortfall > 0),
    )
    if (shortfalls.length === 0) return { text: 'Every day stays covered', tone: 'good' }
    const here = shortfalls.filter((s) => s.date === date)
    if (here.length > 0) return { text: `${formatDay(date)} short ${here[0].shortfall}`, tone: 'bad' }
    return { text: `Moves the shortfall to ${formatDay(shortfalls[0].date)}`, tone: 'bad' }
  }

  return (
    <div className="block">
      <div className="blocktitle">
        Slot · {garage} · {item.visitDays === 1 ? '1 day' : `${item.visitDays} days`}
      </div>
      {options.map((option) => {
        const effect = option.feasible
          ? effectOf(option.date)
          : { text: option.reasons.join('. '), tone: 'no' }
        return (
          <button
            key={option.date}
            className={`slot${selectedDate === option.date ? ' on' : ''}`}
            disabled={!option.feasible}
            onClick={() => onPick(option.date)}
            title={option.feasible ? undefined : option.reasons.join('. ')}
          >
            <span className="radio" />
            {formatDay(option.date)}
            <span className={`eff ${effect.tone}`}>{effect.text}</span>
          </button>
        )
      })}
    </div>
  )
}
