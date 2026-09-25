import { fixture } from './fixture'
import { adoptProposal } from './recommendation'
import { initialState, planReducer, type AppState } from '../state/planReducer'
import type { DraftDecision, Fixture, ItemId, OpenItem, Vehicle } from './types'

const WEEK_40 = '2026-09-28'

export const item = (id: string): OpenItem => {
  const found = fixture.items.find((i) => i.id === id)
  if (!found) throw new Error(`No fixture item ${id}`)
  return found
}

export const vehicle = (id: string): Vehicle => {
  const found = fixture.vehicles.find((v) => v.id === id)
  if (!found) throw new Error(`No fixture vehicle ${id}`)
  return found
}

/**
 * Every week-40 proposal adopted, exactly as the Use proposal button does it:
 * three Tuesday visits, V-027 watched, V-041 proposed with no slot. This is
 * the scripted scenario. It is no longer the cold open, which is undecided.
 */
export function proposedDecisions(fx: Fixture = fixture): Record<ItemId, DraftDecision> {
  const out: Record<ItemId, DraftDecision> = {}
  const week40ItemIds = fx.weeks[0].itemIds
  for (const i of fx.items) {
    if (week40ItemIds.includes(i.id)) out[i.id] = adoptProposal(i)
  }
  return out
}

/** The seed with every week-40 proposal applied through the reducer. */
export function adoptedState(fx: Fixture = fixture): AppState {
  let s = initialState(fx)
  for (const decision of Object.values(proposedDecisions(fx))) {
    s = planReducer(s, { type: 'set-decision', weekId: WEEK_40, decision }, fx)
  }
  return s
}
