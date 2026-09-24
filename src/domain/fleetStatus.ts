import { computeDayCapacity, isHeldOn, weekFixtureFor } from './capacity'
import { addDays, daysBetween, formatDay, mondayOf } from './clock'
import { latestRecord } from './deferral'
import type {
  Blocker,
  CommittedPlan,
  DayCapacity,
  DeferralRecord,
  DraftDecision,
  Fixture,
  ISODate,
  ItemId,
  OpenItem,
  Vehicle,
  VehicleClass,
  VehicleId,
  Visit,
  WeekId,
} from './types'
import { orderQueue } from './urgency'
import { visitCoversDate, visitsFromDecisions } from './visits'

export type FleetStatusKind = 'off-road' | 'needs-decision' | 'in-service'

export interface VanStatus {
  vehicleId: VehicleId
  vehicleClass: VehicleClass
  kind: FleetStatusKind
  /** Sub-label lines, already worded: 'Held · …', 'In workshop · day 1 of 2',
   *  'Booked Thu 1 Oct', 'Watching · review Mon 2 Nov'. Empty for a plain
   *  green van and for an amber one (the card renders the item instead). */
  facts: string[]
  /** Set when the van links into the week plan: its item is in the active
   *  week's queue. Null otherwise, and the UI renders no link. */
  itemId: ItemId | null
}

export interface CoverageFacts {
  date: ISODate
  covered: boolean
  shortfalls: DayCapacity[]
  coverOnSite: string[]
}

export interface FleetOverview {
  /** Red and amber vans, in the week plan's queue order. */
  attention: VanStatus[]
  /** Green vans, in fixture order. */
  quiet: VanStatus[]
  counts: { offRoad: number; needsDecision: number; inService: number }
  onRoad: number
  /** Operational reality: committed visits and holds only. */
  today: CoverageFacts
  /** Planning preview: the same effective decisions the capacity band renders. */
  nextBusinessDay: CoverageFacts
  committed: boolean
}

/** The next date in the active week's day list, else the following week's Monday. */
export function nextBusinessDay(fixture: Fixture, today: ISODate): ISODate {
  const week = weekFixtureFor(fixture, mondayOf(today))
  const upcoming = week.days.find((d) => d > today)
  if (upcoming !== undefined) return upcoming
  return weekFixtureFor(fixture, addDays(week.weekId, 7)).days[0]
}

function coverageFor(date: ISODate, fixture: Fixture, visits: Visit[]): CoverageFacts {
  const week = weekFixtureFor(fixture, mondayOf(date))
  const classes: VehicleClass[] = ['standard', 'specialist']
  const days = classes.map((vehicleClass) =>
    computeDayCapacity({ date, vehicleClass, fixture, visits, week }),
  )
  return {
    date,
    covered: days.every((d) => d.shortfall === 0),
    shortfalls: days.filter((d) => d.shortfall > 0),
    coverOnSite: fixture.covers
      .filter((c) => week.coverIds.includes(c.id) && c.confirmedDates.includes(date))
      .map((c) => c.id),
  }
}

export function fleetOverview(args: {
  fixture: Fixture
  weekId: WeekId
  today: ISODate
  queueItems: OpenItem[]
  decisions: Record<ItemId, DraftDecision>
  blockers: Blocker[]
  committed: CommittedPlan | null
  deferralHistory: Record<ItemId, DeferralRecord[]>
}): FleetOverview {
  const { fixture, today, queueItems, decisions, blockers, committed, deferralHistory } = args

  // A booking is operational once committed; drafts affect only the coverage
  // preview, exactly as they affect the band. [spec 4]
  const committedVisits =
    committed === null ? [] : visitsFromDecisions(committed.decisions, fixture.items)
  const draftVisits = visitsFromDecisions(decisions, fixture.items)

  const queueByVehicle = new Map<VehicleId, OpenItem>()
  for (const item of queueItems) {
    if (!queueByVehicle.has(item.vehicleId)) queueByVehicle.set(item.vehicleId, item)
  }

  function statusOf(vehicle: Vehicle): VanStatus {
    const offRoad: string[] = []
    const hold = vehicle.hold
    if (hold !== null && isHeldOn(vehicle, today)) offRoad.push(`Held · ${hold.reason}`)
    const visit = committedVisits.find(
      (v) => v.vehicleId === vehicle.id && visitCoversDate(v, today),
    )
    if (visit !== undefined) {
      offRoad.push(`In workshop · day ${daysBetween(visit.startDate, today) + 1} of ${visit.days}`)
    }

    const queueItem = queueByVehicle.get(vehicle.id) ?? null
    const committedDecision =
      queueItem !== null && committed !== null ? (committed.decisions[queueItem.id] ?? null) : null

    const planFacts: string[] = []
    if (
      committedDecision !== null &&
      committedDecision.treatment !== null &&
      committedDecision.treatment !== 'watch' &&
      committedDecision.slotDate !== null &&
      !(visit !== undefined && visit.itemId === committedDecision.itemId)
    ) {
      planFacts.push(`Booked ${formatDay(committedDecision.slotDate)}`)
    }
    // The off-road branch keeps planFacts, so a van held for a reason unrelated
    // to its item must drop that item's stale watch record once it resurfaces
    // undecided, or Held would contradict a stale Watching. [spec 4]
    for (const item of fixture.items) {
      if (item.vehicleId !== vehicle.id) continue
      if (queueItem !== null && item.id === queueItem.id && committedDecision === null) continue
      const latest = latestRecord(deferralHistory[item.id] ?? [])
      if (latest !== undefined) {
        planFacts.push(`Watching · review ${formatDay(latest.deferral.reviewDate)}`)
      }
    }

    const base = {
      vehicleId: vehicle.id,
      vehicleClass: vehicle.vehicleClass,
      itemId: queueItem === null ? null : queueItem.id,
    }
    if (offRoad.length > 0) return { ...base, kind: 'off-road', facts: [...offRoad, ...planFacts] }

    const unresolved =
      queueItem !== null && (committedDecision === null || committedDecision.treatment === null)
    if (unresolved) return { ...base, kind: 'needs-decision', facts: [] }
    return { ...base, kind: 'in-service', facts: planFacts }
  }

  const statuses = fixture.vehicles.map(statusOf)
  const ordered = orderQueue({ items: queueItems, decisions, blockers })
  const rank = new Map(ordered.map((item, index) => [item.vehicleId, index]))
  const attention = statuses
    .filter((s) => s.kind !== 'in-service')
    .sort(
      (a, b) =>
        (rank.get(a.vehicleId) ?? Number.MAX_SAFE_INTEGER) -
          (rank.get(b.vehicleId) ?? Number.MAX_SAFE_INTEGER) ||
        a.vehicleId.localeCompare(b.vehicleId),
    )
  const quiet = statuses.filter((s) => s.kind === 'in-service')

  const counts = {
    offRoad: statuses.filter((s) => s.kind === 'off-road').length,
    needsDecision: statuses.filter((s) => s.kind === 'needs-decision').length,
    inService: quiet.length,
  }

  return {
    attention,
    quiet,
    counts,
    onRoad: fixture.vehicles.length - counts.offRoad,
    today: coverageFor(today, fixture, committedVisits),
    nextBusinessDay: coverageFor(nextBusinessDay(fixture, today), fixture, draftVisits),
    committed: committed !== null,
  }
}
