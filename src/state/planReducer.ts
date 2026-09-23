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
  WeekId,
} from '../domain/types'

export interface AppState {
  version: 1
  demoDate: ISODate
  draftByWeek: Record<WeekId, Record<ItemId, DraftDecision>>
  committedByWeek: Record<WeekId, CommittedPlan | null>
  deferralHistory: Record<ItemId, DeferralRecord[]>
  storageNotice: string | null
}

export type PlanAction =
  | { type: 'set-decision'; weekId: WeekId; decision: DraftDecision }
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
 * earlier week. Week 41 and later author no items, so they show resurfaced
 * work only. [S 3.7]
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
    const { item, priorDecision } = entry
    seeded[item.id] = priorDecision
      ? // A resurfaced item comes back undisposed, but its prior rationale
        // stays visible through priorDecision. [WP E6.4]
        { itemId: item.id, treatment: null, slotDate: null, deferral: null }
      : {
          itemId: item.id,
          treatment: item.proposal.treatment,
          slotDate: item.proposal.slotDate,
          deferral: item.proposal.deferral,
        }
  }
  return { ...seeded, ...(existing ?? {}) }
}

export function initialState(_fixture: Fixture): AppState {
  return {
    version: 1,
    demoDate: SEED_DATE,
    draftByWeek: {},
    committedByWeek: {},
    deferralHistory: {},
    storageNotice: null,
  }
}

export function planReducer(state: AppState, action: PlanAction, fixture: Fixture): AppState {
  switch (action.type) {
    case 'set-decision': {
      const current = draftFor({ fixture, state, weekId: action.weekId })
      return {
        ...state,
        draftByWeek: {
          ...state.draftByWeek,
          [action.weekId]: { ...current, [action.decision.itemId]: action.decision },
        },
      }
    }

    case 'commit': {
      const decisions = draftFor({ fixture, state, weekId: action.weekId })
      const plan = commitPlan({ weekId: action.weekId, decisions, demoDate: state.demoDate })
      // Records are replaced per item rather than appended, so recommitting
      // the same week cannot accumulate duplicates.
      const history = { ...state.deferralHistory }
      for (const record of deferralRecordsFrom(plan)) {
        // This reducer keeps at most one record per item per week. resurfacedItems
        // relies on that as a precondition rather than as a guarantee, since
        // loadState can rehydrate a history this reducer did not build.
        const others = (history[record.itemId] ?? []).filter((r) => r.weekId !== plan.weekId)
        history[record.itemId] = [...others, record]
      }
      return {
        ...state,
        draftByWeek: { ...state.draftByWeek, [action.weekId]: decisions },
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
