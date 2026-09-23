import { describe, expect, it } from 'vitest'
import { fixture } from './fixture'
import { initialState, planReducer, type AppState } from '../state/planReducer'
import { loadState, saveState, STORAGE_KEY } from '../state/persistence'

const reduce = (s: AppState, a: Parameters<typeof planReducer>[1]) => planReducer(s, a, fixture)

/**
 * Installs a Map-backed localStorage on globalThis.window for the duration
 * of run(), then removes it. The Vitest environment for this project is
 * node, so window does not exist otherwise.
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

function validEnvelope(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 1,
    demoDate: '2026-09-28',
    draftByWeek: {},
    committedByWeek: {},
    deferralHistory: {},
    storageNotice: null,
    ...overrides,
  })
}

function expectSeedEquivalent(actual: AppState) {
  const seed = initialState(fixture)
  expect(actual.version).toBe(seed.version)
  expect(actual.demoDate).toBe(seed.demoDate)
  expect(actual.draftByWeek).toEqual(seed.draftByWeek)
  expect(actual.committedByWeek).toEqual(seed.committedByWeek)
  expect(actual.deferralHistory).toEqual(seed.deferralHistory)
}

/** A real committed state, not a hand-built object, so the round trip
 *  exercises the same shapes loadState now validates. */
function committedRealState(): AppState {
  const s = reduce(initialState(fixture), {
    type: 'set-decision',
    weekId: '2026-09-28',
    decision: {
      itemId: 'item-v041',
      treatment: 'watch',
      slotDate: null,
      deferral: {
        reason: 'No specialist cover this week.',
        reviewDate: '2026-10-05',
        trigger: { kind: 'event', eventId: 'v041-dtc-recurs', label: 'DTC P0300 recurs' },
      },
    },
  })
  return reduce(s, { type: 'commit', weekId: '2026-09-28' })
}

describe('loadState', () => {
  it('returns the seed when storage is absent', () => {
    withStoredValue(null, () => {
      const s = loadState(fixture)
      expectSeedEquivalent(s)
      expect(s.storageNotice).toBeNull()
    })
  })

  it('falls back to the seed on unparseable JSON, and does not throw', () => {
    withStoredValue('not valid json {', () => {
      let s: AppState | undefined
      expect(() => {
        s = loadState(fixture)
      }).not.toThrow()
      expectSeedEquivalent(s!)
      expect(s!.storageNotice).not.toBeNull()
    })
  })

  it('falls back to the seed on a wrong version', () => {
    withStoredValue(validEnvelope({ version: 2 }), () => {
      const s = loadState(fixture)
      expectSeedEquivalent(s)
      expect(s.storageNotice).not.toBeNull()
    })
  })

  it('falls back to the seed, and does not throw, when deferralHistory is a string', () => {
    withStoredValue(validEnvelope({ deferralHistory: 'garbage' }), () => {
      let s: AppState | undefined
      expect(() => {
        s = loadState(fixture)
      }).not.toThrow()
      expectSeedEquivalent(s!)
      expect(s!.storageNotice).not.toBeNull()
    })
  })

  it('falls back to the seed, and does not throw, when a deferral record is missing its fields', () => {
    withStoredValue(validEnvelope({ deferralHistory: { 'item-v041': [{ x: 1 }] } }), () => {
      let s: AppState | undefined
      expect(() => {
        s = loadState(fixture)
      }).not.toThrow()
      expectSeedEquivalent(s!)
      expect(s!.storageNotice).not.toBeNull()
    })
  })

  it('round-trips a real committed state through saveState', () => {
    withStoredValue(null, () => {
      const real = committedRealState()
      saveState(real)
      const loaded = loadState(fixture)
      expect(loaded).toEqual(real)
      expect(loaded.storageNotice).toBeNull()
    })
  })
})

describe('saveState', () => {
  it('does not throw when localStorage.setItem throws a quota error', () => {
    ;(globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError')
        },
        removeItem: () => {},
      },
    }
    try {
      expect(() => saveState(initialState(fixture))).not.toThrow()
    } finally {
      delete (globalThis as { window?: unknown }).window
    }
  })
})
