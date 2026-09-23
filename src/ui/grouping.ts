import { formatDay } from '../domain/clock'
import { orderQueue } from '../domain/urgency'
import { blockersForItem } from '../domain/validation'
import type { Blocker, DraftDecision, Fixture, ItemId, OpenItem } from '../domain/types'

export type QueueGroupKind = 'blocking' | 'open' | 'settled'

export interface QueueGroup {
  kind: QueueGroupKind
  label: string
  items: OpenItem[]
}

const GROUP_LABELS: Record<QueueGroupKind, string> = {
  blocking: 'Blocking the week',
  open: 'To decide',
  settled: 'Settled',
}

/**
 * Exhaustive classification of a queue item. Under current validation rules
 * 'open' cannot occur: an absent or incomplete decision is itself a commit
 * blocker, so undecided always means blocking. The classifier stays total so
 * a future relaxation of validation gets a third group for free. [D §4]
 */
export function classifyItem(args: {
  item: OpenItem
  decision: DraftDecision | undefined
  blockers: Blocker[]
  fixture: Fixture
}): QueueGroupKind {
  const { item, decision, blockers, fixture } = args
  if (blockersForItem(blockers, item, fixture).length > 0) return 'blocking'
  if (!decision || decision.treatment === null) return 'open'
  if (decision.treatment === 'watch') return decision.deferral === null ? 'open' : 'settled'
  return decision.slotDate === null ? 'open' : 'settled'
}

/** Groups in fixed order, orderQueue order within each, empty groups omitted. [D §4] */
export function groupQueue(args: {
  items: OpenItem[]
  decisions: Record<ItemId, DraftDecision>
  blockers: Blocker[]
  fixture: Fixture
}): QueueGroup[] {
  const { decisions, blockers, fixture } = args
  const by: Record<QueueGroupKind, OpenItem[]> = { blocking: [], open: [], settled: [] }
  for (const item of orderQueue(args)) {
    by[classifyItem({ item, decision: decisions[item.id], blockers, fixture })].push(item)
  }
  return (['blocking', 'open', 'settled'] as const)
    .filter((kind) => by[kind].length > 0)
    .map((kind) => ({ kind, label: GROUP_LABELS[kind], items: by[kind] }))
}

export interface BlockerChip {
  key: string
  label: string
  targetItemId: ItemId | null
}

/**
 * One chip per blocker, in the order validatePlan produced them. An
 * item-attributed blocker targets its item; a capacity blocker targets the
 * first item in queue order it is attributed to, which excludes held
 * vehicles the same way the tiles do. [D §5]
 */
export function blockerChips(args: {
  blockers: Blocker[]
  items: OpenItem[]
  decisions: Record<ItemId, DraftDecision>
  fixture: Fixture
}): BlockerChip[] {
  const { blockers, fixture } = args
  const ordered = orderQueue(args)
  return blockers.map((b) => {
    if (b.kind === 'capacity-shortfall') {
      const target =
        ordered.find((item) => blockersForItem(blockers, item, fixture).includes(b)) ?? null
      return {
        key: `capacity-${b.date}-${b.vehicleClass}`,
        label: `${formatDay(b.date)} · ${b.vehicleClass} short ${b.shortBy}`,
        targetItemId: target === null ? null : target.id,
      }
    }
    const vehicleId = fixture.items.find((i) => i.id === b.itemId)?.vehicleId ?? b.itemId
    const reason =
      b.kind === 'undisposed-item'
        ? 'no decision'
        : b.kind === 'parts-not-ready'
          ? 'parts not ready'
          : 'slot not bookable'
    return { key: `${b.kind}-${b.itemId}`, label: `${vehicleId} · ${reason}`, targetItemId: b.itemId }
  })
}
