import { describe, expect, it } from 'vitest'
import { hasSeenCoverNote, markCoverNoteSeen, STORAGE_KEY } from '../state/coverNoteSeen'

/**
 * Installs a Map-backed localStorage on globalThis.window for the duration
 * of run(), then removes it. Mirrors the stub in persistence.test.ts. The
 * Vitest environment for this project is node, so window does not exist
 * otherwise.
 */
function withStoredValue(raw: string | null, run: () => void) {
  const store = new Map<string, string>()
  if (raw !== null) store.set(STORAGE_KEY, raw)
  ;(globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v)
      },
      removeItem: (k: string) => {
        store.delete(k)
      },
    },
  }
  try {
    run()
  } finally {
    delete (globalThis as { window?: unknown }).window
  }
}

/** Installs a localStorage stub whose getItem and/or setItem throw, to
 *  exercise both read-failure and write-failure paths. */
function withThrowingStorage(
  overrides: { getItem?: () => string | null; setItem?: (k: string, v: string) => void },
  run: () => void,
) {
  ;(globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: overrides.getItem ?? (() => null),
      setItem: overrides.setItem ?? (() => {}),
      removeItem: () => {},
    },
  }
  try {
    run()
  } finally {
    delete (globalThis as { window?: unknown }).window
  }
}

describe('hasSeenCoverNote', () => {
  it('is false when the flag is absent', () => {
    withStoredValue(null, () => {
      expect(hasSeenCoverNote()).toBe(false)
    })
  })

  it('is true when the stored value is exactly "seen"', () => {
    withStoredValue('seen', () => {
      expect(hasSeenCoverNote()).toBe(true)
    })
  })

  it('is false for an unrecognised stored value', () => {
    withStoredValue('true', () => {
      expect(hasSeenCoverNote()).toBe(false)
    })
  })

  it('is false, and does not throw, when localStorage.getItem throws', () => {
    withThrowingStorage(
      {
        getItem: () => {
          throw new Error('SecurityError: storage disabled')
        },
      },
      () => {
        let result: boolean | undefined
        expect(() => {
          result = hasSeenCoverNote()
        }).not.toThrow()
        expect(result).toBe(false)
      },
    )
  })
})

describe('markCoverNoteSeen', () => {
  it('writes the flag so a later read reports the cover note as seen', () => {
    withStoredValue(null, () => {
      markCoverNoteSeen()
      expect(hasSeenCoverNote()).toBe(true)
    })
  })

  it('does not throw when localStorage.setItem throws', () => {
    withThrowingStorage(
      {
        setItem: () => {
          throw new Error('QuotaExceededError')
        },
      },
      () => {
        expect(() => markCoverNoteSeen()).not.toThrow()
      },
    )
  })
})
