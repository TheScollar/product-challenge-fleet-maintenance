import { fixture } from './fixture'
import type { DraftDecision, ItemId, OpenItem, Vehicle } from './types'

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

/** The system proposals exactly as the fixture ships them for week 40 (the cold open). */
export function coldOpenDecisions(): Record<ItemId, DraftDecision> {
  const out: Record<ItemId, DraftDecision> = {}
  const week40ItemIds = fixture.weeks[0].itemIds
  for (const i of fixture.items) {
    if (week40ItemIds.includes(i.id)) {
      out[i.id] = {
        itemId: i.id,
        treatment: i.proposal.treatment,
        slotDate: i.proposal.slotDate,
        deferral: i.proposal.deferral,
      }
    }
  }
  return out
}
