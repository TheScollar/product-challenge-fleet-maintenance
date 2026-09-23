import { addDays, formatDay, hasEventFired, projectedOdometerKm } from './clock'
import type { Deferral, DeferralRecord, Fixture, ISODate, ItemId, OpenItem, Trigger } from './types'

/** Reason, review date and trigger are all required. [WP E6.2, E6.3] */
export function deferralErrors(d: Partial<Deferral> | null): string[] {
  const errors: string[] = []
  if (!d || typeof d.reason !== 'string' || d.reason.trim() === '') errors.push('Rationale is required')
  if (!d || !d.reviewDate) errors.push('Review date is required')
  if (!d || !d.trigger) errors.push('Trigger is required')
  return errors
}

export function isDeferralComplete(d: Partial<Deferral> | null): boolean {
  return deferralErrors(d).length === 0
}

/**
 * Both trigger kinds reduce to advancing the demo clock. A "fire trigger now"
 * button would be a demo affordance with no real-world analogue. [S 3.6]
 */
export function triggerFired(trigger: Trigger, fixture: Fixture, demoDate: ISODate): boolean {
  if (trigger.kind === 'event') return hasEventFired(fixture, trigger.eventId, demoDate)
  const vehicle = fixture.vehicles.find((v) => v.id === trigger.vehicleId)
  if (!vehicle) return false
  return projectedOdometerKm(vehicle, demoDate) >= trigger.thresholdKm
}

export function resurfacing(
  record: DeferralRecord,
  fixture: Fixture,
  demoDate: ISODate,
): { resurfaced: boolean; because: string | null } {
  if (triggerFired(record.deferral.trigger, fixture, demoDate)) {
    return { resurfaced: true, because: `Trigger fired: ${record.deferral.trigger.label}` }
  }
  if (demoDate >= record.deferral.reviewDate) {
    return { resurfaced: true, because: `Review date ${formatDay(record.deferral.reviewDate)} reached` }
  }
  return { resurfaced: false, because: null }
}

/**
 * Returns each resurfaced item alongside the record that deferred it, so the
 * prior decision and rationale come back intact rather than being
 * re-evaluated from zero. [WP E6.4]
 */
export function resurfacedItems(args: {
  fixture: Fixture
  history: Record<ItemId, DeferralRecord[]>
  demoDate: ISODate
}): Array<{ item: OpenItem; record: DeferralRecord; because: string }> {
  const { fixture, history, demoDate } = args
  const out: Array<{ item: OpenItem; record: DeferralRecord; because: string }> = []

  for (const [itemId, records] of Object.entries(history)) {
    if (records.length === 0) continue
    // Recency is weekId first, then decidedOn. The commit reducer maintains at
    // most one record per item per week, which is a precondition it enforces
    // rather than a property of any history value: loadState rehydrates this
    // map from storage without validating it. decidedOn is a real secondary
    // key, not a function of weekId, so it still breaks a tie if a stored
    // history ever arrives with two records for one week.
    const latest = [...records]
      .sort((a, b) => a.weekId.localeCompare(b.weekId) || a.decidedOn.localeCompare(b.decidedOn))
      .at(-1) as DeferralRecord
    const item = fixture.items.find((i) => i.id === itemId)
    if (!item) continue
    const { resurfaced, because } = resurfacing(latest, fixture, demoDate)
    if (resurfaced && because) out.push({ item, record: latest, because })
  }
  return out.sort((a, b) => a.item.id.localeCompare(b.item.id))
}

/**
 * The earliest date strictly after `after` on which some deferred item comes
 * back. Returns null when nothing is pending, which is what disables the
 * "advance to next review date" control. [S 6.3]
 */
export function nextResurfaceDate(args: {
  fixture: Fixture
  history: Record<ItemId, DeferralRecord[]>
  after: ISODate
}): ISODate | null {
  const { fixture, history, after } = args
  const candidates: ISODate[] = []

  for (const records of Object.values(history)) {
    const latest = [...records].sort((a, b) => a.decidedOn.localeCompare(b.decidedOn)).at(-1)
    if (!latest) continue
    if (latest.deferral.reviewDate > after) candidates.push(latest.deferral.reviewDate)
    const trigger = latest.deferral.trigger
    if (trigger.kind === 'event') {
      const event = fixture.events.find((e) => e.eventId === trigger.eventId)
      if (event && event.firesOn > after) candidates.push(event.firesOn)
    } else {
      const vehicle = fixture.vehicles.find((v) => v.id === trigger.vehicleId)
      if (vehicle && vehicle.weeklyRateKm > 0) {
        const kmNeeded = trigger.thresholdKm - vehicle.odometerKm
        const days = Math.ceil(kmNeeded / (vehicle.weeklyRateKm / 7))
        const date = addDays(vehicle.odometerReadOn, Math.max(0, days))
        if (date > after) candidates.push(date)
      }
    }
  }
  return candidates.length === 0 ? null : candidates.sort()[0]
}
