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

/** The system proposals exactly as the fixture ships them. */
export function coldOpenDecisions(): Record<ItemId, DraftDecision> {
  const out: Record<ItemId, DraftDecision> = {}
  for (const i of fixture.items) {
    out[i.id] = {
      itemId: i.id,
      treatment: i.proposal.treatment,
      slotDate: i.proposal.slotDate,
      deferral: i.proposal.deferral,
    }
  }
  return out
}
