import { formatDay } from './clock'
import { consequenceView, type ConsequenceView } from './consequence'
import type { DraftDecision, ISODate, OpenItem, Urgency, Vehicle } from './types'

export interface RecommendationView {
  urgency: Urgency
  observation: string
  source: string
  receivedOn: ISODate
  verbatim: string | null
  relevantDate: ISODate | null
  assumption: string | null
  proposedAction: string
  consequence: ConsequenceView
}

function proposedAction(item: OpenItem): string {
  const { treatment, slotDate, deferral } = item.proposal
  if (treatment === 'watch' && deferral) {
    return `Watch. Review on ${formatDay(deferral.reviewDate)}, or sooner if the trigger fires: ${deferral.trigger.label.toLowerCase()}.`
  }
  if (slotDate === null) {
    // No date is invented where the evidence supports none. [S 3.2]
    return `Assess. A diagnostic visit is proposed, and a slot has not been chosen yet.`
  }
  const days = item.visitDays === 1 ? '1 day' : `${item.visitDays} days`
  return `Book a visit: ${formatDay(slotDate)}, ${days}.`
}

/**
 * The proposal is the system's; adopting it is the user's act. This is the
 * one definition of "adopt", used by the Use proposal button and by the
 * tests, so the two can never drift. A deferral belongs only to a watch and
 * a slot only to a visit. [scenario spec §3.2]
 */
export function adoptProposal(item: OpenItem): DraftDecision {
  const { treatment, slotDate, deferral } = item.proposal
  return {
    itemId: item.id,
    treatment,
    slotDate: treatment === 'watch' ? null : slotDate,
    deferral: treatment === 'watch' ? deferral : null,
  }
}

export function recommendationFor(item: OpenItem): RecommendationView {
  return {
    urgency: item.urgency,
    observation: item.evidence.observation,
    source: item.evidence.source,
    receivedOn: item.evidence.receivedOn,
    verbatim: item.evidence.verbatim,
    relevantDate: item.urgency.relevantDate,
    assumption: item.assumption,
    proposedAction: proposedAction(item),
    consequence: consequenceView(item),
  }
}

/**
 * Watch is never offered for a hard-stop item. The control is rendered
 * disabled with this reason rather than hidden, because a hidden control
 * teaches nothing. [S 3.5]
 */
export function watchAvailable(item: OpenItem, vehicle: Vehicle): boolean {
  return !item.safetyClass && vehicle.hold === null
}

export function watchUnavailableReason(): string {
  return 'Safety class under UVV. The van is out of service until a release is recorded, so waiting is not an option here.'
}
