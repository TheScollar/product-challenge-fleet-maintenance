import { initialState, type AppState } from './planReducer'
import type { Fixture } from '../domain/types'

export const STORAGE_KEY = 'fleet-maintenance-prototype/v1'
const CURRENT_VERSION = 1

/**
 * Every failure path falls back to the seed and says so in the demo bar.
 * Storage is never trusted: it can be absent, disabled, full, or written by
 * an older build. None of those may crash the app. [S 5.2]
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
