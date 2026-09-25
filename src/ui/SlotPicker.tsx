import { computeDayCapacity, weekFixtureFor } from '../domain/capacity'
import { formatDay, formatDayCount } from '../domain/clock'
import { slotOptions } from '../domain/feasibility'
import type { DayCapacity, DraftDecision, ISODate, ItemId, OpenItem } from '../domain/types'
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

  /** The week's shortfalls under a given draft, through the domain's own count. */
  function shortfallsUnder(draft: Record<ItemId, DraftDecision>): DayCapacity[] {
    const visits = visitsFromDecisions(draft, fixture.items)
    return week.days.flatMap((day) =>
      (['standard', 'specialist'] as const)
        .map((vehicleClass) => computeDayCapacity({ date: day, vehicleClass, fixture, visits, week }))
        .filter((c) => c.shortfall > 0),
    )
  }

  const keyOf = (c: DayCapacity) => `${c.date} ${c.vehicleClass} ${c.shortfall}`
  // The week as it stands, computed once. Every option is read against it.
  const baseline = new Set(shortfallsUnder(decisions).map(keyOf))

  /**
   * What picking this day would change, not what the week already is. Saying
   * "moves the shortfall" about a choice that moves nothing is a false claim of
   * causation, and the held van hits it every time. [S 4.5]
   */
  function effectOf(date: ISODate): { text: string; tone: string } {
    const trial = shortfallsUnder({
      ...decisions,
      [item.id]: { ...decisions[item.id], itemId: item.id, slotDate: date },
    })
    const added = trial.filter((s) => !baseline.has(keyOf(s)))
    const unchanged = added.length === 0 && trial.length === baseline.size

    if (unchanged) {
      return trial.length === 0
        ? { text: 'Every day stays covered', tone: 'good' }
        : { text: "Does not change this week's coverage", tone: '' }
    }
    // The chosen day first: a shortfall on the day being picked is the plainer
    // reading, even when another day's shortfall also changed.
    const onChosenDay = added.find((s) => s.date === date)
    if (onChosenDay) return { text: `${formatDay(date)} short ${onChosenDay.shortfall}`, tone: 'bad' }
    if (added.length > 0) return { text: `Moves the shortfall to ${formatDay(added[0].date)}`, tone: 'bad' }
    return { text: 'Clears the shortfall', tone: 'good' }
  }

  return (
    <div className="block">
      <div className="blocktitle">
        Slot · {garage} · {formatDayCount(item.visitDays)}
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
