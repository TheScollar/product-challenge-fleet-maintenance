import { parseISO, toISO } from '../domain/clock'
import { initialState, type AppState } from './planReducer'
import type {
  CommittedPlan,
  Deferral,
  DeferralRecord,
  DraftDecision,
  Fixture,
  ISODate,
  Trigger,
} from '../domain/types'

export const STORAGE_KEY = 'fleet-maintenance-prototype/v1'
const CURRENT_VERSION = 1
const TREATMENTS = new Set(['act-now', 'bundle', 'watch'])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * A regex match alone is not enough: parseISO silently normalises an
 * out-of-range day (2026-02-30 becomes 2026-03-02) instead of rejecting it.
 * Parsing the string back to a Date and formatting it again is the only way
 * to catch that, so a value only counts as an ISODate here if it survives
 * the round trip unchanged.
 */
function isISODate(x: unknown): x is ISODate {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false
  try {
    return toISO(parseISO(x)) === x
  } catch {
    return false
  }
}

const MAX_PLAUSIBLE_THRESHOLD_KM = 2_000_000

function isTrigger(value: unknown): value is Trigger {
  if (!isPlainObject(value)) return false
  if (value.kind === 'event') {
    return typeof value.eventId === 'string' && typeof value.label === 'string'
  }
  if (value.kind === 'odometer') {
    return (
      typeof value.vehicleId === 'string' &&
      typeof value.thresholdKm === 'number' &&
      // Bounded, not merely finite. nextResurfaceDate turns the threshold
      // into a day count for addDays, and a finite-but-absurd value (around
      // 1e10 km) pushes the projected date past what Date can represent,
      // which throws. No real odometer threshold approaches 2,000,000 km,
      // so anything above it is corrupt data, not a big fleet.
      value.thresholdKm > 0 &&
      value.thresholdKm <= MAX_PLAUSIBLE_THRESHOLD_KM &&
      typeof value.label === 'string'
    )
  }
  return false
}

function isDeferral(value: unknown): value is Deferral {
  if (!isPlainObject(value)) return false
  const { reason, reviewDate, trigger } = value
  return typeof reason === 'string' && reason.trim().length > 0 && isISODate(reviewDate) && isTrigger(trigger)
}

function isDraftDecision(value: unknown): value is DraftDecision {
  if (!isPlainObject(value)) return false
  const { itemId, treatment, slotDate, deferral } = value
  return (
    typeof itemId === 'string' &&
    (treatment === null || (typeof treatment === 'string' && TREATMENTS.has(treatment))) &&
    (slotDate === null || isISODate(slotDate)) &&
    (deferral === null || isDeferral(deferral))
  )
}

function isDecisionsMap(value: unknown): value is Record<string, DraftDecision> {
  return isPlainObject(value) && Object.values(value).every(isDraftDecision)
}

function isCommittedPlan(value: unknown): value is CommittedPlan {
  if (!isPlainObject(value)) return false
  const { weekId, committedOn, decisions } = value
  return isISODate(weekId) && isISODate(committedOn) && isDecisionsMap(decisions)
}

function isDeferralRecord(value: unknown): value is DeferralRecord {
  if (!isPlainObject(value)) return false
  const { itemId, decidedOn, weekId, deferral } = value
  return typeof itemId === 'string' && isISODate(decidedOn) && isISODate(weekId) && isDeferral(deferral)
}

/** The full shape of a stored AppState, minus storageNotice, which is never
 *  persisted meaningfully and is overwritten on every load. */
function isValidState(value: Partial<AppState>): value is AppState {
  const { version, demoDate, draftByWeek, committedByWeek, deferralHistory } = value
  return (
    version === CURRENT_VERSION &&
    isISODate(demoDate) &&
    isPlainObject(draftByWeek) &&
    Object.values(draftByWeek).every(isDecisionsMap) &&
    isPlainObject(committedByWeek) &&
    Object.values(committedByWeek).every((v) => v === null || isCommittedPlan(v)) &&
    isPlainObject(deferralHistory) &&
    Object.values(deferralHistory).every((v) => Array.isArray(v) && v.every(isDeferralRecord))
  )
}

/**
 * Every date string in stored state, demoDate, every slotDate and
 * reviewDate, every weekId, committedOn and decidedOn, is checked by
 * isISODate before this function returns it. isISODate does not stop at
 * matching the YYYY-MM-DD pattern: it also round-trips the value through
 * toISO(parseISO(x)) and rejects anything that comes back different, which
 * is what catches a calendar-invalid date such as 2026-02-30 that parseISO
 * alone would silently normalise into the following month rather than
 * reject. So every date string that later flows into parseISO, formatDay,
 * addDays, or a date comparison has been round-trip checked here, and the
 * one stored number that feeds date arithmetic, an odometer trigger's
 * thresholdKm, is bounded so its projected date stays representable.
 *
 * Everything else about the payload, treatments, reasons, trigger kinds and
 * the ids they name, is checked only for shape, not for whether the event or
 * vehicle a trigger names actually exists in the fixture. Any shape failure,
 * unparseable JSON, or a version mismatch falls back to the seed and says so
 * in the demo bar: storage is never trusted, and none of its failure modes
 * may crash the app. [S 5.2]
 */
export function loadState(fixture: Fixture): AppState {
  const fresh = initialState(fixture)
  let raw: string | null = null

  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return { ...fresh, storageNotice: 'Saved state is unavailable in this browser. Running from the seed.' }
  }
  if (raw === null) return fresh

  try {
    const parsed = JSON.parse(raw) as Partial<AppState>
    if (parsed.version !== CURRENT_VERSION) {
      return { ...fresh, storageNotice: 'Saved state was written by an older build. Reset to the seed.' }
    }
    if (!isValidState(parsed)) {
      return { ...fresh, storageNotice: 'Saved state was incomplete. Reset to the seed.' }
    }
    return { ...parsed, storageNotice: null }
  } catch {
    return { ...fresh, storageNotice: 'Saved state could not be read. Reset to the seed.' }
  }
}

export function saveState(state: AppState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, storageNotice: null }))
  } catch {
    // A full or disabled quota must not interrupt planning. The in-memory
    // state stays correct; only the reload survivability is lost.
  }
}

export function clearState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do. Reset still restores the seed in memory.
  }
}
