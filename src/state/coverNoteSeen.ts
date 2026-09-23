/**
 * Reads and writes the cover note's "seen" flag. The only module touching
 * this storage key: it is UI chrome, not plan state, so it has no place in
 * the structure state/persistence.ts owns, and it must survive the demo
 * bar's Reset, which clears plan state only. [cover note spec 5.2]
 *
 * localStorage throws in private browsing, on quota exhaustion, and when
 * storage is disabled by policy. Both access paths below are wrapped so
 * neither can propagate: this module runs on first render, and an unhandled
 * throw there would take down the app before anything is drawn. [cover note
 * spec 5.3]
 */

export const STORAGE_KEY = 'fleet-maintenance-prototype/cover-note/v1'
const SEEN = 'seen'

/**
 * True only if the stored value is exactly "seen". Absence, any other value,
 * or a read failure all mean false, so the cover note is shown. Showing it
 * once too often is harmless; suppressing it wrongly is not.
 */
export function hasSeenCoverNote(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === SEEN
  } catch {
    return false
  }
}

/**
 * Marks the cover note as seen. A write failure is swallowed: the user still
 * proceeds to the plan, and the only consequence is that the cover note
 * reappears on the next load, which costs one click.
 */
export function markCoverNoteSeen(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, SEEN)
  } catch {
    // Swallowed deliberately. See the module doc comment above.
  }
}
