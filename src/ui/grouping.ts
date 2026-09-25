import { formatDay } from '../domain/clock'
import { isDeferralComplete } from '../domain/deferral'
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

type UndisposedBlocker = Extract<Blocker, { kind: 'undisposed-item' }>

/**
 * Only a capacity, slot or parts blocker makes an item "blocking". An item
 * with no decision, a watch without its record, or a visit treatment without
 * a slot is "open": work still to do, in the dashboard's amber, not a failure
 * in red. Validation is unchanged, so an open item still blocks Commit; this
 * is the third group the declutter spec reserved. [D §4, scenario spec §4]
 */
export function classifyItem(args: {
  item: OpenItem
  decision: DraftDecision | undefined
  blockers: Blocker[]
  fixture: Fixture
}): QueueGroupKind {
  const { item, decision, blockers, fixture } = args
  const hard = blockersForItem(blockers, item, fixture).filter((b) => b.kind !== 'undisposed-item')
  if (hard.length > 0) return 'blocking'
  if (!decision || decision.treatment === null) return 'open'
  if (decision.treatment === 'watch') return isDeferralComplete(decision.deferral) ? 'settled' : 'open'
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
  /** crit for a hard blocker, warn for a decision still waiting. */
  tone: 'crit' | 'warn'
}

/**
 * One chip per hard blocker, in the order validatePlan produced them. A
 * capacity blocker targets the first item in queue order it is attributed to,
 * which excludes held vehicles the same way the tiles do. Two or more
 * undecided items collapse into one amber chip, in the position of the first
 * of them, targeting the first undecided item in queue order; a single one
 * keeps its own name. [D §5, scenario spec §4]
 */
export function blockerChips(args: {
  blockers: Blocker[]
  items: OpenItem[]
  decisions: Record<ItemId, DraftDecision>
  fixture: Fixture
}): BlockerChip[] {
  const { blockers, fixture } = args
  const ordered = orderQueue(args)
  const undisposed = blockers.filter((b): b is UndisposedBlocker => b.kind === 'undisposed-item')
  const out: BlockerChip[] = []
  let collapsed = false

  for (const b of blockers) {
    if (b.kind === 'undisposed-item') {
      if (undisposed.length === 1) {
        out.push(itemChip(b, 'no decision', 'warn', fixture))
      } else if (!collapsed) {
        collapsed = true
        const target = ordered.find((item) => undisposed.some((u) => u.itemId === item.id)) ?? null
        out.push({
          key: 'undisposed-all',
          label: `${undisposed.length} to decide`,
          targetItemId: target === null ? null : target.id,
          tone: 'warn',
        })
      }
      continue
    }
    if (b.kind === 'capacity-shortfall') {
      const target =
        ordered.find((item) => blockersForItem(blockers, item, fixture).includes(b)) ?? null
      out.push({
        key: `capacity-${b.date}-${b.vehicleClass}`,
        label: `${formatDay(b.date)} · ${b.vehicleClass} short ${b.shortBy}`,
        targetItemId: target === null ? null : target.id,
        tone: 'crit',
      })
      continue
    }
    out.push(itemChip(b, b.kind === 'parts-not-ready' ? 'parts not ready' : 'slot not bookable', 'crit', fixture))
  }
  return out
}

function itemChip(
  b: Extract<Blocker, { itemId: ItemId }>,
  reason: string,
  tone: 'crit' | 'warn',
  fixture: Fixture,
): BlockerChip {
  const vehicleId = fixture.items.find((i) => i.id === b.itemId)?.vehicleId ?? b.itemId
  return { key: `${b.kind}-${b.itemId}`, label: `${vehicleId} · ${reason}`, targetItemId: b.itemId, tone }
}
