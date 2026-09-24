import type { OpenItem } from './types'

export interface ConsequenceView {
  qualitative: string
  serviceCost: string
  coverCost: string
  disruption: string
}

const eur = (n: number) => `EUR ${n.toLocaleString('en-GB')}`

/**
 * Service cost stays the fixture's estimate, shown before any decision,
 * because it is the number the decision is weighed against. Cover is
 * different: it exists only where a replacement was actually requested, so
 * it reads "not requested" until then, never a hand-authored guess and never
 * zero. A specialist still reads "not available", whatever is passed, because
 * no compatible cover exists at any price. Operational disruption stays a
 * count and never becomes money. [S 3.4, scenario spec §5.5]
 */
export function consequenceView(
  item: OpenItem,
  requestedCoverCostEur: number | null = null,
): ConsequenceView {
  const c = item.consequence
  return {
    qualitative: c.qualitative,
    serviceCost: c.serviceCostEur === null ? 'not stated' : eur(c.serviceCostEur),
    coverCost: c.coverUnavailable
      ? 'not available'
      : requestedCoverCostEur === null
        ? 'not requested'
        : eur(requestedCoverCostEur),
    disruption: c.uncoveredAssignmentsNote,
  }
}
