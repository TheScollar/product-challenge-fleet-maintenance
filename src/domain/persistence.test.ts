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
    version: 2,
    demoDate: '2026-09-28',
    draftByWeek: {},
    draftBookingsByWeek: {},
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
  expect(actual.draftBookingsByWeek).toEqual(seed.draftBookingsByWeek)
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

function committedRealStateWithBooking(): AppState {
  let s = reduce(initialState(fixture), {
    type: 'set-booking',
    weekId: '2026-09-28',
    booking: { vehicleId: 'V-027', startDate: '2026-09-29', days: 2 },
  })
  s = reduce(s, {
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

/**
 * Every entry is a full JSON string for the storage envelope: valid apart
 * from the one corruption named. Each must fail closed: loadState falls
 * back to the seed, without throwing, and leaves a non-null notice behind.
 */
const CORRUPT_PAYLOADS: Array<{ name: string; payload: string }> = [
  {
    name: 'deferralHistory is a string instead of a map',
    payload: validEnvelope({ deferralHistory: 'garbage' }),
  },
  {
    name: 'odometer trigger with a finite but absurd thresholdKm',
    payload: validEnvelope({
      deferralHistory: {
        'item-v041': [
          {
            itemId: 'item-v041',
            weekId: '2026-09-28',
            decidedOn: '2026-09-28',
            deferral: {
              reason: 'corrupted threshold',
              reviewDate: '2026-10-05',
              trigger: { kind: 'odometer', vehicleId: 'V-118', thresholdKm: 1e12, label: 'x' },
            },
          },
        ],
      },
    }),
  },
  {
    name: 'a deferral record missing every field',
    payload: validEnvelope({ deferralHistory: { 'item-v041': [{ x: 1 }] } }),
  },
  {
    name: 'a deferral record with an empty deferral object',
    payload: validEnvelope({
      deferralHistory: {
        'item-v041': [{ weekId: '2026-09-28', decidedOn: '2026-09-28', deferral: {} }],
      },
    }),
  },
  {
    name: 'a deferral whose reviewDate is an empty string',
    payload: validEnvelope({
      deferralHistory: {
        'item-v041': [
          {
            itemId: 'item-v041',
            decidedOn: '2026-09-28',
            weekId: '2026-09-28',
            deferral: {
              reason: 'No specialist cover this week.',
              reviewDate: '',
              trigger: { kind: 'event', eventId: 'v041-dtc-recurs', label: 'DTC P0300 recurs' },
            },
          },
        ],
      },
    }),
  },
  {
    name: 'an odometer trigger with no thresholdKm',
    payload: validEnvelope({
      deferralHistory: {
        'item-v118': [
          {
            itemId: 'item-v118',
            decidedOn: '2026-09-28',
            weekId: '2026-09-28',
            deferral: {
              reason: 'Needs more distance before the brake pads are due.',
              reviewDate: '2026-10-05',
              trigger: { kind: 'odometer', vehicleId: 'V-118', label: 'x' },
            },
          },
        ],
      },
    }),
  },
  {
    name: 'a deferral record whose decidedOn is not a date',
    payload: validEnvelope({
      deferralHistory: {
        'item-v041': [
          {
            itemId: 'item-v041',
            decidedOn: 'not-a-date',
            weekId: '2026-09-28',
            deferral: {
              reason: 'No specialist cover this week.',
              reviewDate: '2026-10-05',
              trigger: { kind: 'event', eventId: 'v041-dtc-recurs', label: 'DTC P0300 recurs' },
            },
          },
        ],
      },
    }),
  },
  {
    name: 'demoDate is not a real date',
    payload: validEnvelope({ demoDate: 'garbage' }),
  },
  {
    name: 'a draft decision slotDate is calendar-invalid',
    payload: validEnvelope({
      draftByWeek: {
        '2026-09-28': {
          'item-v118': { itemId: 'item-v118', treatment: 'act-now', slotDate: '2026-02-30', deferral: null },
        },
      },
    }),
  },
  {
    name: 'a draft decision treatment is not one of the three literals',
    payload: validEnvelope({
      draftByWeek: {
        '2026-09-28': {
          'item-v118': { itemId: 'item-v118', treatment: 'explode', slotDate: null, deferral: null },
        },
      },
    }),
  },
  {
    name: 'draftBookingsByWeek is a string instead of a map',
    payload: validEnvelope({ draftBookingsByWeek: 'garbage' }),
  },
  {
    name: 'a draft booking has a non-integer day count',
    payload: validEnvelope({
      draftBookingsByWeek: {
        '2026-09-28': { 'V-027': { vehicleId: 'V-027', startDate: '2026-09-29', days: 1.5 } },
      },
    }),
  },
  {
    name: 'a draft booking has a calendar-invalid start date',
    payload: validEnvelope({
      draftBookingsByWeek: {
        '2026-09-28': { 'V-027': { vehicleId: 'V-027', startDate: '2026-02-30', days: 1 } },
      },
    }),
  },
  {
    name: 'a committed plan is missing bookings entirely',
    payload: validEnvelope({
      committedByWeek: {
        '2026-09-28': { weekId: '2026-09-28', committedOn: '2026-09-28', decisions: {} },
      },
    }),
  },
]

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

  it("falls back to the seed, with the older-build notice, on the previous build's version", () => {
    withStoredValue(validEnvelope({ version: 1 }), () => {
      const s = loadState(fixture)
      expectSeedEquivalent(s)
      expect(s.storageNotice).toContain('older build')
    })
  })

  it('falls back to the seed on a future version too', () => {
    withStoredValue(validEnvelope({ version: 3 }), () => {
      const s = loadState(fixture)
      expectSeedEquivalent(s)
      expect(s.storageNotice).not.toBeNull()
    })
  })

  it.each(CORRUPT_PAYLOADS)('falls back to the seed, and does not throw, when $name', ({ payload }) => {
    withStoredValue(payload, () => {
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

  it('round-trips a real committed booking through saveState', () => {
    withStoredValue(null, () => {
      const real = committedRealStateWithBooking()
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
