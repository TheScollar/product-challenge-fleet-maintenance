import { initialState, type AppState } from './planReducer'
import type { Fixture } from '../domain/types'

export const STORAGE_KEY = 'fleet-maintenance-prototype/v1'
const CURRENT_VERSION = 1

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Shallow shape check for a CommittedPlan: the three fields resurfacedItems
 *  and the reducer actually read, nothing deeper. */
function isValidCommittedPlan(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    typeof value.weekId === 'string' &&
    typeof value.committedOn === 'string' &&
    isPlainObject(value.decisions)
  )
}

function isValidCommittedByWeek(value: unknown): boolean {
  return isPlainObject(value) && Object.values(value).every((v) => v === null || isValidCommittedPlan(v))
}

/** Shallow shape check for a DeferralRecord: enough to let latestRecord sort
 *  and resurfacing() read a record without throwing, nothing deeper. */
function isValidDeferralRecord(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    typeof value.weekId === 'string' &&
    typeof value.decidedOn === 'string' &&
    isPlainObject(value.deferral)
  )
}

function isValidDeferralHistory(value: unknown): boolean {
  return (
    isPlainObject(value) && Object.values(value).every((v) => Array.isArray(v) && v.every(isValidDeferralRecord))
  )
}

/**
 * Every failure path falls back to the seed and says so in the demo bar.
 * Storage is never trusted: it can be absent, disabled, full, corrupt, or
 * written by an older build. None of those may crash the app. [S 5.2]
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
    if (typeof parsed.demoDate !== 'string' || typeof parsed.draftByWeek !== 'object') {
      return { ...fresh, storageNotice: 'Saved state was incomplete. Reset to the seed.' }
    }
    // A parseable envelope with the right version and a plausible demoDate
    // can still carry a committedByWeek or deferralHistory that is the wrong
    // shape entirely (a string, an array, records missing their weekId).
    // Left unchecked, that reaches latestRecord's sort and throws well after
    // this function returns. Checked here, it is just another incomplete save.
    if (!isValidCommittedByWeek(parsed.committedByWeek) || !isValidDeferralHistory(parsed.deferralHistory)) {
      return { ...fresh, storageNotice: 'Saved state was incomplete. Reset to the seed.' }
    }
    return {
      version: CURRENT_VERSION,
      demoDate: parsed.demoDate,
      draftByWeek: parsed.draftByWeek ?? {},
      committedByWeek: parsed.committedByWeek ?? {},
      deferralHistory: parsed.deferralHistory ?? {},
      storageNotice: null,
    }
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
