import { commitPlan, deferralRecordsFrom } from '../domain/commit'
import { addDays, mondayOf } from '../domain/clock'
import { nextResurfaceDate, resurfacedItems } from '../domain/deferral'
import { weekFixtureFor } from '../domain/capacity'
import { SEED_DATE } from '../domain/fixture'
import type {
  CommittedPlan,
  DeferralRecord,
  DraftDecision,
  Fixture,
  ISODate,
  ItemId,
  OpenItem,
  ReplacementBooking,
  VehicleId,
  WeekId,
} from '../domain/types'

export interface AppState {
  version: 1
  demoDate: ISODate
  draftByWeek: Record<WeekId, Record<ItemId, DraftDecision>>
  draftBookingsByWeek: Record<WeekId, Record<VehicleId, ReplacementBooking>>
  committedByWeek: Record<WeekId, CommittedPlan | null>
  deferralHistory: Record<ItemId, DeferralRecord[]>
  storageNotice: string | null
}

export type PlanAction =
  | { type: 'set-decision'; weekId: WeekId; decision: DraftDecision }
  | { type: 'set-booking'; weekId: WeekId; booking: ReplacementBooking }
  | { type: 'clear-booking'; weekId: WeekId; vehicleId: VehicleId }
  | { type: 'commit'; weekId: WeekId }
  | { type: 'advance-days'; days: number }
  | { type: 'advance-to-next-review' }
  | { type: 'reset' }
  | { type: 'dismiss-notice' }

export function activeWeekId(state: AppState): WeekId {
  return mondayOf(state.demoDate)
}

export interface QueueEntry {
  item: OpenItem
  resurfacedBecause: string | null
  priorDecision: DeferralRecord | null
}

/**
 * The week's queue is its authored items plus anything resurfacing from an
 * earlier week. Week 41 authors two of its own; week 42 and later author
 * none, so they show resurfaced work only. [S 3.7]
 */
export function queueFor(args: { fixture: Fixture; state: AppState; weekId: WeekId }): QueueEntry[] {
  const { fixture, state, weekId } = args
  const week = weekFixtureFor(fixture, weekId)
  const authored = fixture.items
    .filter((i) => week.itemIds.includes(i.id))
    .map((item) => ({ item, resurfacedBecause: null, priorDecision: null }))

  const resurfaced = resurfacedItems({
    fixture,
    history: state.deferralHistory,
    demoDate: state.demoDate,
  })
    .filter((r) => !week.itemIds.includes(r.item.id))
    .map((r) => ({ item: r.item, resurfacedBecause: r.because, priorDecision: r.record }))

  return [...authored, ...resurfaced]
}

export function draftFor(args: {
  fixture: Fixture
  state: AppState
  weekId: WeekId
}): Record<ItemId, DraftDecision> {
  const { fixture, state, weekId } = args
  const existing = state.draftByWeek[weekId]
  const seeded: Record<ItemId, DraftDecision> = {}

  for (const entry of queueFor({ fixture, state, weekId })) {
    // Every entry opens undecided, authored or resurfaced alike. The
    // proposal stays on the item and is adopted only by the user's own
    // action (adoptProposal); a resurfaced item's earlier rationale stays
    // visible through priorDecision. [scenario spec §3.1, WP E6.4]
    seeded[entry.item.id] = { itemId: entry.item.id, treatment: null, slotDate: null, deferral: null }
  }
  return { ...seeded, ...(existing ?? {}) }
}

export function bookingsFor(args: {
  state: AppState
  weekId: WeekId
}): Record<VehicleId, ReplacementBooking> {
  return args.state.draftBookingsByWeek[args.weekId] ?? {}
}

export function initialState(_fixture: Fixture): AppState {
  return {
    version: 1,
    demoDate: SEED_DATE,
    draftByWeek: {},
    draftBookingsByWeek: {},
    committedByWeek: {},
    deferralHistory: {},
    storageNotice: null,
  }
}

export function planReducer(state: AppState, action: PlanAction, fixture: Fixture): AppState {
  switch (action.type) {
    case 'set-decision': {
      const current = draftFor({ fixture, state, weekId: action.weekId })
      // A deferral is meaningful only under watch. Normalising at the write
      // site keeps a decision moved off watch from carrying a stale follow-up.
      const decision: DraftDecision =
        action.decision.treatment === 'watch' ? action.decision : { ...action.decision, deferral: null }
      return {
        ...state,
        draftByWeek: {
          ...state.draftByWeek,
          [action.weekId]: { ...current, [decision.itemId]: decision },
        },
      }
    }

    case 'set-booking': {
      const current = bookingsFor({ state, weekId: action.weekId })
      return {
        ...state,
        draftBookingsByWeek: {
          ...state.draftBookingsByWeek,
          [action.weekId]: { ...current, [action.booking.vehicleId]: action.booking },
        },
      }
    }

    case 'clear-booking': {
      const current = { ...bookingsFor({ state, weekId: action.weekId }) }
      delete current[action.vehicleId]
      return {
        ...state,
        draftBookingsByWeek: { ...state.draftBookingsByWeek, [action.weekId]: current },
      }
    }

    case 'commit': {
      const decisions = draftFor({ fixture, state, weekId: action.weekId })
      const bookings = bookingsFor({ state, weekId: action.weekId })
      const plan = commitPlan({ weekId: action.weekId, decisions, bookings, demoDate: state.demoDate })
      // Rebuild history only for items this plan actually decided. An item
      // decided away from a deferral must lose its old record, or it resurfaces
      // forever on a stale rationale. An item still undisposed has decided
      // nothing, so its history must survive untouched.
      const history = { ...state.deferralHistory }
      const newRecords = new Map(deferralRecordsFrom(plan).map((r) => [r.itemId, r]))
      for (const [itemId, decision] of Object.entries(plan.decisions)) {
        if (decision.treatment === null) continue
        const others = (history[itemId] ?? []).filter((r) => r.weekId > plan.weekId)
        const record = newRecords.get(itemId)
        const next = record ? [...others, record] : others
        if (next.length === 0) delete history[itemId]
        else history[itemId] = next
      }
      return {
        ...state,
        draftByWeek: { ...state.draftByWeek, [action.weekId]: decisions },
        draftBookingsByWeek: { ...state.draftBookingsByWeek, [action.weekId]: bookings },
        committedByWeek: { ...state.committedByWeek, [action.weekId]: plan },
        deferralHistory: history,
      }
    }

    case 'advance-days':
      return { ...state, demoDate: addDays(state.demoDate, action.days) }

    case 'advance-to-next-review': {
      const next = nextResurfaceDate({
        fixture,
        history: state.deferralHistory,
        after: state.demoDate,
      })
      return next === null ? state : { ...state, demoDate: next }
    }

    case 'reset':
      return initialState(fixture)

    case 'dismiss-notice':
      return { ...state, storageNotice: null }
  }
}
