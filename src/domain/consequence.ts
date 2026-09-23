import type { OpenItem } from './types'

export interface ConsequenceView {
  qualitative: string
  serviceCost: string
  coverCost: string
  disruption: string
}

const eur = (n: number) => `EUR ${n.toLocaleString('en-GB')}`

/**
 * Three figures, kept apart. Cover reads "not available" rather than zero
 * where no compatible cover exists, because zero would read as free rather
 * than impossible, which is the opposite of the point V-041 makes.
 * Operational disruption stays a count and never becomes money. [S 3.4]
 */
export function consequenceView(item: OpenItem): ConsequenceView {
  const c = item.consequence
  return {
    qualitative: c.qualitative,
    serviceCost: c.serviceCostEur === null ? 'not stated' : eur(c.serviceCostEur),
    coverCost: c.coverUnavailable
      ? 'not available'
      : c.coverCostEur === null
        ? 'not stated'
        : eur(c.coverCostEur),
    disruption: c.uncoveredAssignmentsNote,
  }
}
