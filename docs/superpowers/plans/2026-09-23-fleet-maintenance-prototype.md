# Fleet Maintenance Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client-side weekly maintenance planning prototype where a depot fleet manager reviews seeded decisions, schedules or defers them, sees capacity recalculate per day and per vehicle class, and commits a simulated plan.

**Architecture:** A pure TypeScript domain core under `src/domain` that imports nothing from React or the browser, wrapped by a thin React shell. One governing rule: decisions are stored, everything else (capacity, blockers, visits, summary) is derived. The demo clock is passed as a parameter to every domain function, never read from the system clock.

**Tech Stack:** React 19, TypeScript, Vite, Vitest. No state library, no router, no backend, no network calls.

**Source spec:** `docs/superpowers/specs/2026-09-23-fleet-maintenance-prototype-design.md`, referenced below as **[S §n]**. The product contract behind it is `docs/fleet-maintenance-work-packages.md`, referenced as **[WP §n]**.

## Global Constraints

- **No `new Date()`, `Date.now()`, or `Date.today()` anywhere under `src/domain`.** Every function needing a date takes `demoDate: ISODate` as a parameter. [S §2.4]
- **`src/domain` imports nothing from React, the DOM, or `localStorage`.** `src/state` owns storage. `src/ui` holds no rules. [S §2.5]
- **Dates are `ISODate` strings (`'YYYY-MM-DD'`)**, compared with string `<` and `>`, which is valid because they are zero-padded and fixed-width. All `Date` objects are constructed as UTC (`new Date(iso + 'T00:00:00Z')`) and read with `getUTC*` methods, so no timezone can shift a day.
- **Currency is EUR, distance is km.** Never mix in USD or miles. [WP §4]
- **All prices are synthetic** and carry a visible `SYNTHETIC PRICES` label in the UI. [S §3.4]
- **UI language is English; German domain terms stay verbatim** (UVV, HU, Werkstatt, Fuhrparkverantwortliche). [S §1]
- **Replacement cover renders `not available`, never `€0`, when no compatible cover exists.** `€0` is reserved for "cover exists and costs nothing on these days". [S §3.4]
- **Operational disruption is a count of uncovered assignments, never a euro figure.** [S §3.4]
- **Vitest covers `src/domain` only.** No component tests. UI tasks verify manually against the dev server. [S §1, S §7.1]
- **No em dashes in any source file, comment, or UI string.** Use commas, colons, or separate sentences.
- **No hardcoded credentials, no network calls, no async I/O.** The application has none by design. [S §5.3]
- **Avoid `|` inside markdown table cells** in any docs this plan produces. The workspace editor mangles escaped pipes and silently corrupted an arithmetic table once already.

## File Structure

`src/domain/` (pure, tested):
- `types.ts` -- every shared type. No logic.
- `clock.ts` -- ISO date arithmetic, week derivation, odometer projection, event firing.
- `fixture.ts` -- the seeded world from [S §4]: 45 vehicles, 5 items, cover, garage bays, parts, two authored weeks.
- `capacity.ts` -- the availability formula from [S §3.1].
- `feasibility.ts` -- slot, duration and parts checks; returns every applicable reason.
- `urgency.ts` -- the three urgency states and queue ordering.
- `consequence.ts` -- the three separate figures.
- `recommendation.ts` -- the five-part contract, composing urgency and consequence.
- `deferral.ts` -- required fields, resurfacing by review date or trigger.
- `validation.ts` -- the commit gate, returning named blockers.
- `commit.ts` -- visits derived from decisions, draft to committed snapshot.

`src/state/` (browser-facing):
- `planReducer.ts` -- actions over the whole app state.
- `persistence.ts` -- localStorage load, save, reset, version guard.
- `PlanProvider.tsx` -- context and `useReducer`, saves on every change.

`src/ui/` (no rules):
- `theme.css` -- the design tokens taken from the chosen mockup.
- `DemoBar.tsx`, `PlanHeader.tsx`, `CapacityBand.tsx`, `DecisionQueue.tsx`, `ItemCard.tsx`
- `ItemDetail.tsx` and its blocks: `EvidenceBlock.tsx`, `AssumptionBlock.tsx`, `ConsequenceBlock.tsx`, `SlotPicker.tsx`, `TreatmentForm.tsx`
- `CommitSummary.tsx`, `DailyConfirmation.tsx`

`src/App.tsx`, `src/main.tsx`.

Tests live beside their module as `src/domain/<name>.test.ts`, plus `src/domain/scenarios.test.ts` for the ten [WP §9] checks.

**Reference mockup:** `docs/mockups/layout-b-capacity-band.mockup.html` is the visual target. Open it in a browser while building the UI tasks.

---

## Task 1: Scaffold, types and the seeded world

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx` (placeholder)
- Create: `src/domain/types.ts`
- Create: `src/domain/fixture.ts`
- Test: `src/domain/fixture.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: every type named in `types.ts` below, and `fixture: Fixture` plus `SEED_DATE: ISODate` from `fixture.ts`. Every later task imports from these two modules.

- [ ] **Step 1: Scaffold the project**

Run from the repository root (the directory already contains `docs/` and `.gitignore`):

```bash
npm create vite@latest . -- --template react-ts
npm install
npm install -D vitest
```

Answer "Ignore files and continue" if prompted about the non-empty directory.

- [ ] **Step 2: Wire Vitest into the Vite config**

Replace `vite.config.ts` with:

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

`base: './'` makes the built bundle work when opened from the filesystem, which [S §8] requires for the static handoff.

Add the test script to `package.json` under `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Write `src/domain/types.ts`**

```ts
export type ISODate = string // 'YYYY-MM-DD'
export type VehicleId = string
export type ItemId = string
export type WeekId = ISODate // the Monday of the week, used as the key
export type VehicleClass = 'standard' | 'specialist'
export type UrgencyKind = 'deadline' | 'estimate' | 'assessment-needed'
export type TreatmentKind = 'act-now' | 'bundle' | 'watch'

export interface Hold {
  reason: string
  since: ISODate
  releaseRecordedOn: ISODate | null
}

export interface Vehicle {
  id: VehicleId
  vehicleClass: VehicleClass
  modelYear: number
  odometerKm: number
  odometerReadOn: ISODate
  weeklyRateKm: number
  hold: Hold | null
}

export interface Evidence {
  observation: string
  source: string
  receivedOn: ISODate
  verbatim: string | null
}

export interface Urgency {
  kind: UrgencyKind
  because: string
  relevantDate: ISODate | null
}

export interface PartRequirement {
  name: string
  readyOn: ISODate
}

export interface Consequence {
  qualitative: string
  serviceCostEur: number | null
  coverCostEur: number | null
  coverUnavailable: boolean
  uncoveredAssignmentsNote: string
}

export type Trigger =
  | { kind: 'odometer'; vehicleId: VehicleId; thresholdKm: number; label: string }
  | { kind: 'event'; eventId: string; label: string }

export interface Deferral {
  reason: string
  reviewDate: ISODate
  trigger: Trigger
}

export interface Proposal {
  treatment: TreatmentKind
  slotDate: ISODate | null
  deferral: Deferral | null
}

export interface OpenItem {
  id: ItemId
  vehicleId: VehicleId
  title: string
  evidence: Evidence
  urgency: Urgency
  assumption: string | null
  safetyClass: boolean
  parts: PartRequirement | null
  visitDays: number
  canExtendToDays: number | null
  consequence: Consequence
  proposal: Proposal
  garageId: string
}

export interface DraftDecision {
  itemId: ItemId
  treatment: TreatmentKind | null
  slotDate: ISODate | null
  deferral: Deferral | null
}

export interface Visit {
  itemId: ItemId
  vehicleId: VehicleId
  garageId: string
  startDate: ISODate
  days: number
  scope: string
}

export interface Cover {
  id: string
  vehicleClass: VehicleClass
  confirmedDates: ISODate[]
  dayRateEur: number
}

export interface GarageDay {
  date: ISODate
  freeBays: number
}

export interface Garage {
  id: string
  name: string
  days: GarageDay[]
}

export interface Demand {
  standard: number
  specialist: number
}

export interface WeekFixture {
  weekId: WeekId
  days: ISODate[]
  demand: Demand
  coverIds: string[]
  itemIds: ItemId[]
}

export interface ScheduledEvent {
  eventId: string
  firesOn: ISODate
}

export interface Fixture {
  depot: string
  vehicles: Vehicle[]
  items: OpenItem[]
  covers: Cover[]
  garages: Garage[]
  weeks: WeekFixture[]
  defaultDemand: Demand
  defaultCoverIds: string[]
  events: ScheduledEvent[]
}

export interface DayCapacity {
  date: ISODate
  vehicleClass: VehicleClass
  owned: number
  unavailable: VehicleId[]
  cover: number
  available: number
  demand: number
  shortfall: number
}

export type Blocker =
  | {
      kind: 'capacity-shortfall'
      date: ISODate
      vehicleClass: VehicleClass
      shortBy: number
      contributors: VehicleId[]
    }
  | { kind: 'infeasible-slot'; itemId: ItemId; reasons: string[] }
  | { kind: 'parts-not-ready'; itemId: ItemId; partName: string; readyOn: ISODate }
  | { kind: 'undisposed-item'; itemId: ItemId }

export interface CommittedPlan {
  weekId: WeekId
  committedOn: ISODate
  decisions: Record<ItemId, DraftDecision>
}

export interface DeferralRecord {
  itemId: ItemId
  deferral: Deferral
  decidedOn: ISODate
  weekId: WeekId
}
```

`WeekId` is the Monday's ISO date rather than a `'2026-W40'` string. [S §5.1] leaves the format open, and keying by Monday removes every ISO-week edge case from the state layer. The week *number* is still shown in the header, computed by `isoWeekNumber` in Task 2.

- [ ] **Step 4: Write the failing fixture test**

Create `src/domain/fixture.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { fixture, SEED_DATE } from './fixture'

describe('fixture integrity', () => {
  it('has 45 vehicles split 38 standard and 7 specialist', () => {
    expect(fixture.vehicles).toHaveLength(45)
    expect(fixture.vehicles.filter((v) => v.vehicleClass === 'standard')).toHaveLength(38)
    expect(fixture.vehicles.filter((v) => v.vehicleClass === 'specialist')).toHaveLength(7)
  })

  it('has unique vehicle ids', () => {
    expect(new Set(fixture.vehicles.map((v) => v.id)).size).toBe(45)
  })

  it('puts the five named vehicles in the right classes', () => {
    const classOf = (id: string) => fixture.vehicles.find((v) => v.id === id)?.vehicleClass
    expect(classOf('V-012')).toBe('standard')
    expect(classOf('V-027')).toBe('standard')
    expect(classOf('V-103')).toBe('standard')
    expect(classOf('V-118')).toBe('standard')
    expect(classOf('V-041')).toBe('specialist')
  })

  it('holds V-012 out of service from the seed date', () => {
    const v012 = fixture.vehicles.find((v) => v.id === 'V-012')!
    expect(v012.hold).not.toBeNull()
    expect(v012.hold!.since).toBe('2026-09-25')
    expect(v012.hold!.releaseRecordedOn).toBe('2026-10-06')
  })

  it('holds no other vehicle', () => {
    expect(fixture.vehicles.filter((v) => v.hold !== null).map((v) => v.id)).toEqual(['V-012'])
  })

  it('has five open items, each referencing a real vehicle', () => {
    expect(fixture.items).toHaveLength(5)
    const ids = new Set(fixture.vehicles.map((v) => v.id))
    for (const item of fixture.items) expect(ids.has(item.vehicleId)).toBe(true)
  })

  it('leaves V-041 undisposed so the cold open carries one shortfall, not two', () => {
    const v041 = fixture.items.find((i) => i.id === 'item-v041')!
    expect(v041.proposal.slotDate).toBeNull()
  })

  it('marks only V-012 as safety class', () => {
    expect(fixture.items.filter((i) => i.safetyClass).map((i) => i.id)).toEqual(['item-v012'])
  })

  it('confirms R-1 all week and R-2 on Tuesday and Thursday only', () => {
    const r1 = fixture.covers.find((c) => c.id === 'R-1')!
    const r2 = fixture.covers.find((c) => c.id === 'R-2')!
    expect(r1.vehicleClass).toBe('standard')
    expect(r2.vehicleClass).toBe('standard')
    expect(r1.confirmedDates).toContain('2026-09-30')
    expect(r2.confirmedDates).toEqual(['2026-09-29', '2026-10-01'])
  })

  it('offers no specialist cover at all', () => {
    expect(fixture.covers.filter((c) => c.vehicleClass === 'specialist')).toHaveLength(0)
  })

  it('leaves Monday with no free bay and Tuesday with exactly three', () => {
    const berg = fixture.garages.find((g) => g.id === 'werkstatt-berg')!
    const bays = (d: string) => berg.days.find((x) => x.date === d)?.freeBays
    expect(bays('2026-09-28')).toBe(0)
    expect(bays('2026-09-29')).toBe(3)
    expect(bays('2026-09-30')).toBe(1)
    expect(bays('2026-10-01')).toBe(2)
    expect(bays('2026-10-02')).toBe(2)
  })

  it('demands exactly the fleet size every weekday, so there is no slack', () => {
    expect(fixture.defaultDemand).toEqual({ standard: 38, specialist: 7 })
  })

  it('authors two weeks, the second carrying no new items', () => {
    expect(fixture.weeks.map((w) => w.weekId)).toEqual(['2026-09-28', '2026-10-05'])
    expect(fixture.weeks[0].itemIds).toHaveLength(5)
    expect(fixture.weeks[1].itemIds).toHaveLength(0)
  })

  it('seeds the demo clock on the Monday of week 40', () => {
    expect(SEED_DATE).toBe('2026-09-28')
  })
})
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npm test -- fixture`
Expected: FAIL, `Failed to resolve import "./fixture"`.

- [ ] **Step 6: Write `src/domain/fixture.ts`**

```ts
import type {
  Cover,
  Fixture,
  Garage,
  ISODate,
  OpenItem,
  ScheduledEvent,
  Vehicle,
  VehicleId,
  WeekFixture,
} from './types'

export const SEED_DATE: ISODate = '2026-09-28'

const WEEK_40: ISODate[] = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']
const WEEK_41: ISODate[] = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']

const pad = (n: number) => String(n).padStart(3, '0')
const range = (from: number, to: number) => {
  const out: number[] = []
  for (let n = from; n <= to; n += 1) out.push(n)
  return out
}

// 38 standard: V-001..V-030 plus a second registration block that contains
// the two named vans V-103 and V-118. 7 specialist: V-039..V-045. [S 4.1]
const STANDARD_IDS: VehicleId[] = [
  ...range(1, 30).map((n) => `V-${pad(n)}`),
  'V-101',
  'V-103',
  'V-105',
  'V-107',
  'V-110',
  'V-112',
  'V-115',
  'V-118',
]
const SPECIALIST_IDS: VehicleId[] = range(39, 45).map((n) => `V-${pad(n)}`)

const DEPOT_DEFAULT_WEEKLY_KM = 480

// Odometer values the named vehicles need for their evidence and triggers.
// Every other van gets a plausible reading and the depot default rate. [S 4.1]
const NAMED_ODOMETER: Record<VehicleId, { km: number; readOn: ISODate; rate: number }> = {
  'V-012': { km: 58_140, readOn: '2026-09-25', rate: 610 },
  'V-027': { km: 31_260, readOn: '2026-09-18', rate: 210 },
  'V-041': { km: 72_980, readOn: '2026-09-18', rate: 520 },
  'V-103': { km: 61_400, readOn: '2026-09-22', rate: 700 },
  'V-118': { km: 47_820, readOn: '2026-09-18', rate: 560 },
}

function buildVehicle(id: VehicleId, vehicleClass: 'standard' | 'specialist', index: number): Vehicle {
  const named = NAMED_ODOMETER[id]
  return {
    id,
    vehicleClass,
    // Mixed age 3 to 7 years against a 2026 demo clock. [WP E0.2]
    modelYear: 2019 + (index % 5),
    odometerKm: named ? named.km : 40_000 + index * 820,
    odometerReadOn: named ? named.readOn : '2026-09-18',
    weeklyRateKm: named ? named.rate : DEPOT_DEFAULT_WEEKLY_KM,
    hold:
      id === 'V-012'
        ? {
            reason: 'Safety-relevant brake defect recorded at UVV inspection',
            since: '2026-09-25',
            releaseRecordedOn: '2026-10-06',
          }
        : null,
  }
}

const vehicles: Vehicle[] = [
  ...STANDARD_IDS.map((id, i) => buildVehicle(id, 'standard', i)),
  ...SPECIALIST_IDS.map((id, i) => buildVehicle(id, 'specialist', i + 30)),
]

const covers: Cover[] = [
  { id: 'R-1', vehicleClass: 'standard', confirmedDates: [...WEEK_40, ...WEEK_41], dayRateEur: 140 },
  { id: 'R-2', vehicleClass: 'standard', confirmedDates: ['2026-09-29', '2026-10-01'], dayRateEur: 140 },
]

const garages: Garage[] = [
  {
    id: 'werkstatt-berg',
    name: 'Werkstatt Berg',
    days: [
      { date: '2026-09-28', freeBays: 0 },
      { date: '2026-09-29', freeBays: 3 },
      { date: '2026-09-30', freeBays: 1 },
      { date: '2026-10-01', freeBays: 2 },
      { date: '2026-10-02', freeBays: 2 },
      ...WEEK_41.map((date) => ({ date, freeBays: 2 })),
    ],
  },
]

const items: OpenItem[] = [
  {
    id: 'item-v012',
    vehicleId: 'V-012',
    title: 'Brake defect found at UVV inspection',
    garageId: 'werkstatt-berg',
    evidence: {
      observation:
        'Front axle brake pads below wear limit. Finding recorded as verkehrsunsicher (not roadworthy).',
      source: 'UVV-Prufbericht',
      receivedOn: '2026-09-25',
      verbatim: null,
    },
    urgency: {
      kind: 'deadline',
      because: 'UVV requires immediate removal from service for a safety-relevant defect.',
      relevantDate: '2026-09-25',
    },
    assumption: null,
    safetyClass: true,
    parts: { name: 'Front brake pad set', readyOn: '2026-09-29' },
    visitDays: 1,
    canExtendToDays: null,
    consequence: {
      qualitative:
        'The van is already out of service and stays out until a release is recorded. Waiting does not reduce exposure, it extends the outage.',
      serviceCostEur: 480,
      coverCostEur: 700,
      coverUnavailable: false,
      uncoveredAssignmentsNote: 'None. R-1 covers this van for the whole week.',
    },
    proposal: { treatment: 'act-now', slotDate: '2026-09-29', deferral: null },
  },
  {
    id: 'item-v103',
    vehicleId: 'V-103',
    title: 'Front suspension wear, contradicting the odometer interval',
    garageId: 'werkstatt-berg',
    evidence: {
      observation:
        'Front lower control arm bushings worn. Odometer 61,400 km against an interval due at 70,000 km.',
      source: 'Workshop inspection',
      receivedOn: '2026-09-22',
      verbatim: null,
    },
    urgency: {
      kind: 'estimate',
      because: 'Inspection finding, dated 22 Sep, ahead of the odometer interval.',
      relevantDate: null,
    },
    assumption:
      'The urban duty cycle accelerates bushing wear, so the inspection finding overrides the odometer interval.',
    safetyClass: false,
    parts: { name: 'Control arm bushing set', readyOn: '2026-09-25' },
    visitDays: 1,
    canExtendToDays: 2,
    consequence: {
      qualitative:
        'Continued wear transfers load to the damper mounts. No regulatory deadline applies, and no failure date can be stated from one inspection.',
      serviceCostEur: 620,
      coverCostEur: 140,
      coverUnavailable: false,
      uncoveredAssignmentsNote: 'None on the proposed day.',
    },
    proposal: { treatment: 'act-now', slotDate: '2026-09-29', deferral: null },
  },
  {
    id: 'item-v118',
    vehicleId: 'V-118',
    title: 'Service interval approaching',
    garageId: 'werkstatt-berg',
    evidence: {
      observation: 'Odometer 47,820 km. Service interval at 50,000 km.',
      source: 'Telematics odometer feed',
      receivedOn: '2026-09-18',
      verbatim: null,
    },
    urgency: {
      kind: 'estimate',
      because: 'Odometer read 18 Sep, 2,180 km short of the 50,000 km interval.',
      relevantDate: '2026-10-15',
    },
    assumption:
      'Weekly mileage holds at the trailing 8-week average of 560 km, so the interval is reached around 15 Oct 2026. This is an estimate, not a predicted failure date.',
    safetyClass: false,
    parts: { name: 'Service kit', readyOn: '2026-09-24' },
    visitDays: 1,
    canExtendToDays: null,
    consequence: {
      qualitative:
        'Interval overrun is a warranty and contract exposure, not a safety one. No UVV deadline applies.',
      serviceCostEur: 340,
      coverCostEur: 140,
      coverUnavailable: false,
      uncoveredAssignmentsNote: 'Depends on the day chosen. Tuesday leaves one assignment uncovered.',
    },
    proposal: { treatment: 'act-now', slotDate: '2026-09-29', deferral: null },
  },
  {
    id: 'item-v041',
    vehicleId: 'V-041',
    title: 'Intermittent fault code, cleared twice',
    garageId: 'werkstatt-berg',
    evidence: {
      observation:
        'DTC P0300, random misfire, logged 8 Sep and 17 Sep and cleared both times. No drivability complaint from the driver.',
      source: 'Onboard diagnostics',
      receivedOn: '2026-09-17',
      verbatim: null,
    },
    urgency: {
      kind: 'assessment-needed',
      because: 'The code has recurred, but there is no measured trend and no deadline.',
      relevantDate: null,
    },
    assumption: null,
    safetyClass: false,
    parts: null,
    visitDays: 1,
    canExtendToDays: null,
    consequence: {
      qualitative:
        'A recurring misfire code can mean ignition, injection or a sensor fault. Nothing in the evidence establishes a safe waiting period, so the honest action is to assess rather than to predict.',
      serviceCostEur: 180,
      coverCostEur: null,
      coverUnavailable: true,
      uncoveredAssignmentsNote: 'One specialist assignment uncovered on any day this van is in.',
    },
    // Arrives undisposed on purpose: the specialist shortfall should appear
    // when the user schedules it, not at cold open. [S 4.4]
    proposal: { treatment: 'act-now', slotDate: null, deferral: null },
  },
  {
    id: 'item-v027',
    vehicleId: 'V-027',
    title: 'Wiper linkage noise reported by driver',
    garageId: 'werkstatt-berg',
    evidence: {
      observation:
        'UVV inspection clean on 11 Sep. Weekly mileage 210 km. Next scheduled service 2 Nov 2026.',
      source: 'Driver report',
      receivedOn: '2026-09-21',
      verbatim:
        'Scheibenwischer macht beim Einschalten ein knackendes Gerausch, wischt aber sauber.',
    },
    urgency: {
      kind: 'estimate',
      because: 'Clean inspection 11 Sep, low weekly mileage, scheduled service already booked 2 Nov.',
      relevantDate: '2026-11-02',
    },
    assumption:
      'Linkage noise without degraded wipe performance is not a safety defect, so the evidence supports waiting until the scheduled service.',
    safetyClass: false,
    parts: null,
    visitDays: 1,
    canExtendToDays: null,
    consequence: {
      qualitative:
        'Bundling this into the service already booked for 2 Nov avoids a separate visit. Nothing in the evidence suggests it degrades before then.',
      serviceCostEur: 95,
      coverCostEur: 0,
      coverUnavailable: false,
      uncoveredAssignmentsNote: 'None. No visit is scheduled this week.',
    },
    proposal: {
      treatment: 'watch',
      slotDate: null,
      deferral: {
        reason: 'Inspection clean on 11 Sep, 210 km per week, and a service is already booked for 2 Nov.',
        reviewDate: '2026-11-02',
        trigger: {
          kind: 'event',
          eventId: 'v027-wipe-degrades',
          label: 'Driver reports the wipe quality degrading',
        },
      },
    },
  },
]

// Only v041 is scheduled to fire. v027's trigger never fires in the fixture,
// which is what keeps its deferral defensible to the end. [S 4.4]
const events: ScheduledEvent[] = [{ eventId: 'v041-dtc-recurs', firesOn: '2026-10-07' }]

const weeks: WeekFixture[] = [
  {
    weekId: '2026-09-28',
    days: WEEK_40,
    demand: { standard: 38, specialist: 7 },
    coverIds: ['R-1', 'R-2'],
    itemIds: items.map((i) => i.id),
  },
  {
    weekId: '2026-10-05',
    days: WEEK_41,
    demand: { standard: 38, specialist: 7 },
    coverIds: ['R-1'],
    itemIds: [],
  },
]

export const fixture: Fixture = {
  depot: 'Depot Nord',
  vehicles,
  items,
  covers,
  garages,
  weeks,
  defaultDemand: { standard: 38, specialist: 7 },
  defaultCoverIds: ['R-1'],
  events,
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm test -- fixture`
Expected: PASS, 14 tests.

- [ ] **Step 8: Verify the scaffold builds and type-checks**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors, and a `dist/` directory is produced.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold the app and add the seeded world

Vite, React, TypeScript and Vitest, plus the domain types and the
fixture from section 4 of the design spec: 45 vehicles across two
classes, five open items, confirmed cover, garage bays and two
authored weeks.

Fixture integrity is asserted rather than assumed, including the
class of each named vehicle, the cover pattern and the bay counts
the seeded conflict depends on."
```

---

## Task 2: The clock

**Files:**
- Create: `src/domain/clock.ts`
- Test: `src/domain/clock.test.ts`

**Interfaces:**
- Consumes: `ISODate`, `VehicleId`, `Fixture`, `Vehicle` from `./types`; `fixture` from `./fixture`.
- Produces:
  - `parseISO(d: ISODate): Date`
  - `toISO(d: Date): ISODate`
  - `addDays(d: ISODate, n: number): ISODate`
  - `daysBetween(from: ISODate, to: ISODate): number`
  - `mondayOf(d: ISODate): WeekId`
  - `weekDays(monday: WeekId): ISODate[]` (five entries, Monday to Friday)
  - `isoWeekNumber(d: ISODate): number`
  - `formatDay(d: ISODate): string` (`'Tue 29 Sep'`)
  - `formatLongDay(d: ISODate): string` (`'Tuesday 29 September 2026'`)
  - `projectedOdometerKm(vehicle: Vehicle, on: ISODate): number`
  - `hasEventFired(fixture: Fixture, eventId: string, on: ISODate): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/domain/clock.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture'
import {
  addDays,
  daysBetween,
  formatDay,
  hasEventFired,
  isoWeekNumber,
  mondayOf,
  projectedOdometerKm,
  weekDays,
} from './clock'

describe('date arithmetic', () => {
  it('adds days across a month boundary', () => {
    expect(addDays('2026-09-29', 2)).toBe('2026-10-01')
    expect(addDays('2026-10-01', -3)).toBe('2026-09-28')
  })

  it('counts days between two dates', () => {
    expect(daysBetween('2026-09-28', '2026-10-01')).toBe(3)
    expect(daysBetween('2026-09-28', '2026-09-28')).toBe(0)
  })

  it('never shifts a day regardless of local timezone', () => {
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30') // European DST boundary
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
  })
})

describe('week derivation', () => {
  it('returns the Monday of a weekday', () => {
    expect(mondayOf('2026-09-28')).toBe('2026-09-28')
    expect(mondayOf('2026-10-02')).toBe('2026-09-28')
  })

  it('rolls a weekend forward to the next Monday', () => {
    expect(mondayOf('2026-09-26')).toBe('2026-09-28') // Saturday
    expect(mondayOf('2026-09-27')).toBe('2026-09-28') // Sunday
  })

  it('lists Monday to Friday', () => {
    expect(weekDays('2026-09-28')).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ])
  })

  it('computes the ISO week number for the header', () => {
    expect(isoWeekNumber('2026-09-28')).toBe(40)
    expect(isoWeekNumber('2026-10-05')).toBe(41)
    expect(isoWeekNumber('2026-11-02')).toBe(45)
  })

  it('formats a day compactly', () => {
    expect(formatDay('2026-09-29')).toBe('Tue 29 Sep')
  })
})

describe('odometer projection', () => {
  const v118 = fixture.vehicles.find((v) => v.id === 'V-118')!

  it('returns the raw reading on the day it was read', () => {
    expect(projectedOdometerKm(v118, '2026-09-18')).toBe(47_820)
  })

  it('projects forward at the vehicle weekly rate', () => {
    // 560 km per week is 80 km per day, over 7 days.
    expect(projectedOdometerKm(v118, '2026-09-25')).toBe(48_380)
  })

  it('crosses the 49,500 km trigger threshold on 9 Oct', () => {
    expect(projectedOdometerKm(v118, '2026-10-08')).toBeLessThan(49_500)
    expect(projectedOdometerKm(v118, '2026-10-09')).toBeGreaterThanOrEqual(49_500)
  })

  it('never projects backwards before the reading date', () => {
    expect(projectedOdometerKm(v118, '2026-09-01')).toBe(47_820)
  })
})

describe('scheduled events', () => {
  it('has not fired before its date', () => {
    expect(hasEventFired(fixture, 'v041-dtc-recurs', '2026-10-06')).toBe(false)
  })

  it('has fired on and after its date', () => {
    expect(hasEventFired(fixture, 'v041-dtc-recurs', '2026-10-07')).toBe(true)
    expect(hasEventFired(fixture, 'v041-dtc-recurs', '2026-11-30')).toBe(true)
  })

  it('never fires an event the fixture does not schedule', () => {
    expect(hasEventFired(fixture, 'v027-wipe-degrades', '2026-12-31')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- clock`
Expected: FAIL, `Failed to resolve import "./clock"`.

- [ ] **Step 3: Write `src/domain/clock.ts`**

```ts
import type { Fixture, ISODate, Vehicle, WeekId } from './types'

const MS_PER_DAY = 24 * 60 * 60 * 1000

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Every Date in this module is UTC, so no local timezone can shift a day. */
export function parseISO(d: ISODate): Date {
  const parsed = new Date(`${d}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid ISODate: ${d}`)
  return parsed
}

export function toISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10)
}

export function addDays(d: ISODate, n: number): ISODate {
  return toISO(new Date(parseISO(d).getTime() + n * MS_PER_DAY))
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / MS_PER_DAY)
}

/**
 * The Monday of the week containing `d`, or the next Monday if `d` is a
 * weekend. The plan week follows the demo clock. [S 3.7]
 */
export function mondayOf(d: ISODate): WeekId {
  const dow = parseISO(d).getUTCDay() // 0 = Sunday
  const delta = dow === 0 ? 1 : dow === 6 ? 2 : 1 - dow
  return addDays(d, delta)
}

export function weekDays(monday: WeekId): ISODate[] {
  return [0, 1, 2, 3, 4].map((n) => addDays(monday, n))
}

/** Display only. The state layer keys weeks by their Monday, not by number. */
export function isoWeekNumber(d: ISODate): number {
  const t = parseISO(d)
  const mondayIndex = (t.getUTCDay() + 6) % 7
  t.setUTCDate(t.getUTCDate() - mondayIndex + 3) // the Thursday of this week
  const jan4 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4))
  const jan4MondayIndex = (jan4.getUTCDay() + 6) % 7
  jan4.setUTCDate(jan4.getUTCDate() - jan4MondayIndex + 3)
  return 1 + Math.round((t.getTime() - jan4.getTime()) / (7 * MS_PER_DAY))
}

export function formatDay(d: ISODate): string {
  const t = parseISO(d)
  return `${DAYS_SHORT[t.getUTCDay()]} ${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}`
}

export function formatLongDay(d: ISODate): string {
  const t = parseISO(d)
  return `${DAYS_LONG[t.getUTCDay()]} ${t.getUTCDate()} ${MONTHS_LONG[t.getUTCMonth()]} ${t.getUTCFullYear()}`
}

/**
 * Odometer triggers project against this rather than against live data,
 * so advancing the clock is the only action needed to fire one. [S 3.6]
 */
export function projectedOdometerKm(vehicle: Vehicle, on: ISODate): number {
  const elapsed = daysBetween(vehicle.odometerReadOn, on)
  if (elapsed <= 0) return vehicle.odometerKm
  return Math.round(vehicle.odometerKm + (vehicle.weeklyRateKm / 7) * elapsed)
}

export function hasEventFired(fixture: Fixture, eventId: string, on: ISODate): boolean {
  const event = fixture.events.find((e) => e.eventId === eventId)
  if (!event) return false
  return on >= event.firesOn
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- clock`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/clock.ts src/domain/clock.test.ts
git commit -m "feat: add the demo clock and date arithmetic

All dates are handled as UTC ISO strings, so no local timezone can
shift a day, which the DST boundary tests pin down.

Odometer triggers project from the per-vehicle weekly rate and
scheduled events compare against the demo date, so advancing the
clock is the only action needed to fire either. No cheat button."
```

---

## Task 3: Capacity and derived visits

**Files:**
- Create: `src/domain/capacity.ts`
- Create: `src/domain/visits.ts`
- Test: `src/domain/capacity.test.ts`

**Interfaces:**
- Consumes: `addDays` from `./clock`; `fixture` from `./fixture`; types from `./types`.
- Produces:
  - `visits.ts`: `visitsFromDecisions(decisions: Record<ItemId, DraftDecision>, items: OpenItem[]): Visit[]`, `visitCoversDate(visit: Visit, date: ISODate): boolean`
  - `capacity.ts`: `unavailableOn(date: ISODate, vehicles: Vehicle[], visits: Visit[]): Set<VehicleId>`, `computeDayCapacity(args): DayCapacity`, `computeWeekCapacity(args): DayCapacity[]`, `weekFixtureFor(fixture: Fixture, weekId: WeekId): WeekFixture`

`visitsFromDecisions` lives in its own module rather than in `commit.ts` so that `capacity.ts` can import it without a cycle: `commit.ts` imports `validation.ts`, which imports `capacity.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/domain/capacity.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { computeDayCapacity, computeWeekCapacity, unavailableOn, weekFixtureFor } from './capacity'
import { fixture } from './fixture'
import { visitCoversDate, visitsFromDecisions } from './visits'
import type { DraftDecision, ItemId, Visit } from './types'

const WEEK_40 = '2026-09-28'

/** The proposals exactly as the fixture ships them. [S 4.5] */
function coldOpenDecisions(): Record<ItemId, DraftDecision> {
  const out: Record<ItemId, DraftDecision> = {}
  for (const item of fixture.items) {
    out[item.id] = {
      itemId: item.id,
      treatment: item.proposal.treatment,
      slotDate: item.proposal.slotDate,
      deferral: item.proposal.deferral,
    }
  }
  return out
}

function standardFor(visits: Visit[], date: string) {
  const week = weekFixtureFor(fixture, WEEK_40)
  return computeDayCapacity({ date, vehicleClass: 'standard', fixture, visits, week })
}

describe('derived visits', () => {
  it('produces one visit per scheduled item, and none for a watch', () => {
    const visits = visitsFromDecisions(coldOpenDecisions(), fixture.items)
    expect(visits.map((v) => v.itemId).sort()).toEqual(['item-v012', 'item-v103', 'item-v118'])
  })

  it('cannot duplicate a visit however many times it is derived', () => {
    const decisions = coldOpenDecisions()
    const once = visitsFromDecisions(decisions, fixture.items)
    const twice = visitsFromDecisions(decisions, fixture.items)
    expect(twice).toEqual(once)
    expect(new Set(twice.map((v) => v.itemId)).size).toBe(twice.length)
  })

  it('counts every day a multi-day visit covers', () => {
    const visit: Visit = {
      itemId: 'item-v103',
      vehicleId: 'V-103',
      garageId: 'werkstatt-berg',
      startDate: '2026-09-29',
      days: 2,
      scope: 'suspension',
    }
    expect(visitCoversDate(visit, '2026-09-28')).toBe(false)
    expect(visitCoversDate(visit, '2026-09-29')).toBe(true)
    expect(visitCoversDate(visit, '2026-09-30')).toBe(true)
    expect(visitCoversDate(visit, '2026-10-01')).toBe(false)
  })
})

describe('unavailability is a set, so nothing is subtracted twice', () => {
  it('counts a held vehicle with a booked visit exactly once', () => {
    const visits = visitsFromDecisions(coldOpenDecisions(), fixture.items)
    const unavailable = unavailableOn('2026-09-29', fixture.vehicles, visits)
    expect([...unavailable].sort()).toEqual(['V-012', 'V-103', 'V-118'])
  })

  it('keeps the held vehicle unavailable on a day it has no visit', () => {
    const unavailable = unavailableOn('2026-09-30', fixture.vehicles, [])
    expect([...unavailable]).toEqual(['V-012'])
  })

  it('keeps the held vehicle unavailable for the whole planning week', () => {
    for (const date of ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']) {
      expect(unavailableOn(date, fixture.vehicles, []).has('V-012')).toBe(true)
    }
  })

  it('releases it only on the date the fixture records, not before', () => {
    expect(unavailableOn('2026-10-05', fixture.vehicles, []).has('V-012')).toBe(true)
    expect(unavailableOn('2026-10-06', fixture.vehicles, []).has('V-012')).toBe(false)
  })
})

describe('cold open capacity matches the seeded scenario', () => {
  const visits = visitsFromDecisions(coldOpenDecisions(), fixture.items)

  it('leaves Tuesday one standard van short', () => {
    const tue = standardFor(visits, '2026-09-29')
    expect(tue.owned).toBe(38)
    expect(tue.unavailable.sort()).toEqual(['V-012', 'V-103', 'V-118'])
    expect(tue.cover).toBe(2)
    expect(tue.available).toBe(37)
    expect(tue.demand).toBe(38)
    expect(tue.shortfall).toBe(1)
  })

  it('meets demand on every other day, with one spare on Thursday', () => {
    expect(standardFor(visits, '2026-09-28').available).toBe(38)
    expect(standardFor(visits, '2026-09-30').available).toBe(38)
    expect(standardFor(visits, '2026-10-01').available).toBe(39)
    expect(standardFor(visits, '2026-10-02').available).toBe(38)
  })

  it('leaves the specialist class untouched, because V-041 is undisposed', () => {
    const week = weekFixtureFor(fixture, WEEK_40)
    for (const date of week.days) {
      const spec = computeDayCapacity({ date, vehicleClass: 'specialist', fixture, visits, week })
      expect(spec.available).toBe(7)
      expect(spec.shortfall).toBe(0)
    }
  })
})

describe('the levers behave as the scenario requires', () => {
  function withSlot(itemId: ItemId, slotDate: string | null, days?: number) {
    const decisions = coldOpenDecisions()
    decisions[itemId] = { ...decisions[itemId], slotDate }
    const items = days
      ? fixture.items.map((i) => (i.id === itemId ? { ...i, visitDays: days } : i))
      : fixture.items
    return visitsFromDecisions(decisions, items)
  }

  it('clears the shortfall when V-118 moves to Thursday', () => {
    const visits = withSlot('item-v118', '2026-10-01')
    expect(standardFor(visits, '2026-09-29').shortfall).toBe(0)
    expect(standardFor(visits, '2026-10-01').shortfall).toBe(0)
  })

  it('only relocates the shortfall when V-118 moves to Wednesday', () => {
    const visits = withSlot('item-v118', '2026-09-30')
    expect(standardFor(visits, '2026-09-29').shortfall).toBe(0)
    expect(standardFor(visits, '2026-09-30').shortfall).toBe(1)
  })

  it('breaks the specialist class when V-041 is scheduled, on any day', () => {
    const week = weekFixtureFor(fixture, WEEK_40)
    for (const date of week.days) {
      const visits = withSlot('item-v041', date)
      const spec = computeDayCapacity({ date, vehicleClass: 'specialist', fixture, visits, week })
      expect(spec.available).toBe(6)
      expect(spec.shortfall).toBe(1)
      expect(spec.cover).toBe(0)
    }
  })

  it('reproduces a Wednesday shortage when V-103 extends to a second day', () => {
    const visits = withSlot('item-v103', '2026-09-29', 2)
    // V-118 is still on Tuesday here, so Tuesday stays short as well.
    expect(standardFor(visits, '2026-09-30').shortfall).toBe(1)
    expect(standardFor(visits, '2026-09-30').unavailable.sort()).toEqual(['V-012', 'V-103'])
  })

  it('uses the week 41 template, where R-2 does not exist', () => {
    const week = weekFixtureFor(fixture, '2026-10-05')
    const mon = computeDayCapacity({
      date: '2026-10-05',
      vehicleClass: 'standard',
      fixture,
      visits: [],
      week,
    })
    expect(mon.cover).toBe(1)
    expect(mon.available).toBe(38)
  })

  it('falls back to the default template for weeks the fixture does not author', () => {
    const week = weekFixtureFor(fixture, '2026-11-02')
    expect(week.itemIds).toEqual([])
    expect(week.coverIds).toEqual(['R-1'])
    expect(week.days).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
    ])
  })
})

describe('computeWeekCapacity', () => {
  it('returns ten rows, five days by two classes', () => {
    const rows = computeWeekCapacity({ fixture, weekId: WEEK_40, visits: [] })
    expect(rows).toHaveLength(10)
    expect(new Set(rows.map((r) => r.date)).size).toBe(5)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- capacity`
Expected: FAIL, `Failed to resolve import "./capacity"`.

- [ ] **Step 3: Write `src/domain/visits.ts`**

```ts
import { addDays } from './clock'
import type { DraftDecision, ISODate, ItemId, OpenItem, Visit } from './types'

export function visitCoversDate(visit: Visit, date: ISODate): boolean {
  return date >= visit.startDate && date < addDays(visit.startDate, visit.days)
}

/**
 * Visits are derived from the decision set and keyed by item, never appended
 * to a list. Re-committing therefore cannot duplicate one. [S 2.2]
 */
export function visitsFromDecisions(
  decisions: Record<ItemId, DraftDecision>,
  items: OpenItem[],
): Visit[] {
  const byId = new Map(items.map((i) => [i.id, i]))
  return Object.values(decisions)
    .filter((d) => d.slotDate !== null && d.treatment !== 'watch')
    .flatMap((d) => {
      const item = byId.get(d.itemId)
      if (!item) return []
      return [
        {
          itemId: item.id,
          vehicleId: item.vehicleId,
          garageId: item.garageId,
          startDate: d.slotDate as ISODate,
          days: item.visitDays,
          scope: item.title,
        },
      ]
    })
    .sort((a, b) => a.itemId.localeCompare(b.itemId))
}
```

- [ ] **Step 4: Write `src/domain/capacity.ts`**

```ts
import { weekDays } from './clock'
import type {
  DayCapacity,
  Fixture,
  ISODate,
  Vehicle,
  VehicleClass,
  VehicleId,
  Visit,
  WeekFixture,
  WeekId,
} from './types'
import { visitCoversDate } from './visits'

/**
 * Weeks the fixture does not author fall back to the week 41 template:
 * normal demand, R-1 only, and no new items. [S 3.7]
 */
export function weekFixtureFor(fixture: Fixture, weekId: WeekId): WeekFixture {
  const authored = fixture.weeks.find((w) => w.weekId === weekId)
  if (authored) return authored
  return {
    weekId,
    days: weekDays(weekId),
    demand: fixture.defaultDemand,
    coverIds: fixture.defaultCoverIds,
    itemIds: [],
  }
}

/** A hold is never cleared, only stamped with a release, so "held" is always
 *  a question about a specific date. */
export function isHeldOn(vehicle: Vehicle, date: ISODate): boolean {
  const hold = vehicle.hold
  return hold !== null && (hold.releaseRecordedOn === null || date < hold.releaseRecordedOn)
}

/**
 * One Set, so a vehicle that is both held and booked counts once. [S 3.1]
 * A hold persists until the fixture records a release on or before the day.
 */
export function unavailableOn(
  date: ISODate,
  vehicles: Vehicle[],
  visits: Visit[],
): Set<VehicleId> {
  const out = new Set<VehicleId>()
  for (const vehicle of vehicles) {
    if (isHeldOn(vehicle, date)) {
      out.add(vehicle.id)
    }
  }
  for (const visit of visits) {
    if (visitCoversDate(visit, date)) out.add(visit.vehicleId)
  }
  return out
}

export function computeDayCapacity(args: {
  date: ISODate
  vehicleClass: VehicleClass
  fixture: Fixture
  visits: Visit[]
  week: WeekFixture
}): DayCapacity {
  const { date, vehicleClass, fixture, visits, week } = args
  const inClass = fixture.vehicles.filter((v) => v.vehicleClass === vehicleClass)
  const unavailableAll = unavailableOn(date, fixture.vehicles, visits)
  const unavailable = inClass.filter((v) => unavailableAll.has(v.id)).map((v) => v.id)

  // Cover carries its own class, so a standard rental can never close a
  // specialist gap. The data model does not allow it. [S 3.1]
  const cover = fixture.covers.filter(
    (c) =>
      week.coverIds.includes(c.id) &&
      c.vehicleClass === vehicleClass &&
      c.confirmedDates.includes(date),
  ).length

  const owned = inClass.length
  const available = owned - unavailable.length + cover
  const demand = vehicleClass === 'standard' ? week.demand.standard : week.demand.specialist

  return {
    date,
    vehicleClass,
    owned,
    unavailable,
    cover,
    available,
    demand,
    shortfall: Math.max(0, demand - available),
  }
}

export function computeWeekCapacity(args: {
  fixture: Fixture
  weekId: WeekId
  visits: Visit[]
}): DayCapacity[] {
  const { fixture, weekId, visits } = args
  const week = weekFixtureFor(fixture, weekId)
  const classes: VehicleClass[] = ['standard', 'specialist']
  return week.days.flatMap((date) =>
    classes.map((vehicleClass) =>
      computeDayCapacity({ date, vehicleClass, fixture, visits, week }),
    ),
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- capacity`
Expected: PASS, 14 tests.

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS, all tests from Tasks 1 to 3.

- [ ] **Step 7: Commit**

```bash
git add src/domain/capacity.ts src/domain/visits.ts src/domain/capacity.test.ts
git commit -m "feat: add class-aware capacity and derived visits

Availability is owned minus distinct unavailable vehicles plus
compatible confirmed cover, computed per day and per class. Holds and
visits land in one Set, so a held van with a booked visit is counted
once by construction rather than de-duplicated afterwards.

Visits are derived from decisions and keyed by item, which makes
duplicate visits structurally impossible.

Tests pin every figure in the seeded scenario: Tuesday short by one,
Thursday clearing it, Wednesday only relocating it, the specialist
gap that no standard cover can close, and the multi-day extension."
```

---

## Task 4: Feasibility, slots and parts

**Files:**
- Create: `src/domain/feasibility.ts`
- Test: `src/domain/feasibility.test.ts`

**Interfaces:**
- Consumes: `addDays`, `formatDay`, `weekDays` from `./clock`; `visitCoversDate`, `visitsFromDecisions` from `./visits`; `weekFixtureFor` from `./capacity`.
- Produces:
  - `interface SlotOption { date: ISODate; feasible: boolean; reasons: string[] }`
  - `slotBlockers(args: { item: OpenItem; date: ISODate; fixture: Fixture; visits: Visit[] }): Blocker[]`
  - `slotOptions(args: { item: OpenItem; fixture: Fixture; decisions: Record<ItemId, DraftDecision>; weekId: WeekId }): SlotOption[]`

Feasibility returns **every** applicable reason, not the first. Monday blocks `V-012` on both the garage bay and the parts-ready date, and showing one of the two would misrepresent the constraint. [S §3.8]

- [ ] **Step 1: Write the failing test**

Create `src/domain/feasibility.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { computeDayCapacity, weekFixtureFor } from './capacity'
import { slotBlockers, slotOptions } from './feasibility'
import { fixture } from './fixture'
import { visitsFromDecisions } from './visits'
import type { DraftDecision, ItemId } from './types'

const WEEK_40 = '2026-09-28'
const item = (id: string) => fixture.items.find((i) => i.id === id)!

function coldOpenDecisions(): Record<ItemId, DraftDecision> {
  const out: Record<ItemId, DraftDecision> = {}
  for (const i of fixture.items) {
    out[i.id] = { itemId: i.id, treatment: i.proposal.treatment, slotDate: i.proposal.slotDate, deferral: i.proposal.deferral }
  }
  return out
}

describe('slot blockers', () => {
  const visits = visitsFromDecisions(coldOpenDecisions(), fixture.items)

  it('accepts the proposed Tuesday slot for V-118', () => {
    expect(slotBlockers({ item: item('item-v118'), date: '2026-09-29', fixture, visits })).toEqual([])
  })

  it('rejects Monday for V-118 because the garage is fully booked', () => {
    const blockers = slotBlockers({ item: item('item-v118'), date: '2026-09-28', fixture, visits })
    expect(blockers).toHaveLength(1)
    expect(blockers[0].kind).toBe('infeasible-slot')
    expect((blockers[0] as { reasons: string[] }).reasons.join(' ')).toContain('fully booked')
  })

  it('reports BOTH reasons for V-012 on Monday, not just the first', () => {
    const blockers = slotBlockers({ item: item('item-v012'), date: '2026-09-28', fixture, visits })
    expect(blockers.map((b) => b.kind).sort()).toEqual(['infeasible-slot', 'parts-not-ready'])
    const parts = blockers.find((b) => b.kind === 'parts-not-ready') as {
      partName: string
      readyOn: string
    }
    expect(parts.partName).toBe('Front brake pad set')
    expect(parts.readyOn).toBe('2026-09-29')
  })

  it('accepts Tuesday for V-012, the day its parts are ready', () => {
    expect(slotBlockers({ item: item('item-v012'), date: '2026-09-29', fixture, visits })).toEqual([])
  })

  it('checks every day a multi-day visit would cover', () => {
    const extended = { ...item('item-v103'), visitDays: 2 }
    // Tuesday plus Wednesday: Wednesday has one free bay, which is enough.
    expect(slotBlockers({ item: extended, date: '2026-09-29', fixture, visits: [] })).toEqual([])
    // Starting Wednesday would spill into Thursday, and both have bays.
    expect(slotBlockers({ item: extended, date: '2026-09-30', fixture, visits: [] })).toEqual([])
  })

  it('never counts the item own existing visit against itself', () => {
    expect(slotBlockers({ item: item('item-v103'), date: '2026-09-29', fixture, visits })).toEqual([])
  })
})

describe('slot options offered to the user', () => {
  const decisions = coldOpenDecisions()

  it('offers every weekday, marking the infeasible ones with their reason', () => {
    const options = slotOptions({ item: item('item-v118'), fixture, decisions, weekId: WEEK_40 })
    expect(options.map((o) => o.date)).toEqual([
      '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02',
    ])
    const monday = options.find((o) => o.date === '2026-09-28')!
    expect(monday.feasible).toBe(false)
    expect(monday.reasons.length).toBeGreaterThan(0)
    expect(options.find((o) => o.date === '2026-10-01')!.feasible).toBe(true)
  })

  it('gives V-041 several feasible days, so its blocker is capacity and not the garage', () => {
    const options = slotOptions({ item: item('item-v041'), fixture, decisions, weekId: WEEK_40 })
    const feasible = options.filter((o) => o.feasible).map((o) => o.date)
    expect(feasible.length).toBeGreaterThanOrEqual(3)
    // Every feasible day still breaks the specialist class.
    const week = weekFixtureFor(fixture, WEEK_40)
    for (const date of feasible) {
      const withV041 = { ...decisions, 'item-v041': { ...decisions['item-v041'], slotDate: date } }
      const spec = computeDayCapacity({
        date,
        vehicleClass: 'specialist',
        fixture,
        visits: visitsFromDecisions(withV041, fixture.items),
        week,
      })
      expect(spec.shortfall).toBe(1)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- feasibility`
Expected: FAIL, `Failed to resolve import "./feasibility"`.

- [ ] **Step 3: Write `src/domain/feasibility.ts`**

```ts
import { weekFixtureFor } from './capacity'
import { addDays, formatDay } from './clock'
import type {
  Blocker,
  DraftDecision,
  Fixture,
  ISODate,
  ItemId,
  OpenItem,
  Visit,
  WeekId,
} from './types'
import { visitCoversDate, visitsFromDecisions } from './visits'

export interface SlotOption {
  date: ISODate
  feasible: boolean
  reasons: string[]
}

function coveredDates(start: ISODate, days: number): ISODate[] {
  return Array.from({ length: days }, (_, n) => addDays(start, n))
}

function freeBaysOn(fixture: Fixture, garageId: string, date: ISODate): number | null {
  const garage = fixture.garages.find((g) => g.id === garageId)
  const day = garage?.days.find((d) => d.date === date)
  return day ? day.freeBays : null
}

function baysUsedOn(visits: Visit[], garageId: string, date: ISODate, excludeItemId: ItemId): number {
  return visits.filter(
    (v) => v.garageId === garageId && v.itemId !== excludeItemId && visitCoversDate(v, date),
  ).length
}

/**
 * Returns EVERY applicable reason rather than the first. Monday blocks V-012
 * on both the bay and the parts date, and reporting one would mislead. [S 3.8]
 */
export function slotBlockers(args: {
  item: OpenItem
  date: ISODate
  fixture: Fixture
  visits: Visit[]
}): Blocker[] {
  const { item, date, fixture, visits } = args
  const out: Blocker[] = []
  const reasons: string[] = []

  for (const day of coveredDates(date, item.visitDays)) {
    const free = freeBaysOn(fixture, item.garageId, day)
    const garageName = fixture.garages.find((g) => g.id === item.garageId)?.name ?? item.garageId
    if (free === null) {
      reasons.push(`${garageName} has no opening hours on ${formatDay(day)}`)
      continue
    }
    if (free - baysUsedOn(visits, item.garageId, day, item.id) < 1) {
      reasons.push(`${garageName} is fully booked on ${formatDay(day)}`)
    }
  }
  if (reasons.length > 0) out.push({ kind: 'infeasible-slot', itemId: item.id, reasons })

  if (item.parts && date < item.parts.readyOn) {
    out.push({
      kind: 'parts-not-ready',
      itemId: item.id,
      partName: item.parts.name,
      readyOn: item.parts.readyOn,
    })
  }
  return out
}

export function slotOptions(args: {
  item: OpenItem
  fixture: Fixture
  decisions: Record<ItemId, DraftDecision>
  weekId: WeekId
}): SlotOption[] {
  const { item, fixture, decisions, weekId } = args
  const week = weekFixtureFor(fixture, weekId)
  const visits = visitsFromDecisions(decisions, fixture.items)

  return week.days.map((date) => {
    const blockers = slotBlockers({ item, date, fixture, visits })
    const reasons = blockers.flatMap((b) =>
      b.kind === 'infeasible-slot'
        ? b.reasons
        : b.kind === 'parts-not-ready'
          ? [`${b.partName} ready ${formatDay(b.readyOn)}`]
          : [],
    )
    return { date, feasible: reasons.length === 0, reasons }
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- feasibility`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/feasibility.ts src/domain/feasibility.test.ts
git commit -m "feat: check garage bays and parts before a slot can be chosen

A plan that lets the user commit an unbookable visit has broken its
own promise, so slots and lead times are checked from the start.

Feasibility returns every applicable reason rather than the first:
Monday blocks V-012 on both the bay and the parts-ready date, and
reporting only one would misrepresent the constraint."
```

---

## Task 5: Queue ordering, consequence and the recommendation contract

**Files:**
- Create: `src/domain/urgency.ts`
- Create: `src/domain/consequence.ts`
- Create: `src/domain/recommendation.ts`
- Test: `src/domain/recommendation.test.ts`

**Interfaces:**
- Consumes: `formatDay` from `./clock`; types from `./types`.
- Produces:
  - `urgency.ts`: `urgencyRank(kind: UrgencyKind): number`, `urgencyLabel(kind: UrgencyKind): string`, `orderQueue(args: { items: OpenItem[]; decisions: Record<ItemId, DraftDecision>; blockers: Blocker[] }): OpenItem[]`
  - `consequence.ts`: `interface ConsequenceView { qualitative: string; serviceCost: string; coverCost: string; disruption: string }`, `consequenceView(item: OpenItem): ConsequenceView`
  - `recommendation.ts`: `interface RecommendationView { urgency: Urgency; observation: string; source: string; receivedOn: ISODate; verbatim: string | null; relevantDate: ISODate | null; assumption: string | null; proposedAction: string; consequence: ConsequenceView }`, `recommendationFor(item: OpenItem): RecommendationView`, `watchAvailable(item: OpenItem, vehicle: Vehicle): boolean`

**Deviation from [S §6.4], applied deliberately.** The spec lists four ordering tiers and then claims a cold-open order of `V-012, V-118, V-041, V-103, V-027`. That order does not follow from those tiers: `V-103` and `V-118` are both contributors to the Tuesday shortfall, so nothing in the stated rule separates them or ranks `V-041` between them. This task implements a rule that is defensible on its own terms and produces `V-012, V-041, V-103, V-118, V-027`. The undisposed item ranks immediately after the hard stop, which is the better answer for G1: the queue surfaces the decision the product is actually asking for. **Update [S §6.4] to match when this task is done.**

- [ ] **Step 1: Write the failing test**

Create `src/domain/recommendation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { consequenceView } from './consequence'
import { fixture } from './fixture'
import { recommendationFor, watchAvailable } from './recommendation'
import { orderQueue, urgencyRank } from './urgency'
import type { Blocker, DraftDecision, ItemId } from './types'

const item = (id: string) => fixture.items.find((i) => i.id === id)!
const vehicle = (id: string) => fixture.vehicles.find((v) => v.id === id)!

function coldOpenDecisions(): Record<ItemId, DraftDecision> {
  const out: Record<ItemId, DraftDecision> = {}
  for (const i of fixture.items) {
    out[i.id] = { itemId: i.id, treatment: i.proposal.treatment, slotDate: i.proposal.slotDate, deferral: i.proposal.deferral }
  }
  return out
}

describe('urgency is three states, never a score', () => {
  it('ranks deadline above estimate above assessment-needed', () => {
    expect(urgencyRank('deadline')).toBeLessThan(urgencyRank('estimate'))
    expect(urgencyRank('estimate')).toBeLessThan(urgencyRank('assessment-needed'))
  })

  it('gives every item a because that names its evidence', () => {
    for (const i of fixture.items) {
      expect(i.urgency.because.length).toBeGreaterThan(10)
    }
  })

  it('gives a relevant date only where the fixture grounds one', () => {
    expect(item('item-v118').urgency.relevantDate).toBe('2026-10-15')
    expect(item('item-v041').urgency.relevantDate).toBeNull()
    expect(item('item-v103').urgency.relevantDate).toBeNull()
  })
})

describe('queue ordering', () => {
  const blockers: Blocker[] = [
    {
      kind: 'capacity-shortfall',
      date: '2026-09-29',
      vehicleClass: 'standard',
      shortBy: 1,
      contributors: ['V-012', 'V-103', 'V-118'],
    },
    { kind: 'undisposed-item', itemId: 'item-v041' },
  ]

  it('puts safety first, then the undisposed decision, then the contributors', () => {
    const ordered = orderQueue({ items: fixture.items, decisions: coldOpenDecisions(), blockers })
    expect(ordered.map((i) => i.id)).toEqual([
      'item-v012',
      'item-v041',
      'item-v103',
      'item-v118',
      'item-v027',
    ])
  })

  it('is stable when nothing blocks', () => {
    const ordered = orderQueue({ items: fixture.items, decisions: coldOpenDecisions(), blockers: [] })
    expect(ordered[0].id).toBe('item-v012')
    expect(ordered).toHaveLength(5)
  })
})

describe('consequence keeps three figures apart', () => {
  it('shows a euro figure for cover where confirmed cover exists', () => {
    expect(consequenceView(item('item-v012')).coverCost).toBe('EUR 700')
  })

  it('shows not available, never zero, where no compatible cover exists', () => {
    const view = consequenceView(item('item-v041'))
    expect(view.coverCost).toBe('not available')
    expect(view.coverCost).not.toContain('0')
  })

  it('shows a genuine zero where cover exists and costs nothing', () => {
    expect(consequenceView(item('item-v027')).coverCost).toBe('EUR 0')
  })

  it('never renders operational disruption as money', () => {
    for (const i of fixture.items) {
      expect(consequenceView(i).disruption).not.toMatch(/EUR/)
    }
  })
})

describe('the recommendation contract', () => {
  it('carries all five parts for a grounded item', () => {
    const r = recommendationFor(item('item-v118'))
    expect(r.observation).toContain('47,820 km')
    expect(r.source).toBe('Telematics odometer feed')
    expect(r.receivedOn).toBe('2026-09-18')
    expect(r.relevantDate).toBe('2026-10-15')
    expect(r.assumption).toContain('560 km')
    expect(r.proposedAction).toContain('Tue 29 Sep')
    expect(r.consequence.serviceCost).toBe('EUR 340')
  })

  it('proposes an assessment rather than a waiting period where evidence is thin', () => {
    const r = recommendationFor(item('item-v041'))
    expect(r.urgency.kind).toBe('assessment-needed')
    expect(r.relevantDate).toBeNull()
    expect(r.assumption).toBeNull()
    expect(r.proposedAction.toLowerCase()).toContain('assess')
  })

  it('keeps the driver wording verbatim and untranslated', () => {
    expect(recommendationFor(item('item-v027')).verbatim).toContain('Scheibenwischer')
  })

  it('describes a watch by its review date', () => {
    expect(recommendationFor(item('item-v027')).proposedAction).toContain('2 Nov')
  })
})

describe('the safety hard stop', () => {
  it('withholds watch from the held safety-class vehicle', () => {
    expect(watchAvailable(item('item-v012'), vehicle('V-012'))).toBe(false)
  })

  it('offers watch on every other item', () => {
    expect(watchAvailable(item('item-v041'), vehicle('V-041'))).toBe(true)
    expect(watchAvailable(item('item-v027'), vehicle('V-027'))).toBe(true)
    expect(watchAvailable(item('item-v103'), vehicle('V-103'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- recommendation`
Expected: FAIL, `Failed to resolve import "./consequence"`.

- [ ] **Step 3: Write `src/domain/urgency.ts`**

```ts
import type { Blocker, DraftDecision, ItemId, OpenItem, UrgencyKind } from './types'

export function urgencyRank(kind: UrgencyKind): number {
  return kind === 'deadline' ? 0 : kind === 'estimate' ? 1 : 2
}

export function urgencyLabel(kind: UrgencyKind): string {
  return kind === 'deadline' ? 'Deadline' : kind === 'estimate' ? 'Estimate' : 'Assessment needed'
}

/**
 * G1 turns on what the queue puts first, so the order is fixed rather than
 * left to urgency alone:
 *   0 safety class
 *   1 undisposed, a required decision is missing
 *   2 contributing to a capacity shortfall
 *   3 everything else
 * Ties break on urgency rank, then on item id, so the order is deterministic.
 */
function tierOf(item: OpenItem, blockers: Blocker[]): number {
  if (item.safetyClass) return 0
  if (blockers.some((b) => b.kind === 'undisposed-item' && b.itemId === item.id)) return 1
  const contributes = blockers.some(
    (b) => b.kind === 'capacity-shortfall' && b.contributors.includes(item.vehicleId),
  )
  if (contributes) return 2
  return 3
}

export function orderQueue(args: {
  items: OpenItem[]
  decisions: Record<ItemId, DraftDecision>
  blockers: Blocker[]
}): OpenItem[] {
  const { items, blockers } = args
  return [...items].sort((a, b) => {
    const tier = tierOf(a, blockers) - tierOf(b, blockers)
    if (tier !== 0) return tier
    const urgency = urgencyRank(a.urgency.kind) - urgencyRank(b.urgency.kind)
    if (urgency !== 0) return urgency
    return a.id.localeCompare(b.id)
  })
}
```

- [ ] **Step 4: Write `src/domain/consequence.ts`**

```ts
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
```

- [ ] **Step 5: Write `src/domain/recommendation.ts`**

```ts
import { formatDay } from './clock'
import { consequenceView, type ConsequenceView } from './consequence'
import type { ISODate, OpenItem, Urgency, Vehicle } from './types'

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
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- recommendation`
Expected: PASS, 14 tests.

- [ ] **Step 7: Update the spec to match the implemented ordering**

Edit `docs/superpowers/specs/2026-09-23-fleet-maintenance-prototype-design.md`, section 6.4. Replace the four tiers and the claimed order with:

```markdown
1. Safety class
2. Undisposed, a required decision is missing
3. Contributing to a capacity shortfall
4. Everything else

Ties break on urgency rank (`deadline`, `estimate`, `assessment-needed`), then on item ID, so the
order is deterministic.

At cold open this yields `V-012`, `V-041`, `V-103`, `V-118`, `V-027`. `V-041` ranks second despite
`assessment-needed` urgency because it is the one decision the product is actively asking for, which
is the behaviour G1 wants: the queue surfaces what stops the week, not just what is urgent.
```

- [ ] **Step 8: Commit**

```bash
git add src/domain/urgency.ts src/domain/consequence.ts src/domain/recommendation.ts src/domain/recommendation.test.ts docs/superpowers/specs/2026-09-23-fleet-maintenance-prototype-design.md
git commit -m "feat: add queue ordering and the recommendation contract

Every item renders the same five parts: observation and source, the
relevant date where one is grounded, the assumption in play, the
proposed action, and the consequence of waiting.

The three consequence figures stay apart. Cover reads 'not available'
rather than zero where none is compatible, since zero would read as
free rather than impossible. Disruption stays a count.

Queue order is fixed in four tiers rather than left to urgency, and
the spec is corrected: its stated tiers did not produce the order it
claimed, because V-103 and V-118 both contribute to the same
shortfall and nothing separated them."
```

---

## Task 6: The deferral ledger

**Files:**
- Create: `src/domain/deferral.ts`
- Test: `src/domain/deferral.test.ts`

**Interfaces:**
- Consumes: `hasEventFired`, `projectedOdometerKm` from `./clock`; types from `./types`.
- Produces:
  - `deferralErrors(d: Partial<Deferral> | null): string[]`
  - `isDeferralComplete(d: Partial<Deferral> | null): boolean`
  - `triggerFired(trigger: Trigger, fixture: Fixture, demoDate: ISODate): boolean`
  - `resurfacing(record: DeferralRecord, fixture: Fixture, demoDate: ISODate): { resurfaced: boolean; because: string | null }`
  - `resurfacedItems(args: { fixture: Fixture; history: Record<ItemId, DeferralRecord[]>; demoDate: ISODate }): Array<{ item: OpenItem; record: DeferralRecord; because: string }>`

- [ ] **Step 1: Write the failing test**

Create `src/domain/deferral.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { deferralErrors, isDeferralComplete, resurfacedItems, resurfacing, triggerFired } from './deferral'
import { fixture } from './fixture'
import type { DeferralRecord, ItemId, Trigger } from './types'

const v041Record: DeferralRecord = {
  itemId: 'item-v041',
  weekId: '2026-09-28',
  decidedOn: '2026-09-28',
  deferral: {
    reason: 'No specialist cover exists this week and the code has not recurred since 17 Sep.',
    reviewDate: '2026-10-05',
    trigger: { kind: 'event', eventId: 'v041-dtc-recurs', label: 'DTC P0300 recurs' },
  },
}

describe('all three fields are required', () => {
  it('rejects an empty deferral', () => {
    expect(deferralErrors(null)).toContain('Rationale is required')
    expect(deferralErrors(null).length).toBe(3)
  })

  it('rejects whitespace-only rationale', () => {
    const errors = deferralErrors({ reason: '   ', reviewDate: '2026-10-05', trigger: v041Record.deferral.trigger })
    expect(errors).toEqual(['Rationale is required'])
  })

  it('names each missing field separately', () => {
    expect(deferralErrors({ reason: 'ok' })).toEqual(['Review date is required', 'Trigger is required'])
  })

  it('accepts a complete deferral', () => {
    expect(deferralErrors(v041Record.deferral)).toEqual([])
    expect(isDeferralComplete(v041Record.deferral)).toBe(true)
  })
})

describe('triggers fire by advancing the clock, with no cheat button', () => {
  const odometer: Trigger = {
    kind: 'odometer',
    vehicleId: 'V-118',
    thresholdKm: 49_500,
    label: 'Odometer passes 49,500 km',
  }

  it('fires an odometer trigger when the projection crosses the threshold', () => {
    expect(triggerFired(odometer, fixture, '2026-10-08')).toBe(false)
    expect(triggerFired(odometer, fixture, '2026-10-09')).toBe(true)
  })

  it('fires an event trigger on the date the fixture schedules', () => {
    const t = v041Record.deferral.trigger
    expect(triggerFired(t, fixture, '2026-10-06')).toBe(false)
    expect(triggerFired(t, fixture, '2026-10-07')).toBe(true)
  })

  it('never fires the V-027 trigger, because the fixture never schedules it', () => {
    const t: Trigger = { kind: 'event', eventId: 'v027-wipe-degrades', label: 'Wipe quality degrades' }
    expect(triggerFired(t, fixture, '2027-12-31')).toBe(false)
  })
})

describe('resurfacing', () => {
  it('stays down before the review date', () => {
    expect(resurfacing(v041Record, fixture, '2026-10-02').resurfaced).toBe(false)
  })

  it('comes back when the review date arrives, and says why', () => {
    const r = resurfacing(v041Record, fixture, '2026-10-05')
    expect(r.resurfaced).toBe(true)
    expect(r.because).toContain('Review date')
  })

  it('comes back early if the trigger fires first', () => {
    const early: DeferralRecord = {
      ...v041Record,
      deferral: { ...v041Record.deferral, reviewDate: '2026-11-30' },
    }
    const r = resurfacing(early, fixture, '2026-10-07')
    expect(r.resurfaced).toBe(true)
    expect(r.because).toContain('Trigger fired')
  })

  it('returns the item with its prior decision intact', () => {
    const history: Record<ItemId, DeferralRecord[]> = { 'item-v041': [v041Record] }
    const out = resurfacedItems({ fixture, history, demoDate: '2026-10-05' })
    expect(out).toHaveLength(1)
    expect(out[0].item.id).toBe('item-v041')
    expect(out[0].record.deferral.reason).toContain('No specialist cover')
    expect(out[0].record.decidedOn).toBe('2026-09-28')
  })

  it('uses the most recent record when an item has been deferred more than once', () => {
    const older: DeferralRecord = { ...v041Record, decidedOn: '2026-09-21', deferral: { ...v041Record.deferral, reason: 'older' } }
    const history: Record<ItemId, DeferralRecord[]> = { 'item-v041': [older, v041Record] }
    const out = resurfacedItems({ fixture, history, demoDate: '2026-10-05' })
    expect(out[0].record.deferral.reason).toContain('No specialist cover')
  })

  it('keeps V-027 down, since neither its date nor its trigger has arrived', () => {
    const history: Record<ItemId, DeferralRecord[]> = {
      'item-v027': [
        {
          itemId: 'item-v027',
          weekId: '2026-09-28',
          decidedOn: '2026-09-28',
          deferral: fixture.items.find((i) => i.id === 'item-v027')!.proposal.deferral!,
        },
      ],
    }
    expect(resurfacedItems({ fixture, history, demoDate: '2026-10-19' })).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- deferral`
Expected: FAIL, `Failed to resolve import "./deferral"`.

- [ ] **Step 3: Write `src/domain/deferral.ts`**

```ts
import { formatDay, hasEventFired, projectedOdometerKm } from './clock'
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- deferral`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/deferral.ts src/domain/deferral.test.ts
git commit -m "feat: make deferral a first-class record, not a gut call

Reason, review date and trigger are all required. Deferring without a
record would make the product promise false, since the promise is
that nothing is deferred without a reason and a follow-up.

Items come back carrying the record that deferred them, so a
resurfaced item is never re-evaluated from zero. Both trigger kinds
fire by advancing the clock, so there is no cheat button."
```

---

## Task 7: The commit gate

**Files:**
- Create: `src/domain/validation.ts`
- Test: `src/domain/validation.test.ts`

**Interfaces:**
- Consumes: `computeWeekCapacity`, `weekFixtureFor` from `./capacity`; `slotBlockers` from `./feasibility`; `isDeferralComplete` from `./deferral`; `visitsFromDecisions` from `./visits`; `formatDay` from `./clock`.
- Produces:
  - `validatePlan(args: { fixture: Fixture; weekId: WeekId; decisions: Record<ItemId, DraftDecision> }): Blocker[]`
  - `canCommit(blockers: Blocker[]): boolean`
  - `describeBlocker(b: Blocker, fixture: Fixture): string`
  - `blockersForItem(blockers: Blocker[], item: OpenItem): Blocker[]`

- [ ] **Step 1: Write the failing test**

Create `src/domain/validation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture'
import { canCommit, describeBlocker, validatePlan } from './validation'
import type { DraftDecision, ItemId } from './types'

const WEEK_40 = '2026-09-28'

function coldOpen(): Record<ItemId, DraftDecision> {
  const out: Record<ItemId, DraftDecision> = {}
  for (const i of fixture.items) {
    out[i.id] = { itemId: i.id, treatment: i.proposal.treatment, slotDate: i.proposal.slotDate, deferral: i.proposal.deferral }
  }
  return out
}

const validate = (decisions: Record<ItemId, DraftDecision>) =>
  validatePlan({ fixture, weekId: WEEK_40, decisions })

describe('cold open carries exactly two blockers', () => {
  const blockers = validate(coldOpen())

  it('reports the Tuesday shortfall and the undisposed decision, and nothing else', () => {
    expect(blockers.map((b) => b.kind).sort()).toEqual(['capacity-shortfall', 'undisposed-item'])
  })

  it('names the day, the class and the contributors on the shortfall', () => {
    const shortfall = blockers.find((b) => b.kind === 'capacity-shortfall') as {
      date: string
      vehicleClass: string
      shortBy: number
      contributors: string[]
    }
    expect(shortfall.date).toBe('2026-09-29')
    expect(shortfall.vehicleClass).toBe('standard')
    expect(shortfall.shortBy).toBe(1)
    expect(shortfall.contributors.sort()).toEqual(['V-012', 'V-103', 'V-118'])
  })

  it('does not let the plan commit', () => {
    expect(canCommit(blockers)).toBe(false)
  })

  it('never treats the held vehicle as a blocker on its own', () => {
    expect(blockers.some((b) => b.kind === 'undisposed-item' && b.itemId === 'item-v012')).toBe(false)
  })
})

describe('the journey to a committable plan', () => {
  function resolved(): Record<ItemId, DraftDecision> {
    const d = coldOpen()
    d['item-v118'] = { ...d['item-v118'], slotDate: '2026-10-01' }
    d['item-v041'] = {
      itemId: 'item-v041',
      treatment: 'watch',
      slotDate: null,
      deferral: {
        reason: 'No specialist cover exists this week.',
        reviewDate: '2026-10-05',
        trigger: { kind: 'event', eventId: 'v041-dtc-recurs', label: 'DTC P0300 recurs' },
      },
    }
    return d
  }

  it('clears the shortfall when V-118 moves to Thursday but keeps the undisposed blocker', () => {
    const d = coldOpen()
    d['item-v118'] = { ...d['item-v118'], slotDate: '2026-10-01' }
    expect(validate(d).map((b) => b.kind)).toEqual(['undisposed-item'])
  })

  it('commits once both are resolved', () => {
    const blockers = validate(resolved())
    expect(blockers).toEqual([])
    expect(canCommit(blockers)).toBe(true)
  })

  it('blocks again if V-041 is scheduled instead of deferred, with no lever to close it', () => {
    const d = resolved()
    d['item-v041'] = { itemId: 'item-v041', treatment: 'act-now', slotDate: '2026-10-01', deferral: null }
    const blockers = validate(d)
    const spec = blockers.find(
      (b) => b.kind === 'capacity-shortfall' && b.vehicleClass === 'specialist',
    )
    expect(spec).toBeDefined()
    expect(canCommit(blockers)).toBe(false)
  })

  it('treats a watch with an incomplete deferral as undisposed', () => {
    const d = resolved()
    d['item-v041'] = { itemId: 'item-v041', treatment: 'watch', slotDate: null, deferral: null }
    expect(validate(d).some((b) => b.kind === 'undisposed-item' && b.itemId === 'item-v041')).toBe(true)
  })

  it('reports an infeasible slot rather than accepting it', () => {
    const d = resolved()
    d['item-v118'] = { ...d['item-v118'], slotDate: '2026-09-28' }
    const blockers = validate(d)
    expect(blockers.some((b) => b.kind === 'infeasible-slot' && b.itemId === 'item-v118')).toBe(true)
    expect(canCommit(blockers)).toBe(false)
  })

  it('reports parts not ready with the date', () => {
    const d = resolved()
    d['item-v012'] = { ...d['item-v012'], slotDate: '2026-09-28' }
    const parts = validate(d).find((b) => b.kind === 'parts-not-ready') as { readyOn: string }
    expect(parts.readyOn).toBe('2026-09-29')
  })
})

describe('blockers are named in plain language', () => {
  it('describes a shortfall by day and class', () => {
    const text = describeBlocker(validate(coldOpen())[0], fixture)
    expect(text.length).toBeGreaterThan(10)
  })

  it('describes every blocker kind without throwing', () => {
    for (const b of validate(coldOpen())) expect(typeof describeBlocker(b, fixture)).toBe('string')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- validation`
Expected: FAIL, `Failed to resolve import "./validation"`.

- [ ] **Step 3: Write `src/domain/validation.ts`**

```ts
import { computeWeekCapacity } from './capacity'
import { formatDay } from './clock'
import { isDeferralComplete } from './deferral'
import { slotBlockers } from './feasibility'
import type { Blocker, DraftDecision, Fixture, ItemId, OpenItem, WeekId } from './types'
import { visitsFromDecisions } from './visits'

/**
 * A blocked plan is a legitimate outcome, not an error state. The draft
 * survives, the blocker is named, and no success state is reachable. [WP E2.5]
 */
export function validatePlan(args: {
  fixture: Fixture
  weekId: WeekId
  decisions: Record<ItemId, DraftDecision>
}): Blocker[] {
  const { fixture, weekId, decisions } = args
  // Every item the caller has a decision slot for, which is the week's queue.
  // Filtering on week.itemIds would skip resurfaced items entirely, since weeks
  // after the first author none of their own.
  const items = fixture.items.filter((i) => decisions[i.id] !== undefined)
  const visits = visitsFromDecisions(decisions, fixture.items)
  const out: Blocker[] = []

  for (const item of items) {
    const decision = decisions[item.id]
    if (!decision || decision.treatment === null) {
      out.push({ kind: 'undisposed-item', itemId: item.id })
      continue
    }
    if (decision.treatment === 'watch') {
      if (!isDeferralComplete(decision.deferral)) {
        out.push({ kind: 'undisposed-item', itemId: item.id })
      }
      continue
    }
    if (decision.slotDate === null) {
      out.push({ kind: 'undisposed-item', itemId: item.id })
      continue
    }
    out.push(...slotBlockers({ item, date: decision.slotDate, fixture, visits }))
  }

  for (const day of computeWeekCapacity({ fixture, weekId, visits })) {
    if (day.shortfall > 0) {
      out.push({
        kind: 'capacity-shortfall',
        date: day.date,
        vehicleClass: day.vehicleClass,
        shortBy: day.shortfall,
        contributors: day.unavailable,
      })
    }
  }
  return out
}

/**
 * A held vehicle is not a blocker on its own: it may stay held provided cover
 * exists and a next step is recorded. Nothing above adds one. [S 3.5]
 */
export function canCommit(blockers: Blocker[]): boolean {
  return blockers.length === 0
}

export function blockersForItem(blockers: Blocker[], item: OpenItem): Blocker[] {
  return blockers.filter((b) => {
    if (b.kind === 'capacity-shortfall') return b.contributors.includes(item.vehicleId)
    return b.itemId === item.id
  })
}

export function describeBlocker(b: Blocker, fixture: Fixture): string {
  switch (b.kind) {
    case 'capacity-shortfall':
      return `${formatDay(b.date)}: ${b.vehicleClass} short by ${b.shortBy}. Off the road: ${b.contributors.join(', ')}.`
    case 'infeasible-slot':
      return `${titleOf(fixture, b.itemId)}: ${b.reasons.join('. ')}.`
    case 'parts-not-ready':
      return `${titleOf(fixture, b.itemId)}: ${b.partName} is not ready until ${formatDay(b.readyOn)}.`
    case 'undisposed-item':
      return `${titleOf(fixture, b.itemId)}: no decision recorded yet.`
  }
}

function titleOf(fixture: Fixture, itemId: ItemId): string {
  const item = fixture.items.find((i) => i.id === itemId)
  return item ? `${item.vehicleId} ${item.title.toLowerCase()}` : itemId
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- validation`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/validation.ts src/domain/validation.test.ts
git commit -m "feat: gate commit on named blockers rather than a boolean

Four blocker kinds: capacity shortfall by day and class with its
contributors named, infeasible slot, parts not ready, and undisposed
decision. Commit is permitted only when the list is empty.

A held vehicle is deliberately not a blocker on its own. It may stay
held provided cover exists and a next step is recorded, which is what
lets the rest of the week commit around V-012."
```

---

## Task 8: Commit, summary and daily confirmation

**Files:**
- Create: `src/domain/commit.ts`
- Test: `src/domain/commit.test.ts`

**Interfaces:**
- Consumes: `computeWeekCapacity`, `weekFixtureFor` from `./capacity`; `formatDay`, `formatLongDay`, `addDays` from `./clock`; `visitsFromDecisions` from `./visits`.
- Produces:
  - `commitPlan(args: { weekId: WeekId; decisions: Record<ItemId, DraftDecision>; demoDate: ISODate }): CommittedPlan`
  - `deferralRecordsFrom(plan: CommittedPlan): DeferralRecord[]`
  - `interface CommitSummaryView { weekId: WeekId; committedOn: ISODate; visits: Array<{ itemId: ItemId; vehicleId: VehicleId; garage: string; dateLabel: string; days: number; scope: string }>; availability: DayCapacity[]; coverAssumptions: string[]; deferrals: Array<{ itemId: ItemId; vehicleId: VehicleId; title: string; reason: string; reviewDate: ISODate; triggerLabel: string }>; holds: Array<{ vehicleId: VehicleId; reason: string; releaseRecordedOn: ISODate | null }> }`
  - `summaryFor(args: { fixture: Fixture; plan: CommittedPlan }): CommitSummaryView`
  - `interface DailyConfirmationView { date: ISODate; dateLabel: string; rows: DayCapacity[]; offRoad: Array<{ vehicleId: VehicleId; reason: string }>; coverInUse: string[] }`
  - `dailyConfirmation(args: { fixture: Fixture; plan: CommittedPlan; forDate: ISODate }): DailyConfirmationView`

- [ ] **Step 1: Write the failing test**

Create `src/domain/commit.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { commitPlan, dailyConfirmation, deferralRecordsFrom, summaryFor } from './commit'
import { fixture } from './fixture'
import type { DraftDecision, ItemId } from './types'

const WEEK_40 = '2026-09-28'

function committable(): Record<ItemId, DraftDecision> {
  const d: Record<ItemId, DraftDecision> = {}
  for (const i of fixture.items) {
    d[i.id] = { itemId: i.id, treatment: i.proposal.treatment, slotDate: i.proposal.slotDate, deferral: i.proposal.deferral }
  }
  d['item-v118'] = { ...d['item-v118'], slotDate: '2026-10-01' }
  d['item-v041'] = {
    itemId: 'item-v041',
    treatment: 'watch',
    slotDate: null,
    deferral: {
      reason: 'No specialist cover exists this week.',
      reviewDate: '2026-10-05',
      trigger: { kind: 'event', eventId: 'v041-dtc-recurs', label: 'DTC P0300 recurs' },
    },
  }
  return d
}

describe('committing', () => {
  it('records the week and the demo date it was committed on', () => {
    const plan = commitPlan({ weekId: WEEK_40, decisions: committable(), demoDate: '2026-09-28' })
    expect(plan.weekId).toBe(WEEK_40)
    expect(plan.committedOn).toBe('2026-09-28')
  })

  it('produces an identical plan when committed twice from the same draft', () => {
    const decisions = committable()
    const first = commitPlan({ weekId: WEEK_40, decisions, demoDate: '2026-09-28' })
    const second = commitPlan({ weekId: WEEK_40, decisions, demoDate: '2026-09-28' })
    expect(second).toEqual(first)
  })

  it('never duplicates a visit across repeated commits', () => {
    const decisions = committable()
    const a = summaryFor({ fixture, plan: commitPlan({ weekId: WEEK_40, decisions, demoDate: '2026-09-28' }) })
    const b = summaryFor({ fixture, plan: commitPlan({ weekId: WEEK_40, decisions, demoDate: '2026-09-28' }) })
    expect(b.visits).toEqual(a.visits)
    expect(new Set(b.visits.map((v) => v.itemId)).size).toBe(b.visits.length)
  })

  it('does not mutate the draft it was given', () => {
    const decisions = committable()
    const snapshot = JSON.stringify(decisions)
    commitPlan({ weekId: WEEK_40, decisions, demoDate: '2026-09-28' })
    expect(JSON.stringify(decisions)).toBe(snapshot)
  })

  it('keeps the committed snapshot intact when the draft is edited afterwards', () => {
    const decisions = committable()
    const plan = commitPlan({ weekId: WEEK_40, decisions, demoDate: '2026-09-28' })
    decisions['item-v118'] = { ...decisions['item-v118'], slotDate: '2026-09-30' }
    expect(plan.decisions['item-v118'].slotDate).toBe('2026-10-01')
  })
})

describe('the commit summary', () => {
  const plan = commitPlan({ weekId: WEEK_40, decisions: committable(), demoDate: '2026-09-28' })
  const summary = summaryFor({ fixture, plan })

  it('lists the three confirmed visits', () => {
    expect(summary.visits.map((v) => v.itemId).sort()).toEqual(['item-v012', 'item-v103', 'item-v118'])
  })

  it('carries forward availability with no shortfall left', () => {
    expect(summary.availability.every((d) => d.shortfall === 0)).toBe(true)
    expect(summary.availability).toHaveLength(10)
  })

  it('states the cover assumptions explicitly', () => {
    expect(summary.coverAssumptions.join(' ')).toContain('R-1')
    expect(summary.coverAssumptions.join(' ')).toContain('R-2')
  })

  it('lists both deferred follow-ups with their review date and trigger', () => {
    expect(summary.deferrals.map((d) => d.itemId).sort()).toEqual(['item-v027', 'item-v041'])
    const v041 = summary.deferrals.find((d) => d.itemId === 'item-v041')!
    expect(v041.reviewDate).toBe('2026-10-05')
    expect(v041.triggerLabel).toContain('P0300')
  })

  it('states the outstanding hold and the release the fixture records', () => {
    expect(summary.holds.map((h) => h.vehicleId)).toEqual(['V-012'])
    expect(summary.holds[0].releaseRecordedOn).toBe('2026-10-06')
  })
})

describe('deferral records extracted from a commit', () => {
  it('produces one record per deferred item, stamped with the commit date', () => {
    const plan = commitPlan({ weekId: WEEK_40, decisions: committable(), demoDate: '2026-09-28' })
    const records = deferralRecordsFrom(plan)
    expect(records.map((r) => r.itemId).sort()).toEqual(['item-v027', 'item-v041'])
    expect(records[0].decidedOn).toBe('2026-09-28')
    expect(records[0].weekId).toBe(WEEK_40)
  })
})

describe('the daily confirmation is a read-only projection', () => {
  const plan = commitPlan({ weekId: WEEK_40, decisions: committable(), demoDate: '2026-09-28' })

  it('reports Tuesday with V-012 and V-103 off the road and their reasons', () => {
    const view = dailyConfirmation({ fixture, plan, forDate: '2026-09-29' })
    expect(view.offRoad.map((o) => o.vehicleId).sort()).toEqual(['V-012', 'V-103'])
    expect(view.offRoad.find((o) => o.vehicleId === 'V-012')!.reason).toContain('Held')
    expect(view.offRoad.find((o) => o.vehicleId === 'V-103')!.reason).toContain('visit')
  })

  it('names the cover in use that day', () => {
    expect(dailyConfirmation({ fixture, plan, forDate: '2026-09-29' }).coverInUse.sort()).toEqual(['R-1', 'R-2'])
    expect(dailyConfirmation({ fixture, plan, forDate: '2026-09-30' }).coverInUse).toEqual(['R-1'])
  })

  it('shows both classes meeting demand', () => {
    const view = dailyConfirmation({ fixture, plan, forDate: '2026-09-29' })
    expect(view.rows).toHaveLength(2)
    expect(view.rows.every((r) => r.shortfall === 0)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- commit`
Expected: FAIL, `Failed to resolve import "./commit"`.

- [ ] **Step 3: Write `src/domain/commit.ts`**

```ts
import { computeDayCapacity, computeWeekCapacity, isHeldOn, unavailableOn, weekFixtureFor } from './capacity'
import { formatDay, formatLongDay } from './clock'
import type {
  CommittedPlan,
  DayCapacity,
  DeferralRecord,
  DraftDecision,
  Fixture,
  ISODate,
  ItemId,
  VehicleClass,
  VehicleId,
  WeekId,
} from './types'
import { visitCoversDate, visitsFromDecisions } from './visits'

/**
 * The snapshot is a deep copy, so editing the draft afterwards leaves the
 * last committed plan intact until recommit. [S 2.3]
 */
export function commitPlan(args: {
  weekId: WeekId
  decisions: Record<ItemId, DraftDecision>
  demoDate: ISODate
}): CommittedPlan {
  const { weekId, decisions, demoDate } = args
  return {
    weekId,
    committedOn: demoDate,
    decisions: JSON.parse(JSON.stringify(decisions)) as Record<ItemId, DraftDecision>,
  }
}

export function deferralRecordsFrom(plan: CommittedPlan): DeferralRecord[] {
  return Object.values(plan.decisions)
    .filter((d) => d.deferral !== null)
    .map((d) => ({
      itemId: d.itemId,
      deferral: d.deferral!,
      decidedOn: plan.committedOn,
      weekId: plan.weekId,
    }))
    .sort((a, b) => a.itemId.localeCompare(b.itemId))
}

export interface CommitSummaryView {
  weekId: WeekId
  committedOn: ISODate
  visits: Array<{
    itemId: ItemId
    vehicleId: VehicleId
    garage: string
    dateLabel: string
    days: number
    scope: string
  }>
  availability: DayCapacity[]
  coverAssumptions: string[]
  deferrals: Array<{
    itemId: ItemId
    vehicleId: VehicleId
    title: string
    reason: string
    reviewDate: ISODate
    triggerLabel: string
  }>
  holds: Array<{ vehicleId: VehicleId; reason: string; releaseRecordedOn: ISODate | null }>
}

export function summaryFor(args: { fixture: Fixture; plan: CommittedPlan }): CommitSummaryView {
  const { fixture, plan } = args
  const week = weekFixtureFor(fixture, plan.weekId)
  const visits = visitsFromDecisions(plan.decisions, fixture.items)

  const coverAssumptions = fixture.covers
    .filter((c) => week.coverIds.includes(c.id))
    .map((c) => {
      const inWeek = c.confirmedDates.filter((d) => week.days.includes(d))
      return `${c.id}, ${c.vehicleClass} cover, confirmed ${inWeek.map(formatDay).join(', ')} at EUR ${c.dayRateEur} per day.`
    })
  if (!fixture.covers.some((c) => week.coverIds.includes(c.id) && c.vehicleClass === 'specialist')) {
    coverAssumptions.push('No specialist cover is available this week. A standard rental does not substitute.')
  }

  return {
    weekId: plan.weekId,
    committedOn: plan.committedOn,
    visits: visits.map((v) => ({
      itemId: v.itemId,
      vehicleId: v.vehicleId,
      garage: fixture.garages.find((g) => g.id === v.garageId)?.name ?? v.garageId,
      dateLabel: formatDay(v.startDate),
      days: v.days,
      scope: v.scope,
    })),
    availability: computeWeekCapacity({ fixture, weekId: plan.weekId, visits }),
    coverAssumptions,
    deferrals: Object.values(plan.decisions)
      .filter((d) => d.deferral !== null)
      .map((d) => {
        const item = fixture.items.find((i) => i.id === d.itemId)
        return {
          itemId: d.itemId,
          vehicleId: item?.vehicleId ?? '',
          title: item?.title ?? d.itemId,
          reason: d.deferral!.reason,
          reviewDate: d.deferral!.reviewDate,
          triggerLabel: d.deferral!.trigger.label,
        }
      })
      .sort((a, b) => a.itemId.localeCompare(b.itemId)),
    holds: fixture.vehicles
      .filter((v) => v.hold !== null)
      .map((v) => ({
        vehicleId: v.id,
        reason: v.hold!.reason,
        releaseRecordedOn: v.hold!.releaseRecordedOn,
      })),
  }
}

export interface DailyConfirmationView {
  date: ISODate
  dateLabel: string
  rows: DayCapacity[]
  offRoad: Array<{ vehicleId: VehicleId; reason: string }>
  coverInUse: string[]
}

/** Static and read-only. Route reassignment is not built: under a fleet with
 *  no reserve it cannot create capacity. [S 6.2, WP E8.4] */
export function dailyConfirmation(args: {
  fixture: Fixture
  plan: CommittedPlan
  forDate: ISODate
}): DailyConfirmationView {
  const { fixture, plan, forDate } = args
  const week = weekFixtureFor(fixture, plan.weekId)
  const visits = visitsFromDecisions(plan.decisions, fixture.items)
  const classes: VehicleClass[] = ['standard', 'specialist']

  const offRoad = [...unavailableOn(forDate, fixture.vehicles, visits)]
    .sort()
    .map((vehicleId) => {
      const vehicle = fixture.vehicles.find((v) => v.id === vehicleId)
      const visit = visits.find((v) => v.vehicleId === vehicleId && visitCoversDate(v, forDate))
      if (vehicle && isHeldOn(vehicle, forDate)) {
        return { vehicleId, reason: `Held out of service: ${vehicle.hold!.reason.toLowerCase()}` }
      }
      return { vehicleId, reason: `In for a visit: ${visit?.scope ?? 'scheduled work'}` }
    })

  return {
    date: forDate,
    dateLabel: formatLongDay(forDate),
    rows: classes.map((vehicleClass) =>
      computeDayCapacity({ date: forDate, vehicleClass, fixture, visits, week }),
    ),
    offRoad,
    coverInUse: fixture.covers
      .filter((c) => week.coverIds.includes(c.id) && c.confirmedDates.includes(forDate))
      .map((c) => c.id)
      .sort(),
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- commit`
Expected: PASS, 14 tests.

- [ ] **Step 5: Run the whole domain suite**

Run: `npm test`
Expected: PASS, every test from Tasks 1 to 8.

- [ ] **Step 6: Commit**

```bash
git add src/domain/commit.ts src/domain/commit.test.ts
git commit -m "feat: commit a plan and project its outputs

The committed snapshot is a deep copy, so editing the draft afterwards
leaves the last commit intact until recommit.

The summary and the daily confirmation are projections of the
committed decisions rather than a second store, which is why
recommitting cannot duplicate a visit: nothing is ever appended.

The summary states the cover assumptions in full, including the
absence of specialist cover, so the plan does not read as safer than
it is."
```

---

## Task 9: The state layer

**Files:**
- Modify: `src/domain/deferral.ts` (add `nextResurfaceDate`)
- Create: `src/state/planReducer.ts`
- Create: `src/state/persistence.ts`
- Create: `src/state/PlanProvider.tsx`
- Test: `src/domain/planReducer.test.ts`

The reducer test lives under `src/domain/` so the existing Vitest `include` glob picks it up without config changes. The reducer itself imports nothing from the browser, so it is testable as a pure function.

**Interfaces:**
- Consumes: everything from `src/domain`.
- Produces:
  - `deferral.ts`: `nextResurfaceDate(args: { fixture: Fixture; history: Record<ItemId, DeferralRecord[]>; after: ISODate }): ISODate | null`
  - `planReducer.ts`: `interface AppState { version: 1; demoDate: ISODate; draftByWeek: Record<WeekId, Record<ItemId, DraftDecision>>; committedByWeek: Record<WeekId, CommittedPlan | null>; deferralHistory: Record<ItemId, DeferralRecord[]>; storageNotice: string | null }`, `type PlanAction`, `initialState(fixture: Fixture): AppState`, `planReducer(state: AppState, action: PlanAction, fixture: Fixture): AppState`, `activeWeekId(state: AppState): WeekId`, `queueFor(args: { fixture: Fixture; state: AppState; weekId: WeekId }): Array<{ item: OpenItem; resurfacedBecause: string | null; priorDecision: DeferralRecord | null }>`, `draftFor(args: { fixture: Fixture; state: AppState; weekId: WeekId }): Record<ItemId, DraftDecision>`
  - `persistence.ts`: `STORAGE_KEY`, `loadState(fixture: Fixture): AppState`, `saveState(state: AppState): void`, `clearState(): void`
  - `PlanProvider.tsx`: `PlanProvider`, `usePlan(): { state: AppState; dispatch: (a: PlanAction) => void; fixture: Fixture }`

- [ ] **Step 1: Write the failing test**

Create `src/domain/planReducer.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture'
import { nextResurfaceDate } from './deferral'
import { activeWeekId, draftFor, initialState, planReducer, queueFor } from '../state/planReducer'
import type { AppState } from '../state/planReducer'

const reduce = (s: AppState, a: Parameters<typeof planReducer>[1]) => planReducer(s, a, fixture)

function committedWeek40(): AppState {
  let s = initialState(fixture)
  s = reduce(s, {
    type: 'set-decision',
    weekId: '2026-09-28',
    decision: { itemId: 'item-v118', treatment: 'act-now', slotDate: '2026-10-01', deferral: null },
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

describe('initial state', () => {
  const s = initialState(fixture)

  it('opens on the seeded Monday with nothing committed', () => {
    expect(s.demoDate).toBe('2026-09-28')
    expect(activeWeekId(s)).toBe('2026-09-28')
    expect(s.committedByWeek['2026-09-28'] ?? null).toBeNull()
  })

  it('seeds the draft from the system proposals, undisposed items included', () => {
    const draft = draftFor({ fixture, state: s, weekId: '2026-09-28' })
    expect(Object.keys(draft)).toHaveLength(5)
    expect(draft['item-v118'].slotDate).toBe('2026-09-29')
    expect(draft['item-v041'].slotDate).toBeNull()
  })

  it('shows all five items in the week 40 queue', () => {
    expect(queueFor({ fixture, state: s, weekId: '2026-09-28' })).toHaveLength(5)
  })
})

describe('editing the draft', () => {
  it('records a decision without touching the proposal', () => {
    const s = reduce(initialState(fixture), {
      type: 'set-decision',
      weekId: '2026-09-28',
      decision: { itemId: 'item-v118', treatment: 'act-now', slotDate: '2026-10-01', deferral: null },
    })
    expect(draftFor({ fixture, state: s, weekId: '2026-09-28' })['item-v118'].slotDate).toBe('2026-10-01')
    expect(fixture.items.find((i) => i.id === 'item-v118')!.proposal.slotDate).toBe('2026-09-29')
  })
})

describe('committing', () => {
  const s = committedWeek40()

  it('stores a snapshot and the deferral history', () => {
    expect(s.committedByWeek['2026-09-28']!.decisions['item-v118'].slotDate).toBe('2026-10-01')
    expect(Object.keys(s.deferralHistory).sort()).toEqual(['item-v027', 'item-v041'])
  })

  it('leaves the snapshot intact when the draft is edited afterwards', () => {
    const edited = reduce(s, {
      type: 'set-decision',
      weekId: '2026-09-28',
      decision: { itemId: 'item-v118', treatment: 'act-now', slotDate: '2026-09-30', deferral: null },
    })
    expect(edited.committedByWeek['2026-09-28']!.decisions['item-v118'].slotDate).toBe('2026-10-01')
    expect(draftFor({ fixture, state: edited, weekId: '2026-09-28' })['item-v118'].slotDate).toBe('2026-09-30')
  })

  it('does not accumulate duplicate deferral records on recommit', () => {
    const again = reduce(s, { type: 'commit', weekId: '2026-09-28' })
    expect(again.deferralHistory['item-v041']).toHaveLength(1)
  })
})

describe('advancing the clock', () => {
  it('moves the active week when it crosses into the next one', () => {
    const s = reduce(committedWeek40(), { type: 'advance-days', days: 7 })
    expect(s.demoDate).toBe('2026-10-05')
    expect(activeWeekId(s)).toBe('2026-10-05')
  })

  it('finds the next resurface date', () => {
    const s = committedWeek40()
    expect(nextResurfaceDate({ fixture, history: s.deferralHistory, after: '2026-09-28' })).toBe('2026-10-05')
  })

  it('jumps straight to it', () => {
    const s = reduce(committedWeek40(), { type: 'advance-to-next-review' })
    expect(s.demoDate).toBe('2026-10-05')
  })

  it('resurfaces V-041 into week 41 with its rationale intact', () => {
    const s = reduce(committedWeek40(), { type: 'advance-to-next-review' })
    const queue = queueFor({ fixture, state: s, weekId: '2026-10-05' })
    expect(queue.map((q) => q.item.id)).toEqual(['item-v041'])
    expect(queue[0].resurfacedBecause).toContain('Review date')
    expect(queue[0].priorDecision!.deferral.reason).toContain('No specialist cover')
  })

  it('leaves V-027 down, since neither its date nor its trigger has arrived', () => {
    const s = reduce(committedWeek40(), { type: 'advance-to-next-review' })
    expect(queueFor({ fixture, state: s, weekId: '2026-10-05' }).some((q) => q.item.id === 'item-v027')).toBe(false)
  })
})

describe('reset', () => {
  it('restores the seed and the demo date', () => {
    const s = reduce(committedWeek40(), { type: 'reset' })
    expect(s).toEqual(initialState(fixture))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- planReducer`
Expected: FAIL, `Failed to resolve import "../state/planReducer"`.

- [ ] **Step 3: Add `nextResurfaceDate` to `src/domain/deferral.ts`**

Append to that file:

```ts
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
    const latest = latestRecord(records)
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
```

Add `addDays` to the existing import from `./clock`, and `ItemId` to the type import.

- [ ] **Step 4: Write `src/state/planReducer.ts`**

```ts
import { commitPlan, deferralRecordsFrom } from '../domain/commit'
import { addDays, mondayOf } from '../domain/clock'
import { nextResurfaceDate, resurfacedItems } from '../domain/deferral'
import { weekFixtureFor } from '../domain/capacity'
import { SEED_DATE } from '../domain/fixture'
import type {
  CommittedPlan,
  DeferralRecord,
  DraftDecision,
  Fixture,
  ISODate,
  ItemId,
  OpenItem,
  WeekId,
} from '../domain/types'

export interface AppState {
  version: 1
  demoDate: ISODate
  draftByWeek: Record<WeekId, Record<ItemId, DraftDecision>>
  committedByWeek: Record<WeekId, CommittedPlan | null>
  deferralHistory: Record<ItemId, DeferralRecord[]>
  storageNotice: string | null
}

export type PlanAction =
  | { type: 'set-decision'; weekId: WeekId; decision: DraftDecision }
  | { type: 'commit'; weekId: WeekId }
  | { type: 'advance-days'; days: number }
  | { type: 'advance-to-next-review' }
  | { type: 'reset' }
  | { type: 'dismiss-notice' }

export function activeWeekId(state: AppState): WeekId {
  return mondayOf(state.demoDate)
}

export interface QueueEntry {
  item: OpenItem
  resurfacedBecause: string | null
  priorDecision: DeferralRecord | null
}

/**
 * The week's queue is its authored items plus anything resurfacing from an
 * earlier week. Week 41 and later author no items, so they show resurfaced
 * work only. [S 3.7]
 */
export function queueFor(args: { fixture: Fixture; state: AppState; weekId: WeekId }): QueueEntry[] {
  const { fixture, state, weekId } = args
  const week = weekFixtureFor(fixture, weekId)
  const authored = fixture.items
    .filter((i) => week.itemIds.includes(i.id))
    .map((item) => ({ item, resurfacedBecause: null, priorDecision: null }))

  const resurfaced = resurfacedItems({
    fixture,
    history: state.deferralHistory,
    demoDate: state.demoDate,
  })
    .filter((r) => !week.itemIds.includes(r.item.id))
    .map((r) => ({ item: r.item, resurfacedBecause: r.because, priorDecision: r.record }))

  return [...authored, ...resurfaced]
}

export function draftFor(args: {
  fixture: Fixture
  state: AppState
  weekId: WeekId
}): Record<ItemId, DraftDecision> {
  const { fixture, state, weekId } = args
  const existing = state.draftByWeek[weekId]
  const seeded: Record<ItemId, DraftDecision> = {}

  for (const entry of queueFor({ fixture, state, weekId })) {
    const { item, priorDecision } = entry
    seeded[item.id] = priorDecision
      ? // A resurfaced item comes back undisposed, but its prior rationale
        // stays visible through priorDecision. [WP E6.4]
        { itemId: item.id, treatment: null, slotDate: null, deferral: null }
      : {
          itemId: item.id,
          treatment: item.proposal.treatment,
          slotDate: item.proposal.slotDate,
          deferral: item.proposal.deferral,
        }
  }
  return { ...seeded, ...(existing ?? {}) }
}

export function initialState(_fixture: Fixture): AppState {
  return {
    version: 1,
    demoDate: SEED_DATE,
    draftByWeek: {},
    committedByWeek: {},
    deferralHistory: {},
    storageNotice: null,
  }
}

export function planReducer(state: AppState, action: PlanAction, fixture: Fixture): AppState {
  switch (action.type) {
    case 'set-decision': {
      const current = draftFor({ fixture, state, weekId: action.weekId })
      return {
        ...state,
        draftByWeek: {
          ...state.draftByWeek,
          [action.weekId]: { ...current, [action.decision.itemId]: action.decision },
        },
      }
    }

    case 'commit': {
      const decisions = draftFor({ fixture, state, weekId: action.weekId })
      const plan = commitPlan({ weekId: action.weekId, decisions, demoDate: state.demoDate })
      // Rebuild history only for items this plan actually decided. An item
      // decided away from a deferral must lose its old record, or it resurfaces
      // forever on a stale rationale. An item still undisposed has decided
      // nothing, so its history must survive untouched.
      const history = { ...state.deferralHistory }
      const newRecords = new Map(deferralRecordsFrom(plan).map((r) => [r.itemId, r]))
      for (const [itemId, decision] of Object.entries(plan.decisions)) {
        if (decision.treatment === null) continue
        const others = (history[itemId] ?? []).filter((r) => r.weekId > plan.weekId)
        const record = newRecords.get(itemId)
        const next = record ? [...others, record] : others
        if (next.length === 0) delete history[itemId]
        else history[itemId] = next
      }
      return {
        ...state,
        draftByWeek: { ...state.draftByWeek, [action.weekId]: decisions },
        committedByWeek: { ...state.committedByWeek, [action.weekId]: plan },
        deferralHistory: history,
      }
    }

    case 'advance-days':
      return { ...state, demoDate: addDays(state.demoDate, action.days) }

    case 'advance-to-next-review': {
      const next = nextResurfaceDate({
        fixture,
        history: state.deferralHistory,
        after: state.demoDate,
      })
      return next === null ? state : { ...state, demoDate: next }
    }

    case 'reset':
      return initialState(fixture)

    case 'dismiss-notice':
      return { ...state, storageNotice: null }
  }
}
```

- [ ] **Step 5: Write `src/state/persistence.ts`**

```ts
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
```

- [ ] **Step 6: Write `src/state/PlanProvider.tsx`**

```tsx
import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { fixture as defaultFixture } from '../domain/fixture'
import type { Fixture } from '../domain/types'
import { planReducer, type AppState, type PlanAction } from './planReducer'
import { clearState, loadState, saveState } from './persistence'

interface PlanContextValue {
  state: AppState
  dispatch: (action: PlanAction) => void
  fixture: Fixture
}

const PlanContext = createContext<PlanContextValue | null>(null)

export function PlanProvider({
  children,
  fixture = defaultFixture,
}: {
  children: ReactNode
  fixture?: Fixture
}) {
  const [state, dispatch] = useReducer(
    (s: AppState, a: PlanAction) => planReducer(s, a, fixture),
    fixture,
    loadState,
  )

  useEffect(() => {
    if (state.storageNotice === null) saveState(state)
  }, [state])

  const value = useMemo(
    () => ({
      state,
      fixture,
      dispatch: (action: PlanAction) => {
        if (action.type === 'reset') clearState()
        dispatch(action)
      },
    }),
    [state, fixture],
  )

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>
}

export function usePlan(): PlanContextValue {
  const value = useContext(PlanContext)
  if (value === null) throw new Error('usePlan must be used inside a PlanProvider')
  return value
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm test -- planReducer`
Expected: PASS, 13 tests.

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/state src/domain/deferral.ts src/domain/planReducer.test.ts
git commit -m "feat: add the reducer, persistence and the plan provider

One draft and one committed snapshot per week, keyed by the Monday.
Editing after a commit touches the draft only, so the snapshot stays
frozen until recommit.

Deferral records are replaced per item and week rather than appended,
so recommitting a week cannot accumulate duplicates.

Storage is never trusted. Absent, disabled, full, corrupt and
version-mismatched state all fall back to the seed and say so in the
demo bar, rather than crashing or failing silently."
```

---

## Task 10: The UI shell, demo bar and plan header

**Files:**
- Create: `src/ui/theme.css`
- Create: `src/ui/DemoBar.tsx`
- Create: `src/ui/PlanHeader.tsx`
- Modify: `src/App.tsx`, `src/main.tsx`
- Delete: `src/App.css`, `src/index.css`, `src/assets/react.svg` (Vite template leftovers)

**Interfaces:**
- Consumes: `usePlan` from `../state/PlanProvider`; `activeWeekId`, `draftFor`, `queueFor` from `../state/planReducer`; `validatePlan`, `canCommit`, `describeBlocker` from `../domain/validation`.
- Produces: `DemoBar`, `PlanHeader`. Later UI tasks mount inside `App.tsx` between them and the page bottom.

**No automated tests in Tasks 10 to 14.** [S §1] locks Vitest to the domain layer. Each UI task ends with a numbered manual check against `npm run dev`. Run `npm test` anyway at the end of every UI task to confirm nothing in the domain regressed.

**Visual reference:** keep `docs/mockups/layout-b-capacity-band.mockup.html` open in a second tab. Its CSS is the source for `theme.css`.

- [ ] **Step 1: Write `src/ui/theme.css`**

```css
:root {
  --bg: #f7f8fa;
  --surface: #fff;
  --border: #e3e6ea;
  --border-strong: #cfd5dc;
  --text: #14181d;
  --muted: #626a75;
  --faint: #8b939e;
  --accent: #1f5fd0;
  --accent-soft: #eaf0fc;
  --crit: #c0322b;
  --crit-soft: #fbecea;
  --warn: #b26a00;
  --warn-soft: #fdf3e3;
  --ok: #2c7a4b;
  --ok-soft: #eaf5ee;
  --spec: #5b3fa8;
  --spec-soft: #f0ecfa;
  --r: 6px;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 13px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}

button { font: inherit; cursor: pointer; }
button:disabled { cursor: not-allowed; }

.demobar {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  padding: 7px 18px; background: #fff8e6;
  border-bottom: 1px solid #f0dfb4; font-size: 12px;
}
.demobar .tag {
  background: var(--warn); color: #fff; padding: 2px 7px; border-radius: 3px;
  font-size: 10px; font-weight: 700; letter-spacing: 0.05em;
}
.demobar .clock { color: #7a5a12; font-weight: 600; }
.demobar .spacer { flex: 1; }
.demobar button {
  font-size: 11px; background: #fff; border: 1px solid #e0cd9e;
  padding: 3px 9px; border-radius: 4px; color: #7a5a12;
}
.demobar button:disabled { opacity: 0.45; }
.demobar .notice {
  width: 100%; color: var(--crit); font-weight: 600; padding-top: 4px;
}

.planheader {
  display: flex; align-items: baseline; gap: 16px;
  padding: 14px 18px 12px; background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.planheader h1 { margin: 0; font-size: 16px; font-weight: 650; letter-spacing: -0.01em; }
.planheader .week { color: var(--muted); font-size: 13px; }
.planheader .spacer { flex: 1; }
.planheader .commit {
  font-weight: 600; font-size: 13px; padding: 7px 15px; border-radius: var(--r);
  border: 1px solid var(--accent); background: var(--accent); color: #fff;
}
.planheader .commit:disabled {
  border-color: var(--border-strong); background: #f1f2f4; color: var(--faint);
}
.planheader .blocked {
  font-size: 11.5px; color: var(--crit); margin-top: 4px;
  text-align: right; max-width: 420px;
}
.planheader .committed { font-size: 11.5px; color: var(--ok); margin-top: 4px; text-align: right; }

.urg {
  display: inline-block; font-size: 10px; font-weight: 700; padding: 1px 5px;
  border-radius: 3px; border: 1px solid; letter-spacing: 0.03em; white-space: nowrap;
}
.urg.deadline { color: var(--crit); border-color: #e8bdb9; background: var(--crit-soft); }
.urg.estimate { color: var(--warn); border-color: #ecd5a6; background: var(--warn-soft); }
.urg.assessment-needed { color: #4a525c; border-color: var(--border-strong); background: #f2f4f6; }

.badge {
  font-size: 9.5px; font-weight: 700; letter-spacing: 0.05em;
  text-transform: uppercase; padding: 2px 6px; border-radius: 3px;
}
.badge.safety { background: var(--crit-soft); color: var(--crit); }
.badge.specialist { background: var(--spec-soft); color: var(--spec); }
.badge.held { background: #eceef1; color: #4a525c; }
.badge.resurfaced { background: var(--accent-soft); color: var(--accent); }

.vid { font-weight: 700; font-size: 13px; font-variant-numeric: tabular-nums; }
.synthetic {
  font-size: 9.5px; font-weight: 700; color: var(--warn); background: var(--warn-soft);
  border: 1px solid #ecd5a6; padding: 1px 5px; border-radius: 3px; letter-spacing: 0.04em;
}
```

- [ ] **Step 2: Write `src/ui/DemoBar.tsx`**

```tsx
import { formatLongDay } from '../domain/clock'
import { nextResurfaceDate } from '../domain/deferral'
import { usePlan } from '../state/PlanProvider'

export function DemoBar() {
  const { state, dispatch, fixture } = usePlan()
  const nextReview = nextResurfaceDate({
    fixture,
    history: state.deferralHistory,
    after: state.demoDate,
  })

  return (
    <div className="demobar">
      <span className="tag">SIMULATED</span>
      <span className="clock">Demo clock: {formatLongDay(state.demoDate)}</span>
      <span style={{ color: '#8a6d2f' }}>Synthetic fleet and scenario prices</span>
      <span className="spacer" />
      <button onClick={() => dispatch({ type: 'advance-days', days: 1 })}>Advance 1 day</button>
      <button
        onClick={() => dispatch({ type: 'advance-to-next-review' })}
        disabled={nextReview === null}
        title={nextReview === null ? 'Nothing is deferred with a pending review' : `Jump to ${nextReview}`}
      >
        Advance to next review date
      </button>
      <button onClick={() => dispatch({ type: 'reset' })}>Reset scenario</button>
      {state.storageNotice !== null && (
        <div className="notice">
          {state.storageNotice}{' '}
          <button onClick={() => dispatch({ type: 'dismiss-notice' })}>Dismiss</button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Write `src/ui/PlanHeader.tsx`**

```tsx
import { formatDay, isoWeekNumber } from '../domain/clock'
import { weekFixtureFor } from '../domain/capacity'
import { canCommit, describeBlocker } from '../domain/validation'
import type { Blocker } from '../domain/types'
import { usePlan } from '../state/PlanProvider'
import { activeWeekId } from '../state/planReducer'

export function PlanHeader({ blockers, onCommit }: { blockers: Blocker[]; onCommit: () => void }) {
  const { state, fixture } = usePlan()
  const weekId = activeWeekId(state)
  const week = weekFixtureFor(fixture, weekId)
  const committed = state.committedByWeek[weekId] ?? null
  const ready = canCommit(blockers)

  return (
    <header className="planheader">
      <h1>Weekly maintenance plan</h1>
      <span className="week">
        Week {isoWeekNumber(weekId)} · {formatDay(week.days[0])} to {formatDay(week.days[4])} 2026 ·{' '}
        {fixture.depot} · {fixture.vehicles.length} vans
      </span>
      <span className="spacer" />
      <div>
        <button className="commit" onClick={onCommit} disabled={!ready}>
          {committed === null ? 'Commit plan' : 'Recommit plan'}
        </button>
        {ready ? (
          committed !== null && (
            <div className="committed">Committed {formatDay(committed.committedOn)}. Simulated, nothing was sent.</div>
          )
        ) : (
          <div className="blocked">
            {blockers.length} {blockers.length === 1 ? 'blocker' : 'blockers'}:{' '}
            {describeBlocker(blockers[0], fixture)}
            {blockers.length > 1 && ` (and ${blockers.length - 1} more below)`}
          </div>
        )}
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Rewrite `src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { PlanProvider } from './state/PlanProvider'
import './ui/theme.css'

const root = document.getElementById('root')
if (root === null) throw new Error('Root element #root is missing from index.html')

createRoot(root).render(
  <StrictMode>
    <PlanProvider>
      <App />
    </PlanProvider>
  </StrictMode>,
)
```

- [ ] **Step 5: Rewrite `src/App.tsx`**

```tsx
import { useMemo } from 'react'
import { validatePlan } from './domain/validation'
import { usePlan } from './state/PlanProvider'
import { activeWeekId, draftFor } from './state/planReducer'
import { DemoBar } from './ui/DemoBar'
import { PlanHeader } from './ui/PlanHeader'

export default function App() {
  const { state, dispatch, fixture } = usePlan()
  const weekId = activeWeekId(state)
  const decisions = useMemo(() => draftFor({ fixture, state, weekId }), [fixture, state, weekId])
  const blockers = useMemo(
    () => validatePlan({ fixture, weekId, decisions }),
    [fixture, weekId, decisions],
  )

  return (
    <>
      <DemoBar />
      <PlanHeader blockers={blockers} onCommit={() => dispatch({ type: 'commit', weekId })} />
      {/* CapacityBand mounts here in Task 11 */}
      {/* DecisionQueue and ItemDetail mount here in Tasks 12 and 13 */}
    </>
  )
}
```

- [ ] **Step 6: Remove the Vite template leftovers**

```bash
rm -f src/App.css src/index.css src/assets/react.svg
rmdir src/assets 2>/dev/null || true
```

- [ ] **Step 7: Verify manually**

Run: `npm run dev` and open the printed URL.

Confirm each of these:
1. A yellow demo bar reads `SIMULATED`, `Demo clock: Monday 28 September 2026`.
2. The header reads `Week 40 · Mon 28 Sep to Fri 2 Oct 2026 · Depot Nord · 45 vans`.
3. `Commit plan` is **disabled**, with red text below reading `2 blockers:` followed by a description.
4. Clicking `Advance 1 day` moves the clock to Tuesday 29 September and the header still reads Week 40.
5. Clicking `Advance 1 day` five more times moves into Week 41 and the header updates.
6. `Advance to next review date` is **disabled**, because nothing has been deferred yet.
7. `Reset scenario` returns the clock to Monday 28 September.
8. Reloading the page keeps whatever clock you left it on, proving persistence works.

- [ ] **Step 8: Confirm the domain still passes and the build works**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: all domain tests PASS, no type errors, `dist/` produced.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add the app shell, demo bar and plan header

The prototype labels itself. The demo bar carries the SIMULATED tag,
the simulated clock, the advance and reset controls, and any storage
fallback notice, so nothing about the simulation is implicit.

The commit button is disabled while blockers exist and names the
leading one, rather than failing on click. A blocked plan is a
legitimate outcome of this product, not an error state."
```

---

## Task 11: The persistent capacity band

**Files:**
- Create: `src/ui/CapacityBand.tsx`
- Modify: `src/ui/theme.css` (append the band styles)
- Modify: `src/App.tsx` (mount the band)

**Interfaces:**
- Consumes: `computeWeekCapacity`, `weekFixtureFor` from `../domain/capacity`; `visitsFromDecisions` from `../domain/visits`; `formatDay` from `../domain/clock`.
- Produces: `CapacityBand({ decisions, selectedItemId }: { decisions: Record<ItemId, DraftDecision>; selectedItemId: ItemId | null })`.

This is the component the layout decision was made for. It stays visible while an item is open, so changing a slot recalculates in view. [S §6.1]

- [ ] **Step 1: Append the band styles to `src/ui/theme.css`**

```css
.band { background: var(--surface); border-bottom: 1px solid var(--border); padding: 10px 18px 11px; }
.band .head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 7px; flex-wrap: wrap; }
.band .head .t {
  font-size: 11px; font-weight: 700; letter-spacing: 0.07em;
  text-transform: uppercase; color: var(--faint);
}
.band .head .live {
  font-size: 11px; color: var(--accent); font-weight: 600;
  background: var(--accent-soft); padding: 2px 7px; border-radius: 3px;
}
.band .head .spacer { flex: 1; }
.band .cover { font-size: 11px; color: var(--muted); }
.band .cover b { color: var(--text); }
.band .cover .none { color: var(--crit); font-weight: 600; }

.band .days { display: grid; grid-template-columns: 82px repeat(5, 1fr); gap: 7px; }
.band .rowlab {
  display: flex; flex-direction: column; justify-content: flex-end; gap: 11px;
  font-size: 11px; font-weight: 600; color: var(--muted); padding-bottom: 2px;
}
.band .rowlab .top { margin-top: auto; }
.band .day {
  border: 1px solid var(--border); border-radius: var(--r);
  overflow: hidden; background: #fbfcfd;
}
.band .day.impacted { border-color: var(--crit); box-shadow: 0 0 0 2px var(--crit-soft); }
.band .day.candidate { border-color: var(--ok); box-shadow: 0 0 0 2px var(--ok-soft); }
.band .day .dh {
  font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
  color: var(--faint); text-align: center; padding: 4px 0 3px;
  border-bottom: 1px solid var(--border); background: #fff;
}
.band .c {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 6px 4px; font-size: 12px; font-variant-numeric: tabular-nums; font-weight: 600;
}
.band .c + .c { border-top: 1px solid var(--border); }
.band .c .sub { font-size: 10px; font-weight: 600; }
.band .c.short { background: var(--crit-soft); color: var(--crit); }
.band .c.spare { background: var(--ok-soft); color: var(--ok); }
.band .flagline {
  display: flex; gap: 16px; margin-top: 8px; font-size: 11.5px; flex-wrap: wrap;
}
.band .flag { display: flex; align-items: center; gap: 6px; color: var(--crit); font-weight: 600; }
.band .flag .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--crit); flex: none; }
.band .flag.ok { color: var(--ok); }
.band .flag.ok .dot { background: var(--ok); }
```

- [ ] **Step 2: Write `src/ui/CapacityBand.tsx`**

```tsx
import { computeWeekCapacity, weekFixtureFor } from '../domain/capacity'
import { formatDay } from '../domain/clock'
import type { DayCapacity, DraftDecision, ISODate, ItemId } from '../domain/types'
import { visitsFromDecisions } from '../domain/visits'
import { usePlan } from '../state/PlanProvider'
import { activeWeekId } from '../state/planReducer'

export function CapacityBand({
  decisions,
  selectedItemId,
}: {
  decisions: Record<ItemId, DraftDecision>
  selectedItemId: ItemId | null
}) {
  const { state, fixture } = usePlan()
  const weekId = activeWeekId(state)
  const week = weekFixtureFor(fixture, weekId)
  const visits = visitsFromDecisions(decisions, fixture.items)
  const rows = computeWeekCapacity({ fixture, weekId, visits })

  const cellFor = (date: ISODate, vehicleClass: 'standard' | 'specialist') =>
    rows.find((r) => r.date === date && r.vehicleClass === vehicleClass) as DayCapacity

  const selected = fixture.items.find((i) => i.id === selectedItemId) ?? null
  const shortDays = rows.filter((r) => r.shortfall > 0)
  const spareDays = rows.filter((r) => r.available > r.demand)

  const covers = fixture.covers.filter((c) => week.coverIds.includes(c.id))
  const hasSpecialistCover = covers.some((c) => c.vehicleClass === 'specialist')

  return (
    <div className="band">
      <div className="head">
        <span className="t">Week capacity · available / demand</span>
        {selected !== null && <span className="live">Reacting to {selected.vehicleId}</span>}
        <span className="spacer" />
        <span className="cover">
          {covers.map((c) => (
            <span key={c.id}>
              <b>{c.id}</b> {coverSummary(c.confirmedDates, week.days)} ·{' '}
            </span>
          ))}
          {!hasSpecialistCover && <span className="none">no specialist cover</span>}
        </span>
      </div>

      <div className="days">
        <div className="rowlab">
          <span className="top">Standard</span>
          <span>Specialist</span>
        </div>
        {week.days.map((date) => {
          const std = cellFor(date, 'standard')
          const spec = cellFor(date, 'specialist')
          const impacted = std.shortfall > 0 || spec.shortfall > 0
          const candidate = !impacted && (std.available > std.demand || spec.available > spec.demand)
          return (
            <div
              key={date}
              className={`day${impacted ? ' impacted' : ''}${candidate ? ' candidate' : ''}`}
            >
              <div className="dh">{formatDay(date)}</div>
              <Cell capacity={std} />
              <Cell capacity={spec} />
            </div>
          )
        })}
      </div>

      <div className="flagline">
        {shortDays.map((r) => (
          <span className="flag" key={`${r.date}-${r.vehicleClass}`}>
            <span className="dot" />
            {formatDay(r.date)}: {r.vehicleClass} short by {r.shortfall}. Off the road:{' '}
            {r.unavailable.join(', ')}
          </span>
        ))}
        {shortDays.length === 0 && spareDays.length > 0 && (
          <span className="flag ok">
            <span className="dot" />
            Every day is covered. Spare capacity on{' '}
            {[...new Set(spareDays.map((r) => formatDay(r.date)))].join(', ')}
          </span>
        )}
        {shortDays.length === 0 && spareDays.length === 0 && (
          <span className="flag ok">
            <span className="dot" />
            Every day is covered, with no spare van in the week
          </span>
        )}
      </div>
    </div>
  )
}

function Cell({ capacity }: { capacity: DayCapacity }) {
  const short = capacity.shortfall > 0
  const spare = capacity.available > capacity.demand
  return (
    <div className={`c${short ? ' short' : spare ? ' spare' : ''}`}>
      {capacity.available} / {capacity.demand}
      {short && <span className="sub">short {capacity.shortfall}</span>}
      {spare && <span className="sub">+{capacity.available - capacity.demand}</span>}
    </div>
  )
}

function coverSummary(confirmed: ISODate[], weekDays: ISODate[]): string {
  const inWeek = weekDays.filter((d) => confirmed.includes(d))
  if (inWeek.length === weekDays.length) return 'Mon to Fri'
  if (inWeek.length === 0) return 'not this week'
  return inWeek.map((d) => formatDay(d).slice(0, 3)).join(' and ') + ' only'
}
```

- [ ] **Step 3: Mount it in `src/App.tsx`**

Replace the `{/* CapacityBand mounts here in Task 11 */}` comment with:

```tsx
<CapacityBand decisions={decisions} selectedItemId={null} />
```

and add the import:

```tsx
import { CapacityBand } from './ui/CapacityBand'
```

- [ ] **Step 4: Verify manually**

Run: `npm run dev`

Confirm each of these:
1. Five day columns read Mon 28 through Fri 2, each with a Standard row above a Specialist row.
2. Tuesday reads `37 / 38` with `short 1`, shaded red, and its column has a red border.
3. Thursday reads `39 / 38` with `+1`, shaded green.
4. Monday, Wednesday and Friday all read `38 / 38` with no shading.
5. Every Specialist cell reads `7 / 7`.
6. The cover line on the right reads `R-1 Mon to Fri · R-2 Tue and Thu only · no specialist cover`.
7. The flag line below reads `Tue 29 Sep: standard short by 1. Off the road: V-012, V-103, V-118`.

- [ ] **Step 5: Confirm the domain still passes**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add the persistent week capacity band

Availability against demand, per day and per class, kept above the
queue so it stays visible while an item is open. The rejected layout
put the detail panel over this view, which hid capacity during the
one interaction that changes it.

The flag line names the vehicles behind a shortfall rather than
reporting a bare number, so the arithmetic is checkable."
```

---

## Task 12: The decision queue

**Files:**
- Create: `src/ui/ItemCard.tsx`
- Create: `src/ui/DecisionQueue.tsx`
- Modify: `src/ui/theme.css` (append the split and card styles)
- Modify: `src/App.tsx` (add selection state and mount the queue)

**Interfaces:**
- Consumes: `orderQueue`, `urgencyLabel` from `../domain/urgency`; `blockersForItem` from `../domain/validation`; `queueFor` from `../state/planReducer`.
- Produces: `ItemCard(props)`, `DecisionQueue({ decisions, blockers, selectedItemId, onSelect })`.

- [ ] **Step 1: Append the split and card styles to `src/ui/theme.css`**

```css
.split {
  display: grid;
  grid-template-columns: minmax(360px, 0.85fr) minmax(460px, 1.1fr);
  align-items: start;
}
.pane { padding: 13px 16px; }
.pane.left { border-right: 1px solid var(--border); }
.pane.right { background: #fbfcfd; border-left: 3px solid var(--accent); min-height: 60vh; }
.pane .panetitle {
  font-size: 11px; font-weight: 700; letter-spacing: 0.07em;
  text-transform: uppercase; color: var(--faint); margin: 0 0 10px;
}

.card {
  display: block; width: 100%; text-align: left;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r); padding: 9px 11px; margin-bottom: 7px; position: relative;
}
.card:hover { border-color: var(--border-strong); }
.card.sel { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }
.card .row1 { display: flex; align-items: center; gap: 7px; margin-bottom: 3px; padding-right: 110px; }
.card .title { font-size: 12.5px; margin-bottom: 5px; padding-right: 110px; }
.card .why { font-size: 11.5px; color: var(--muted); display: flex; align-items: center; gap: 5px; }
.card .state {
  position: absolute; top: 9px; right: 11px; font-size: 10.5px;
  font-weight: 600; color: var(--muted); max-width: 105px; text-align: right;
}
.card .state.warn { color: var(--warn); }
.card .state.crit { color: var(--crit); }
.card .prior {
  margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--border);
  font-size: 11px; color: var(--muted);
}
.empty { color: var(--muted); font-size: 12.5px; padding: 12px 0; }
```

- [ ] **Step 2: Write `src/ui/ItemCard.tsx`**

```tsx
import { formatDay } from '../domain/clock'
import { urgencyLabel } from '../domain/urgency'
import type { Blocker, DeferralRecord, DraftDecision, OpenItem, Vehicle } from '../domain/types'

export function ItemCard({
  item,
  vehicle,
  decision,
  blockers,
  resurfacedBecause,
  priorDecision,
  selected,
  onSelect,
}: {
  item: OpenItem
  vehicle: Vehicle
  decision: DraftDecision | undefined
  blockers: Blocker[]
  resurfacedBecause: string | null
  priorDecision: DeferralRecord | null
  selected: boolean
  onSelect: () => void
}) {
  const state = dispositionLabel(decision, blockers)

  return (
    <button className={`card${selected ? ' sel' : ''}`} onClick={onSelect}>
      <div className="row1">
        <span className="vid">{item.vehicleId}</span>
        {item.safetyClass && <span className="badge safety">Safety · hard stop</span>}
        {vehicle.hold !== null && <span className="badge held">Held since {formatDay(vehicle.hold.since)}</span>}
        {vehicle.vehicleClass === 'specialist' && <span className="badge specialist">Specialist</span>}
        {resurfacedBecause !== null && <span className="badge resurfaced">Resurfaced</span>}
      </div>
      <div className="title">{item.title}</div>
      <div className="why">
        <span className={`urg ${item.urgency.kind}`}>{urgencyLabel(item.urgency.kind)}</span>
        {item.urgency.because}
      </div>
      <div className={`state ${state.tone}`}>{state.text}</div>
      {priorDecision !== null && (
        <div className="prior">
          Previously: watch, decided {formatDay(priorDecision.decidedOn)}. {priorDecision.deferral.reason}
        </div>
      )}
    </button>
  )
}

function dispositionLabel(
  decision: DraftDecision | undefined,
  blockers: Blocker[],
): { text: string; tone: string } {
  if (blockers.some((b) => b.kind === 'capacity-shortfall')) {
    return { text: 'Causes a shortfall', tone: 'warn' }
  }
  if (blockers.some((b) => b.kind === 'infeasible-slot' || b.kind === 'parts-not-ready')) {
    return { text: 'Slot not bookable', tone: 'crit' }
  }
  if (!decision || decision.treatment === null) return { text: 'Decision needed', tone: 'crit' }
  if (decision.treatment === 'watch') {
    return decision.deferral === null
      ? { text: 'Watch, incomplete', tone: 'crit' }
      : { text: `Watch until ${formatDay(decision.deferral.reviewDate)}`, tone: '' }
  }
  if (decision.slotDate === null) return { text: 'No slot chosen', tone: 'crit' }
  return { text: `${formatDay(decision.slotDate)} booked`, tone: '' }
}
```

- [ ] **Step 3: Write `src/ui/DecisionQueue.tsx`**

```tsx
import { orderQueue } from '../domain/urgency'
import { blockersForItem } from '../domain/validation'
import type { Blocker, DraftDecision, ItemId } from '../domain/types'
import { usePlan } from '../state/PlanProvider'
import { activeWeekId, queueFor } from '../state/planReducer'
import { ItemCard } from './ItemCard'

export function DecisionQueue({
  decisions,
  blockers,
  selectedItemId,
  onSelect,
}: {
  decisions: Record<ItemId, DraftDecision>
  blockers: Blocker[]
  selectedItemId: ItemId | null
  onSelect: (id: ItemId) => void
}) {
  const { state, fixture } = usePlan()
  const weekId = activeWeekId(state)
  const entries = queueFor({ fixture, state, weekId })
  const ordered = orderQueue({ items: entries.map((e) => e.item), decisions, blockers })

  return (
    <div className="pane left">
      <p className="panetitle">Decisions needing attention · {ordered.length}</p>
      {ordered.length === 0 && (
        <p className="empty">
          Nothing needs a decision this week. Deferred items return on their review date or when their
          trigger fires.
        </p>
      )}
      {ordered.map((item) => {
        const entry = entries.find((e) => e.item.id === item.id)!
        const vehicle = fixture.vehicles.find((v) => v.id === item.vehicleId)!
        return (
          <ItemCard
            key={item.id}
            item={item}
            vehicle={vehicle}
            decision={decisions[item.id]}
            blockers={blockersForItem(blockers, item)}
            resurfacedBecause={entry.resurfacedBecause}
            priorDecision={entry.priorDecision}
            selected={selectedItemId === item.id}
            onSelect={() => onSelect(item.id)}
          />
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Add selection state to `src/App.tsx`**

Replace the whole component body with:

```tsx
import { useMemo, useState } from 'react'
import { validatePlan } from './domain/validation'
import type { ItemId } from './domain/types'
import { usePlan } from './state/PlanProvider'
import { activeWeekId, draftFor } from './state/planReducer'
import { CapacityBand } from './ui/CapacityBand'
import { DecisionQueue } from './ui/DecisionQueue'
import { DemoBar } from './ui/DemoBar'
import { PlanHeader } from './ui/PlanHeader'

export default function App() {
  const { state, dispatch, fixture } = usePlan()
  const [selectedItemId, setSelectedItemId] = useState<ItemId | null>(null)

  const weekId = activeWeekId(state)
  const decisions = useMemo(() => draftFor({ fixture, state, weekId }), [fixture, state, weekId])
  const blockers = useMemo(
    () => validatePlan({ fixture, weekId, decisions }),
    [fixture, weekId, decisions],
  )

  return (
    <>
      <DemoBar />
      <PlanHeader blockers={blockers} onCommit={() => dispatch({ type: 'commit', weekId })} />
      <CapacityBand decisions={decisions} selectedItemId={selectedItemId} />
      <div className="split">
        <DecisionQueue
          decisions={decisions}
          blockers={blockers}
          selectedItemId={selectedItemId}
          onSelect={setSelectedItemId}
        />
        <div className="pane right">
          {/* ItemDetail mounts here in Task 13 */}
          {selectedItemId === null && <p className="empty">Select an item to see its evidence and options.</p>}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 5: Verify manually**

Run: `npm run dev`

Confirm each of these:
1. The queue header reads `Decisions needing attention · 5`.
2. The cards appear in this order: `V-012`, `V-041`, `V-103`, `V-118`, `V-027`.
3. `V-012` shows a red `SAFETY · HARD STOP` badge and a grey `HELD SINCE FRI 25 SEP` badge.
4. `V-041` shows a purple `SPECIALIST` badge and its state reads `Decision needed`.
5. `V-103` and `V-118` both read `Causes a shortfall`, because both are on the short Tuesday.
6. `V-027` reads `Watch until Mon 2 Nov`.
7. Every card carries an urgency chip and a because line naming its evidence.
8. Clicking a card highlights it with a blue border, and the band's `Reacting to ...` chip appears.

- [ ] **Step 6: Confirm the domain still passes**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add the decision queue

Five items, never an undifferentiated list: each arrives with a
urgency state, a one-line because naming its evidence, and its
current disposition.

Order is fixed in tiers rather than by urgency alone, so the hard
stop leads and the decision the product is actively asking for comes
second, ahead of items that are merely urgent."
```

---

## Task 13: The item detail panel

**Files:**
- Create: `src/ui/EvidenceBlock.tsx`, `src/ui/AssumptionBlock.tsx`, `src/ui/ConsequenceBlock.tsx`
- Create: `src/ui/SlotPicker.tsx`, `src/ui/TreatmentForm.tsx`, `src/ui/ItemDetail.tsx`
- Modify: `src/ui/theme.css` (append the detail styles)
- Modify: `src/App.tsx` (mount `ItemDetail`)

**Interfaces:**
- Consumes: `recommendationFor`, `watchAvailable`, `watchUnavailableReason` from `../domain/recommendation`; `slotOptions` from `../domain/feasibility`; `deferralErrors` from `../domain/deferral`; `computeDayCapacity`, `weekFixtureFor` from `../domain/capacity`; `visitsFromDecisions` from `../domain/visits`.
- Produces: `ItemDetail({ item, decisions, onChange })` where `onChange(decision: DraftDecision): void` dispatches `set-decision`.

Three rules this task must not break, all from [S §6.5]:
- Infeasible slots are rendered **disabled with their reason**, never omitted.
- `bundle` and `watch` are rendered **disabled with the reason** on a hard-stop item, never hidden.
- Incomplete deferral fields disable `Apply to draft` and **name the missing field**.

- [ ] **Step 1: Append the detail styles to `src/ui/theme.css`**

```css
.detail .head { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
.detail .sub { font-size: 12.5px; color: var(--muted); margin-bottom: 11px; }
.block {
  border: 1px solid var(--border); border-radius: var(--r);
  padding: 10px 11px; margin-bottom: 9px; background: var(--surface);
}
.block .blocktitle {
  font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--faint); margin-bottom: 6px;
}
.block .kv { display: grid; grid-template-columns: 108px 1fr; gap: 3px 10px; font-size: 12px; margin: 0; }
.block .kv dt { color: var(--muted); }
.block .kv dd { margin: 0; }
.block .src { font-size: 10.5px; color: var(--faint); font-style: italic; }
.block .verbatim {
  margin-top: 7px; padding: 7px 9px; background: #fbfcfd;
  border-left: 3px solid var(--border-strong); font-size: 12px; font-style: italic;
}
.block p { margin: 0 0 6px; font-size: 12px; }
.block p:last-child { margin-bottom: 0; }

.costs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 4px; }
.cost { border: 1px solid var(--border); border-radius: 5px; padding: 7px 8px; background: #fbfcfd; }
.cost .n { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
.cost .n.na { font-size: 12.5px; color: var(--crit); }
.cost .l { font-size: 10px; color: var(--muted); line-height: 1.3; margin-top: 2px; }

.slot {
  display: flex; align-items: center; gap: 9px; width: 100%; text-align: left;
  padding: 7px 9px; border: 1px solid var(--border); border-radius: 5px;
  margin-bottom: 6px; font-size: 12px; background: #fff;
}
.slot.on { border-color: var(--accent); background: var(--accent-soft); }
.slot:disabled { opacity: 0.6; background: #f4f5f7; }
.slot .radio {
  width: 12px; height: 12px; border-radius: 50%;
  border: 1.5px solid var(--border-strong); flex: none;
}
.slot.on .radio { border-color: var(--accent); border-width: 4px; }
.slot .eff { margin-left: auto; font-size: 11px; font-weight: 600; text-align: right; }
.slot .eff.bad { color: var(--crit); }
.slot .eff.good { color: var(--ok); }
.slot .eff.no { color: var(--faint); }

.treat { display: flex; gap: 6px; margin-bottom: 9px; }
.treat button {
  flex: 1; padding: 6px; border: 1px solid var(--border); border-radius: 5px;
  font-size: 11.5px; font-weight: 600; background: #fff; color: var(--text);
}
.treat button.on { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.treat button:disabled { opacity: 0.5; }
.blockedreason {
  font-size: 11.5px; color: var(--crit); background: var(--crit-soft);
  border: 1px solid #e8bdb9; border-radius: 5px; padding: 7px 9px; margin-bottom: 9px;
}
.field { margin-bottom: 7px; }
.field label { display: block; font-size: 11px; color: var(--muted); margin-bottom: 3px; }
.field .req { font-size: 10px; color: var(--crit); font-weight: 700; }
.field input, .field textarea, .field select {
  width: 100%; border: 1px solid var(--border-strong); border-radius: 5px;
  padding: 6px 8px; font: inherit; font-size: 12px; background: #fff; color: var(--text);
}
.field textarea { resize: vertical; min-height: 48px; }
.missing { font-size: 11.5px; color: var(--crit); margin-bottom: 8px; }
.actions { display: flex; gap: 8px; margin-top: 11px; }
.actions button { font-size: 12.5px; font-weight: 600; padding: 7px 14px; border-radius: 5px; }
.actions .primary { background: var(--accent); color: #fff; border: 1px solid var(--accent); }
.actions .primary:disabled { background: #f1f2f4; color: var(--faint); border-color: var(--border-strong); }
.actions .ghost { background: #fff; color: var(--muted); border: 1px solid var(--border-strong); }
```

- [ ] **Step 2: Write `src/ui/EvidenceBlock.tsx`**

```tsx
import { formatDay } from '../domain/clock'
import type { RecommendationView } from '../domain/recommendation'

export function EvidenceBlock({ recommendation }: { recommendation: RecommendationView }) {
  return (
    <div className="block">
      <div className="blocktitle">Observation</div>
      <dl className="kv">
        <dt>What was seen</dt>
        <dd>{recommendation.observation}</dd>
        <dt>Source</dt>
        <dd>
          {recommendation.source}{' '}
          <span className="src">· received {formatDay(recommendation.receivedOn)}</span>
        </dd>
        {recommendation.relevantDate !== null && (
          <>
            <dt>Relevant date</dt>
            <dd>{formatDay(recommendation.relevantDate)}</dd>
          </>
        )}
      </dl>
      {recommendation.verbatim !== null && (
        <div className="verbatim">{recommendation.verbatim}</div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Write `src/ui/AssumptionBlock.tsx`**

```tsx
import type { RecommendationView } from '../domain/recommendation'

export function AssumptionBlock({ recommendation }: { recommendation: RecommendationView }) {
  return (
    <div className="block">
      <div className="blocktitle">Assumption in play</div>
      {recommendation.assumption === null ? (
        <p>
          No assumption supports a waiting period here. The evidence establishes that something is
          wrong, not how long it can wait, so the proposed action is to assess rather than to predict.
        </p>
      ) : (
        <p>{recommendation.assumption}</p>
      )}
      <p style={{ color: 'var(--muted)' }}>
        <strong>Proposed:</strong> {recommendation.proposedAction}
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Write `src/ui/ConsequenceBlock.tsx`**

```tsx
import type { RecommendationView } from '../domain/recommendation'

export function ConsequenceBlock({ recommendation }: { recommendation: RecommendationView }) {
  const c = recommendation.consequence
  const coverUnavailable = c.coverCost === 'not available'

  return (
    <div className="block">
      <div className="blocktitle">
        Consequence of waiting <span className="synthetic">SYNTHETIC PRICES</span>
      </div>
      <p>{c.qualitative}</p>
      <div className="costs">
        <div className="cost">
          <div className="n">{c.serviceCost}</div>
          <div className="l">Service cost</div>
        </div>
        <div className="cost">
          <div className={`n${coverUnavailable ? ' na' : ''}`}>{c.coverCost}</div>
          <div className="l">Replacement cover</div>
        </div>
        <div className="cost">
          <div className="n" style={{ fontSize: '12.5px' }}>
            {c.disruption}
          </div>
          <div className="l">Operational disruption</div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Write `src/ui/SlotPicker.tsx`**

```tsx
import { computeDayCapacity, weekFixtureFor } from '../domain/capacity'
import { formatDay } from '../domain/clock'
import { slotOptions } from '../domain/feasibility'
import type { DraftDecision, ISODate, ItemId, OpenItem } from '../domain/types'
import { visitsFromDecisions } from '../domain/visits'
import { usePlan } from '../state/PlanProvider'
import { activeWeekId } from '../state/planReducer'

export function SlotPicker({
  item,
  decisions,
  selectedDate,
  onPick,
}: {
  item: OpenItem
  decisions: Record<ItemId, DraftDecision>
  selectedDate: ISODate | null
  onPick: (date: ISODate) => void
}) {
  const { state, fixture } = usePlan()
  const weekId = activeWeekId(state)
  const week = weekFixtureFor(fixture, weekId)
  const garage = fixture.garages.find((g) => g.id === item.garageId)?.name ?? item.garageId
  const options = slotOptions({ item, fixture, decisions, weekId })

  /** What picking this day would do to capacity, computed by actually trying it. */
  function effectOf(date: ISODate): { text: string; tone: string } {
    const trial = { ...decisions, [item.id]: { ...decisions[item.id], itemId: item.id, slotDate: date } }
    const visits = visitsFromDecisions(trial, fixture.items)
    const shortfalls = week.days.flatMap((day) =>
      (['standard', 'specialist'] as const)
        .map((vehicleClass) => computeDayCapacity({ date: day, vehicleClass, fixture, visits, week }))
        .filter((c) => c.shortfall > 0),
    )
    if (shortfalls.length === 0) return { text: 'Every day stays covered', tone: 'good' }
    const here = shortfalls.filter((s) => s.date === date)
    if (here.length > 0) return { text: `${formatDay(date)} short ${here[0].shortfall}`, tone: 'bad' }
    return { text: `Moves the shortfall to ${formatDay(shortfalls[0].date)}`, tone: 'bad' }
  }

  return (
    <div className="block">
      <div className="blocktitle">
        Slot · {garage} · {item.visitDays === 1 ? '1 day' : `${item.visitDays} days`}
      </div>
      {options.map((option) => {
        const effect = option.feasible
          ? effectOf(option.date)
          : { text: option.reasons.join('. '), tone: 'no' }
        return (
          <button
            key={option.date}
            className={`slot${selectedDate === option.date ? ' on' : ''}`}
            disabled={!option.feasible}
            onClick={() => onPick(option.date)}
            title={option.feasible ? undefined : option.reasons.join('. ')}
          >
            <span className="radio" />
            {formatDay(option.date)}
            <span className={`eff ${effect.tone}`}>{effect.text}</span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 6: Write `src/ui/TreatmentForm.tsx`**

```tsx
import { useState } from 'react'
import { deferralErrors } from '../domain/deferral'
import { watchAvailable, watchUnavailableReason } from '../domain/recommendation'
import type { Deferral, DraftDecision, OpenItem, TreatmentKind, Vehicle } from '../domain/types'

const TREATMENTS: Array<{ kind: TreatmentKind; label: string }> = [
  { kind: 'act-now', label: 'Act now' },
  { kind: 'bundle', label: 'Bundle' },
  { kind: 'watch', label: 'Watch' },
]

export function TreatmentForm({
  item,
  vehicle,
  decision,
  onChange,
}: {
  item: OpenItem
  vehicle: Vehicle
  decision: DraftDecision
  onChange: (d: DraftDecision) => void
}) {
  const allowWatch = watchAvailable(item, vehicle)
  const [draft, setDraft] = useState<Partial<Deferral>>(decision.deferral ?? {})
  const errors = deferralErrors(draft)
  const needsDeferral = decision.treatment === 'watch'
  const canApply = needsDeferral ? errors.length === 0 : decision.slotDate !== null

  function pick(kind: TreatmentKind) {
    if (kind === 'watch' && !allowWatch) return
    onChange({ ...decision, treatment: kind, slotDate: kind === 'watch' ? null : decision.slotDate })
  }

  function apply() {
    if (!canApply) return
    onChange({
      ...decision,
      deferral: needsDeferral ? (draft as Deferral) : null,
    })
  }

  return (
    <div className="block">
      <div className="blocktitle">Treatment</div>
      <div className="treat">
        {TREATMENTS.map((t) => (
          <button
            key={t.kind}
            className={decision.treatment === t.kind ? 'on' : ''}
            disabled={t.kind === 'watch' && !allowWatch}
            onClick={() => pick(t.kind)}
            title={t.kind === 'watch' && !allowWatch ? watchUnavailableReason() : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!allowWatch && <div className="blockedreason">{watchUnavailableReason()}</div>}

      {needsDeferral && (
        <>
          <div className="field">
            <label>
              Rationale <span className="req">required</span>
            </label>
            <textarea
              value={draft.reason ?? ''}
              onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
              placeholder="Why is waiting defensible on this evidence?"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="field">
              <label>
                Review date <span className="req">required</span>
              </label>
              <input
                type="date"
                value={draft.reviewDate ?? ''}
                onChange={(e) => setDraft({ ...draft, reviewDate: e.target.value })}
              />
            </div>
            <div className="field">
              <label>
                Trigger <span className="req">required</span>
              </label>
              <select
                value={draft.trigger?.kind === 'event' ? draft.trigger.eventId : ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    trigger:
                      e.target.value === ''
                        ? undefined
                        : {
                            kind: 'event',
                            eventId: e.target.value,
                            label: TRIGGER_LABELS[e.target.value] ?? e.target.value,
                          },
                  })
                }
              >
                <option value="">Choose a trigger</option>
                {Object.entries(TRIGGER_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {errors.length > 0 && <div className="missing">Missing: {errors.join('. ')}.</div>}
        </>
      )}

      <div className="actions">
        <button className="primary" onClick={apply} disabled={!canApply}>
          Apply to draft
        </button>
      </div>
    </div>
  )
}

/** Fixture-backed triggers. Only v041-dtc-recurs is scheduled to fire. [S 4.4] */
const TRIGGER_LABELS: Record<string, string> = {
  'v041-dtc-recurs': 'DTC P0300 recurs',
  'v027-wipe-degrades': 'Driver reports the wipe quality degrading',
}
```

- [ ] **Step 7: Write `src/ui/ItemDetail.tsx`**

```tsx
import { recommendationFor } from '../domain/recommendation'
import { urgencyLabel } from '../domain/urgency'
import type { DraftDecision, ItemId, OpenItem } from '../domain/types'
import { usePlan } from '../state/PlanProvider'
import { AssumptionBlock } from './AssumptionBlock'
import { ConsequenceBlock } from './ConsequenceBlock'
import { EvidenceBlock } from './EvidenceBlock'
import { SlotPicker } from './SlotPicker'
import { TreatmentForm } from './TreatmentForm'

export function ItemDetail({
  item,
  decisions,
  onChange,
}: {
  item: OpenItem
  decisions: Record<ItemId, DraftDecision>
  onChange: (d: DraftDecision) => void
}) {
  const { fixture } = usePlan()
  const vehicle = fixture.vehicles.find((v) => v.id === item.vehicleId)!
  const recommendation = recommendationFor(item)
  const decision = decisions[item.id] ?? {
    itemId: item.id,
    treatment: null,
    slotDate: null,
    deferral: null,
  }

  return (
    <div className="detail">
      <div className="head">
        <span className="vid" style={{ fontSize: 15 }}>
          {item.vehicleId}
        </span>
        <span className={`urg ${item.urgency.kind}`}>{urgencyLabel(item.urgency.kind)}</span>
        {vehicle.vehicleClass === 'specialist' && <span className="badge specialist">Specialist</span>}
      </div>
      <div className="sub">
        {item.title} · {vehicle.vehicleClass} class
      </div>

      <EvidenceBlock recommendation={recommendation} />
      <AssumptionBlock recommendation={recommendation} />
      <ConsequenceBlock recommendation={recommendation} />

      {decision.treatment !== 'watch' && (
        <SlotPicker
          item={item}
          decisions={decisions}
          selectedDate={decision.slotDate}
          onPick={(date) => onChange({ ...decision, slotDate: date })}
        />
      )}

      <TreatmentForm item={item} vehicle={vehicle} decision={decision} onChange={onChange} />
    </div>
  )
}
```

- [ ] **Step 8: Mount it in `src/App.tsx`**

Replace the right pane contents with:

```tsx
<div className="pane right">
  {selectedItem === null ? (
    <p className="empty">Select an item to see its evidence and options.</p>
  ) : (
    <ItemDetail
      key={selectedItem.id}
      item={selectedItem}
      decisions={decisions}
      onChange={(decision) => dispatch({ type: 'set-decision', weekId, decision })}
    />
  )}
</div>
```

Add above the `return`:

```tsx
const selectedItem = fixture.items.find((i) => i.id === selectedItemId) ?? null
```

and add the import `import { ItemDetail } from './ui/ItemDetail'`.

- [ ] **Step 9: Verify manually**

Run: `npm run dev`

Confirm each of these:
1. Selecting `V-118` shows Observation, Assumption in play, Consequence of waiting, Slot and Treatment blocks.
2. The Consequence block shows three separate figures, with a `SYNTHETIC PRICES` chip.
3. The slot list shows Mon disabled with `Werkstatt Berg is fully booked on Mon 28 Sep`, Tue selected reading `Tue 29 Sep short 1`, Wed reading `Moves the shortfall to Wed 30 Sep`, Thu reading `Every day stays covered`.
4. Clicking Thu recalculates the band **in view**: Tuesday's red clears and Thursday's green spare disappears.
5. Selecting `V-041` shows `Assessment needed`, no relevant date, and Replacement cover reading `not available` in red, **not** `EUR 0`.
6. Picking any slot for `V-041` turns a Specialist cell red in the band.
7. Selecting `V-012` shows `Bundle` and `Watch` **disabled**, with a red box explaining the UVV hard stop.
8. Choosing `Watch` on `V-041` reveals rationale, review date and trigger, with `Apply to draft` disabled and a red `Missing: ...` line naming each empty field.
9. Filling all three enables `Apply to draft`; clicking it makes the card read `Watch until ...`.
10. Selecting `V-027` shows the driver's German wording verbatim in an italic quote block.

- [ ] **Step 10: Confirm the domain still passes**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: PASS, no type errors, `dist/` produced.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add the item detail panel

Every item renders the same five-part contract, so a recommendation
can always be interrogated: what was seen and from where, the
relevant date where one exists, the assumption in play, the proposed
action, and the consequence of waiting.

The three consequence figures stay visually separate, and cover reads
'not available' in red rather than zero where none is compatible.

Constraints are shown rather than hidden. Unbookable slots are
disabled with their reason, watch is disabled with the UVV reason on
the hard-stop item, and an incomplete deferral names each missing
field instead of silently refusing."
```

---

## Task 14: Commit summary and daily confirmation

**Files:**
- Create: `src/ui/CommitSummary.tsx`, `src/ui/DailyConfirmation.tsx`
- Modify: `src/ui/theme.css` (append summary styles)
- Modify: `src/App.tsx` (add the view mode)

**Interfaces:**
- Consumes: `summaryFor`, `dailyConfirmation` from `../domain/commit`.
- Produces: `CommitSummary({ onEdit })`, `DailyConfirmation({ plan })`.

The band stays. Below it, the queue and detail split is **replaced** by the summary, which is the third of the three below-band states in [S §6.2]. The daily confirmation is a static section inside the summary, not a view of its own.

- [ ] **Step 1: Append the summary styles to `src/ui/theme.css`**

```css
.summary { padding: 14px 18px 28px; }
.summary h2 { font-size: 14px; margin: 0 0 3px; }
.summary .lead { font-size: 12.5px; color: var(--muted); margin: 0 0 14px; }
.summary section { margin-bottom: 16px; }
.summary section > h3 {
  font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--faint); margin: 0 0 7px;
}
.summary .row {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--r);
  padding: 9px 11px; margin-bottom: 6px; font-size: 12.5px;
}
.summary .row .meta { color: var(--muted); font-size: 11.5px; margin-top: 3px; }
.summary ul { margin: 0; padding-left: 18px; font-size: 12.5px; color: var(--muted); }
.summary ul li { margin-bottom: 3px; }
.summary .avail { display: grid; grid-template-columns: repeat(5, 1fr); gap: 7px; }
.summary .avail .d {
  border: 1px solid var(--border); border-radius: var(--r);
  background: var(--surface); padding: 7px 8px; font-size: 12px;
}
.summary .avail .d .n { font-variant-numeric: tabular-nums; font-weight: 600; }
.summary .avail .d .lbl {
  font-size: 10.5px; font-weight: 700; text-transform: uppercase;
  color: var(--faint); margin-bottom: 4px;
}
.summary .sim {
  background: var(--warn-soft); border: 1px solid #ecd5a6; border-radius: var(--r);
  padding: 9px 11px; font-size: 12px; color: #7a5a12; margin-bottom: 14px;
}
```

- [ ] **Step 2: Write `src/ui/DailyConfirmation.tsx`**

```tsx
import { addDays } from '../domain/clock'
import { dailyConfirmation } from '../domain/commit'
import type { CommittedPlan } from '../domain/types'
import { usePlan } from '../state/PlanProvider'

export function DailyConfirmation({ plan }: { plan: CommittedPlan }) {
  const { state, fixture } = usePlan()
  const tomorrow = addDays(state.demoDate, 1)
  const view = dailyConfirmation({ fixture, plan, forDate: tomorrow })

  return (
    <section>
      <h3>Daily confirmation · {view.dateLabel}</h3>
      <div className="row">
        {view.rows.map((r) => (
          <div key={r.vehicleClass}>
            <span className="n">
              {r.available} / {r.demand}
            </span>{' '}
            {r.vehicleClass} assignments covered
            {r.shortfall > 0 && <strong style={{ color: 'var(--crit)' }}> · short {r.shortfall}</strong>}
          </div>
        ))}
        <div className="meta">
          {view.coverInUse.length > 0
            ? `Cover in use: ${view.coverInUse.join(', ')}.`
            : 'No replacement cover in use.'}
        </div>
      </div>
      {view.offRoad.length > 0 && (
        <ul>
          {view.offRoad.map((o) => (
            <li key={o.vehicleId}>
              <strong>{o.vehicleId}</strong> off the road. {o.reason}.
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 3: Write `src/ui/CommitSummary.tsx`**

```tsx
import { formatDay } from '../domain/clock'
import { summaryFor } from '../domain/commit'
import { usePlan } from '../state/PlanProvider'
import { activeWeekId } from '../state/planReducer'
import { DailyConfirmation } from './DailyConfirmation'

export function CommitSummary({ onEdit }: { onEdit: () => void }) {
  const { state, fixture } = usePlan()
  const plan = state.committedByWeek[activeWeekId(state)] ?? null
  if (plan === null) return null
  const summary = summaryFor({ fixture, plan })

  return (
    <div className="summary">
      <h2>Week plan committed</h2>
      <p className="lead">Committed {formatDay(summary.committedOn)}.</p>

      <div className="sim">
        Simulated commitment. The fixture guarantees these slots and confirms them with the plan.
        Nothing was sent to a garage, and no external booking exists.
      </div>

      <section>
        <h3>Confirmed visits · {summary.visits.length}</h3>
        {summary.visits.map((v) => (
          <div className="row" key={v.itemId}>
            <strong>{v.vehicleId}</strong> · {v.scope}
            <div className="meta">
              {v.garage}, {v.dateLabel}, {v.days === 1 ? '1 day' : `${v.days} days`}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h3>Forward availability</h3>
        <div className="avail">
          {[...new Set(summary.availability.map((a) => a.date))].map((date) => (
            <div className="d" key={date}>
              <div className="lbl">{formatDay(date)}</div>
              {summary.availability
                .filter((a) => a.date === date)
                .map((a) => (
                  <div key={a.vehicleClass}>
                    <span className="n">
                      {a.available} / {a.demand}
                    </span>{' '}
                    {a.vehicleClass}
                  </div>
                ))}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3>Cover assumptions</h3>
        <ul>
          {summary.coverAssumptions.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Deferred follow-ups · {summary.deferrals.length}</h3>
        {summary.deferrals.length === 0 && <p className="lead">Nothing was deferred this week.</p>}
        {summary.deferrals.map((d) => (
          <div className="row" key={d.itemId}>
            <strong>{d.vehicleId}</strong> · {d.title}
            <div className="meta">{d.reason}</div>
            <div className="meta">
              Review {formatDay(d.reviewDate)}, or sooner if the trigger fires: {d.triggerLabel}.
            </div>
          </div>
        ))}
      </section>

      {summary.holds.length > 0 && (
        <section>
          <h3>Still held out of service</h3>
          {summary.holds.map((h) => (
            <div className="row" key={h.vehicleId}>
              <strong>{h.vehicleId}</strong>
              <div className="meta">{h.reason}.</div>
              <div className="meta">
                {h.releaseRecordedOn === null
                  ? 'No release recorded. The van stays out of service.'
                  : `Release recorded for ${formatDay(h.releaseRecordedOn)}, after repair and UVV re-inspection. Booking a visit does not release it.`}
              </div>
            </div>
          ))}
        </section>
      )}

      <DailyConfirmation plan={plan} />

      <div className="actions">
        <button className="ghost" onClick={onEdit}>
          Edit plan
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add the view mode to `src/App.tsx`**

Add near the other state:

```tsx
const [view, setView] = useState<'planning' | 'summary'>('planning')
```

Change the commit handler so it switches view:

```tsx
onCommit={() => {
  dispatch({ type: 'commit', weekId })
  setView('summary')
}}
```

Wrap the split so the summary replaces it:

```tsx
{view === 'summary' && state.committedByWeek[weekId] ? (
  <CommitSummary onEdit={() => setView('planning')} />
) : (
  <div className="split">
    {/* the existing DecisionQueue and right pane, unchanged */}
  </div>
)}
```

Add `import { CommitSummary } from './ui/CommitSummary'`.

Changing the week must drop you back into planning. Add:

```tsx
useEffect(() => {
  setView('planning')
  setSelectedItemId(null)
}, [weekId])
```

and add `useEffect` to the React import.

- [ ] **Step 5: Verify manually**

Run: `npm run dev`

Confirm each of these:
1. Move `V-118` to Thursday, defer `V-041` with all three fields, then `Commit plan` becomes enabled.
2. Clicking it replaces the queue and detail with the summary, and **the capacity band stays visible**.
3. The summary lists three confirmed visits, forward availability with no shortfall, the cover assumptions including `No specialist cover is available this week`, and two deferred follow-ups.
4. `Still held out of service` lists `V-012` and states that booking a visit does not release it.
5. The daily confirmation shows tomorrow, with `V-012` and `V-103` off the road and their reasons.
6. The simulation notice is visible and says nothing was sent.
7. `Edit plan` returns to planning with your decisions intact.
8. Clicking `Commit plan` a second time produces the same three visits, with no duplicates.
9. Reloading the page keeps the committed plan.

- [ ] **Step 6: Confirm the domain still passes**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: PASS, no type errors, `dist/` produced.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add the commit summary and daily confirmation

The summary replaces the queue below the band rather than opening a
new screen, so the week's capacity stays in view alongside its
outcome.

It states the cover assumptions in full, including the absence of
specialist cover, names the outstanding hold, and says plainly that
booking a visit does not release it. The commitment is labelled
simulated rather than presented as a completed external booking.

The daily confirmation is a read-only projection of the committed
decisions. Route reassignment is deliberately not offered: with no
reserve vehicles it cannot create capacity."
```

---

## Task 15: The ten verification scenarios

**Files:**
- Create: `src/domain/scenarios.test.ts`

**Interfaces:**
- Consumes: the whole domain plus `planReducer`, `initialState`, `queueFor`, `draftFor`.
- Produces: nothing. This task exists to turn [WP §9] into evidence.

Earlier tasks tested modules in isolation. This suite walks the seeded journey end to end, which is what G6's repeatability claim rests on.

- [ ] **Step 1: Write the scenario suite**

Create `src/domain/scenarios.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { computeDayCapacity, unavailableOn, weekFixtureFor } from './capacity'
import { commitPlan, summaryFor } from './commit'
import { fixture } from './fixture'
import { slotBlockers } from './feasibility'
import { watchAvailable } from './recommendation'
import { canCommit, validatePlan } from './validation'
import { visitsFromDecisions } from './visits'
import { initialState, planReducer, queueFor, draftFor, type AppState } from '../state/planReducer'
import type { DraftDecision, ItemId } from './types'

const WEEK_40 = '2026-09-28'
const reduce = (s: AppState, a: Parameters<typeof planReducer>[1]) => planReducer(s, a, fixture)
const item = (id: string) => fixture.items.find((i) => i.id === id)!
const vehicle = (id: string) => fixture.vehicles.find((v) => v.id === id)!
const draftOf = (s: AppState) => draftFor({ fixture, state: s, weekId: WEEK_40 })
const validate = (d: Record<ItemId, DraftDecision>) => validatePlan({ fixture, weekId: WEEK_40, decisions: d })

const V041_DEFERRAL = {
  reason: 'No specialist cover exists this week, and the code has not recurred since 17 Sep.',
  reviewDate: '2026-10-05',
  trigger: { kind: 'event' as const, eventId: 'v041-dtc-recurs', label: 'DTC P0300 recurs' },
}

function resolvedState(): AppState {
  let s = initialState(fixture)
  s = reduce(s, {
    type: 'set-decision',
    weekId: WEEK_40,
    decision: { itemId: 'item-v118', treatment: 'act-now', slotDate: '2026-10-01', deferral: null },
  })
  return reduce(s, {
    type: 'set-decision',
    weekId: WEEK_40,
    decision: { itemId: 'item-v041', treatment: 'watch', slotDate: null, deferral: V041_DEFERRAL },
  })
}

describe('1. Known safety-class issue at cold open', () => {
  it('holds V-012 before anything is committed, with no interruption UI involved', () => {
    const s = initialState(fixture)
    expect(s.committedByWeek[WEEK_40] ?? null).toBeNull()
    expect(unavailableOn('2026-09-28', fixture.vehicles, []).has('V-012')).toBe(true)
  })

  it('withholds watch, and a booked visit does not release the hold', () => {
    expect(watchAvailable(item('item-v012'), vehicle('V-012'))).toBe(false)
    const visits = visitsFromDecisions(draftOf(initialState(fixture)), fixture.items)
    expect(unavailableOn('2026-09-30', fixture.vehicles, visits).has('V-012')).toBe(true)
  })
})

describe('2. Justified routine deferral', () => {
  it('records reason, review date and trigger for V-027 without forcing service', () => {
    const d = draftOf(initialState(fixture))['item-v027']
    expect(d.treatment).toBe('watch')
    expect(d.deferral!.reason.length).toBeGreaterThan(10)
    expect(d.deferral!.reviewDate).toBe('2026-11-02')
    expect(d.deferral!.trigger).toBeDefined()
    expect(d.slotDate).toBeNull()
  })

  it('is never overturned by the fixture', () => {
    const s = reduce(resolvedState(), { type: 'commit', weekId: WEEK_40 })
    const far = reduce(s, { type: 'advance-days', days: 21 })
    expect(queueFor({ fixture, state: far, weekId: '2026-10-19' }).some((q) => q.item.id === 'item-v027')).toBe(false)
  })
})

describe('3. Tight day with a feasible alternative', () => {
  it('clears the shortfall and enables commit when V-118 moves to Thursday', () => {
    const before = validate(draftOf(initialState(fixture)))
    expect(before.some((b) => b.kind === 'capacity-shortfall')).toBe(true)
    const after = validate(draftOf(resolvedState()))
    expect(after).toEqual([])
    expect(canCommit(after)).toBe(true)
  })
})

describe('4. Aggregate capacity hides a specialist gap', () => {
  it('flags a specialist shortfall that standard cover cannot erase', () => {
    const s = reduce(resolvedState(), {
      type: 'set-decision',
      weekId: WEEK_40,
      decision: { itemId: 'item-v041', treatment: 'act-now', slotDate: '2026-10-01', deferral: null },
    })
    const blockers = validate(draftOf(s))
    const spec = blockers.find((b) => b.kind === 'capacity-shortfall' && b.vehicleClass === 'specialist')
    expect(spec).toBeDefined()

    // The aggregate over both classes still looks healthy.
    const week = weekFixtureFor(fixture, WEEK_40)
    const visits = visitsFromDecisions(draftOf(s), fixture.items)
    const std = computeDayCapacity({ date: '2026-10-01', vehicleClass: 'standard', fixture, visits, week })
    const sp = computeDayCapacity({ date: '2026-10-01', vehicleClass: 'specialist', fixture, visits, week })
    expect(std.available + sp.available).toBeGreaterThanOrEqual(std.demand + sp.demand)
    expect(sp.shortfall).toBe(1)
    expect(sp.cover).toBe(0)
  })
})

describe('5. Multi-day visit overlaps an existing hold', () => {
  it('counts every affected day, each vehicle once, without implying a release', () => {
    const items = fixture.items.map((i) => (i.id === 'item-v103' ? { ...i, visitDays: 2 } : i))
    const visits = visitsFromDecisions(draftOf(resolvedState()), items)
    const week = weekFixtureFor(fixture, WEEK_40)
    const wed = computeDayCapacity({ date: '2026-09-30', vehicleClass: 'standard', fixture, visits, week })
    expect(wed.unavailable.sort()).toEqual(['V-012', 'V-103'])
    expect(wed.shortfall).toBe(1)
    expect(unavailableOn('2026-09-30', fixture.vehicles, visits).has('V-012')).toBe(true)
  })
})

describe('6. Slot or part unavailable', () => {
  it('refuses Monday for V-012 and names both reasons', () => {
    const blockers = slotBlockers({ item: item('item-v012'), date: '2026-09-28', fixture, visits: [] })
    expect(blockers.map((b) => b.kind).sort()).toEqual(['infeasible-slot', 'parts-not-ready'])
  })

  it('keeps the plan uncommittable while an infeasible slot is chosen', () => {
    const s = reduce(resolvedState(), {
      type: 'set-decision',
      weekId: WEEK_40,
      decision: { itemId: 'item-v118', treatment: 'act-now', slotDate: '2026-09-28', deferral: null },
    })
    expect(canCommit(validate(draftOf(s)))).toBe(false)
  })
})

describe('7. Evidence insufficient', () => {
  it('shows assessment-needed rather than an invented waiting period', () => {
    expect(item('item-v041').urgency.kind).toBe('assessment-needed')
    expect(item('item-v041').urgency.relevantDate).toBeNull()
    expect(item('item-v041').assumption).toBeNull()
  })
})

describe('8. Review date arrives or trigger fires', () => {
  it('returns V-041 with its earlier decision and rationale intact', () => {
    const committed = reduce(resolvedState(), { type: 'commit', weekId: WEEK_40 })
    const advanced = reduce(committed, { type: 'advance-to-next-review' })
    expect(advanced.demoDate).toBe('2026-10-05')
    const queue = queueFor({ fixture, state: advanced, weekId: '2026-10-05' })
    expect(queue.map((q) => q.item.id)).toEqual(['item-v041'])
    expect(queue[0].priorDecision!.deferral.reason).toContain('No specialist cover')
    expect(queue[0].resurfacedBecause).toContain('Review date')
  })
})

describe('9. No feasible plan exists', () => {
  it('keeps the draft recoverable, shows the shortage, and claims no readiness', () => {
    const s = reduce(resolvedState(), {
      type: 'set-decision',
      weekId: WEEK_40,
      decision: { itemId: 'item-v041', treatment: 'act-now', slotDate: '2026-09-30', deferral: null },
    })
    const blockers = validate(draftOf(s))
    expect(canCommit(blockers)).toBe(false)
    expect(blockers.some((b) => b.kind === 'capacity-shortfall')).toBe(true)
    // The draft survives the failed state.
    expect(draftOf(s)['item-v041'].slotDate).toBe('2026-09-30')
    expect(draftOf(s)['item-v118'].slotDate).toBe('2026-10-01')
  })
})

describe('10. Commit, edit, recommit, reload, reset', () => {
  it('matches the summary to the committed decisions', () => {
    const s = reduce(resolvedState(), { type: 'commit', weekId: WEEK_40 })
    const summary = summaryFor({ fixture, plan: s.committedByWeek[WEEK_40]! })
    expect(summary.visits.map((v) => v.itemId).sort()).toEqual(['item-v012', 'item-v103', 'item-v118'])
    expect(summary.deferrals.map((d) => d.itemId).sort()).toEqual(['item-v027', 'item-v041'])
  })

  it('produces no duplicates on recommit', () => {
    let s = reduce(resolvedState(), { type: 'commit', weekId: WEEK_40 })
    s = reduce(s, { type: 'commit', weekId: WEEK_40 })
    s = reduce(s, { type: 'commit', weekId: WEEK_40 })
    const summary = summaryFor({ fixture, plan: s.committedByWeek[WEEK_40]! })
    expect(summary.visits).toHaveLength(3)
    expect(s.deferralHistory['item-v041']).toHaveLength(1)
  })

  it('leaves the snapshot intact while the draft is edited, until recommit', () => {
    const committed = reduce(resolvedState(), { type: 'commit', weekId: WEEK_40 })
    const edited = reduce(committed, {
      type: 'set-decision',
      weekId: WEEK_40,
      decision: { itemId: 'item-v118', treatment: 'act-now', slotDate: '2026-09-30', deferral: null },
    })
    expect(edited.committedByWeek[WEEK_40]!.decisions['item-v118'].slotDate).toBe('2026-10-01')
    const recommitted = reduce(edited, { type: 'commit', weekId: WEEK_40 })
    expect(recommitted.committedByWeek[WEEK_40]!.decisions['item-v118'].slotDate).toBe('2026-09-30')
  })

  it('survives a serialisation round trip, which is what reload does', () => {
    const s = reduce(resolvedState(), { type: 'commit', weekId: WEEK_40 })
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
  })

  it('restores the seed on reset', () => {
    const s = reduce(resolvedState(), { type: 'commit', weekId: WEEK_40 })
    expect(reduce(s, { type: 'reset' })).toEqual(initialState(fixture))
  })
})
```

- [ ] **Step 2: Run the suite**

Run: `npm test -- scenarios`
Expected: PASS, 17 tests across the ten scenarios.

If any fail, the defect is in the domain, not the test. Fix the module and re-run.

- [ ] **Step 3: Run everything**

Run: `npm test`
Expected: PASS, every test from Tasks 1 to 15.

- [ ] **Step 4: Commit**

```bash
git add src/domain/scenarios.test.ts
git commit -m "test: assert the ten verification scenarios end to end

Earlier suites test modules in isolation. This one walks the seeded
journey: the hard stop at cold open, the defensible deferral, the
solvable Tuesday conflict, the specialist gap an aggregate count
hides, the multi-day overlap, both slot blockers, the
assessment-needed state, resurfacing on the review date, the plan
with no feasible answer, and the commit and recommit cycle.

This is what the repeatability claim rests on, so it is evidence
rather than assertion."
```

---

## Task 16: Handoff, acceptance record and the static build

**Files:**
- Create: `README.md`
- Create: `docs/acceptance.md`
- Modify: `.gitignore` (confirm `dist/` is ignored)

**Interfaces:**
- Consumes: the finished application.
- Produces: the G6 handoff artefacts.

G6 requires the handoff to state the launch path, the simulated integrations, the limitations, the decisions taken, the alternatives rejected and the next step. Every one of those is written here, not left implied.

- [ ] **Step 1: Run the walkthrough and record what actually happens**

Run: `npm run dev`, then walk the seven steps from [S §7.3] once, start to finish, from a reset state. Note anything that does not behave as the spec says. Fix defects before writing the acceptance record. Do not write a result you did not observe.

1. Cold open: five items, two named blockers, `V-012` already held
2. Open `V-118`, see Tuesday go red, switch to Thursday, watch Tuesday clear in the band
3. Open `V-041`, schedule it, watch the specialist row break while the aggregate looks healthy
4. Defer `V-041` with reason, review date and trigger; the second blocker clears
5. Accept the proposed watch on `V-027`; confirm `bundle` and `watch` are disabled on `V-012`
6. Commit; check the summary
7. Advance the clock to Monday 5 October; `V-041` resurfaces with its rationale; reset

- [ ] **Step 2: Write `docs/acceptance.md`**

Fill in the real results from Step 1. The template below shows the expected shape. Change any `passed` to `failed` or `not run` where that is what happened, and keep the stated limitations.

```markdown
# Acceptance record

**Run on:** <the date you ran it>
**Build:** <output of `git rev-parse --short HEAD`>
**Command:** `npm test` and a manual walkthrough of section 7.3 of the design spec.

## Goals

- **G1, make attention understandable.** Result: <passed / failed / not run>. **Limitation: this was a
  self-run walkthrough, not an observed one.** Section 2 of the work packages is explicit that a
  self-run walkthrough cannot be recorded as an observed result, so the one-minute claim is untested
  against someone unfamiliar with the build.
- **G2, support acting and waiting.** Result: <...>. Evidence: scenarios 2 and 7 in `scenarios.test.ts`,
  plus the walkthrough, which contains one warranted intervention (`V-118`) and one warranted deferral
  (`V-027`).
- **G3, keep choices feasible.** Result: <...>. Evidence: scenarios 3, 4, 5 and 6.
- **G4, preserve the decision.** Result: <...>. Evidence: scenario 8.
- **G5, finish the primary journey.** Result: <...>. Time taken: <...>. **Same self-run limitation as G1.**
- **G6, deliver a repeatable prototype.** Result: <...>. Evidence: scenario 10, plus a fresh launch,
  a reload and two consecutive walkthroughs.

## Verification scenarios

Record each of the ten from section 9 of the work packages as passed, failed or not run, with the
`scenarios.test.ts` describe block that covers it.

## Known limitations

1. Week 41 and later contain only resurfaced items. No new work is authored for them.
2. The usability walkthrough was self-run, so G1 and G5 have no observed evidence.
3. Commit is simulated and fixture-guaranteed. Real-world rejection and pending confirmation are not modelled.
4. The safety hard stop is a chosen product rule, not a verified legal implementation of UVV.
5. All prices are scenario prices, not market data.
6. No component tests exist. The UI was verified by hand.
```

- [ ] **Step 3: Write `README.md`**

```markdown
# Fleet maintenance: weekly planning prototype

A working prototype for the MARKT-PILOT Product Builder Challenge.

**The user.** The part-time Fuhrparkverantwortliche at one depot of 45 vans. Fleet is a fraction of
their job, they carry personal liability under UVV, and they can pull a vehicle from service.

**The problem.** Decide what to service this week and what can reasonably wait, while seeing what that
decision does to work already committed.

**The promise.** Make this week's maintenance plan, understand the trade-offs, and leave nothing
deferred without a reason and a follow-up.

## Running it

```bash
npm install
npm run dev     # then open the printed URL
```

To produce the static bundle:

```bash
npm run build   # writes dist/, which can be opened directly from the filesystem
```

To run the tests:

```bash
npm test
```

No backend, no network calls, no accounts, no configuration. State is kept in `localStorage` under
`fleet-maintenance-prototype/v1`, and the yellow demo bar has a reset control.

## The five-minute walkthrough

1. The plan opens on week 40 with five decisions and two blockers. `V-012` is already out of service,
   before anything is committed.
2. Open `V-118`. Tuesday is red because of it. Switch the slot to Thursday and watch Tuesday clear in
   the band above. Try Wednesday instead to see a shortage relocate rather than resolve.
3. Open `V-041` and schedule it. The specialist row breaks while the aggregate still looks healthy.
   No lever closes it: a standard rental is not a specialist van.
4. Defer `V-041` with a reason, a review date and a trigger. The second blocker clears.
5. Look at `V-012`. Bundle and watch are disabled, with the UVV reason shown rather than hidden.
6. Commit. The summary carries the visits, forward availability, the cover assumptions including the
   absence of specialist cover, and the deferred follow-ups.
7. Advance the clock to the next review date. `V-041` returns with its rationale intact.

## What is simulated

Everything outside the depot. Vehicle data, telematics, inspection findings, garage slots, parts lead
times, rental cover and prices are all fixtures, labelled in the UI. Commit is a simulated commitment:
the fixture guarantees the selected slots and confirms them with the plan. **Nothing is sent anywhere,
and no external booking exists.** Prices are scenario prices.

## Decisions taken

- **One user, one depot, one week, one entry point.** The weekly ritual is the only journey built.
- **Capacity is computed per class, not in aggregate.** An aggregate count reads healthy while the only
  compatible specialist van is off the road. `V-041` exists to make that visible.
- **Urgency is three states, never a score.** A known deadline, an estimate with its assumption named,
  or an unknown condition that reads `assessment needed`. No number is invented where the evidence
  supports none.
- **The three cost figures stay apart.** Service cost, replacement cover and operational disruption are
  never blended. Disruption stays a count of uncovered assignments rather than becoming money, because
  turning it into euros needs a revenue-per-route figure the fixture cannot support.
- **Deferral is a record, not a gut call.** Reason, review date and trigger are all required, and the
  item comes back carrying them.
- **A blocked plan is a legitimate outcome.** The draft survives and the blocker is named. The UI never
  claims readiness it does not have.
- **Decisions are stored, everything else is derived.** Capacity, visits, blockers and the summary are
  all computed. That is why recommitting cannot duplicate a visit and why a held van with a booked
  visit is never subtracted twice.

## Alternatives rejected

- **Predictive failure modelling.** A black box fails the "help the user understand what deserves
  attention" test, especially for a user carrying personal liability. The structured recommendation is
  the alternative.
- **A separate interruption screen.** An event arriving is a change to the existing plan, not a second
  workflow. Out of scope here, and described rather than built.
- **Route reassignment as a lever.** With no reserve vehicles it cannot create capacity, so offering it
  would suggest a lever that does not work. The daily confirmation is read-only.
- **A detail panel over the capacity view.** It hid capacity during the one interaction that changes it.
  Both layouts are in `docs/mockups/` if you want to compare.
- **A "fire trigger now" button.** It has no real-world analogue. Advancing the clock fires both
  odometer and event triggers instead.

## Limitations

1. Week 41 and later carry only resurfaced items. No new work is authored for them.
2. The usability walkthrough was self-run, not observed, so G1 and G5 have no independent evidence. See
   `docs/acceptance.md`.
3. Real-world booking rejection and pending confirmation are not modelled.
4. The safety hard stop is a chosen product rule, not a verified legal implementation of UVV.
5. No component tests. The domain layer is tested; the UI was verified by hand.

## What I would build next

1. **The interruption as a diff on this plan.** A driver report or a garage scope change arrives, opens
   this same surface with the change highlighted, and asks one question: does this change the plan? The
   fixture already carries the event, `V-103` extending to a second day, which reproduces a Wednesday
   shortage because `R-2` does not cover Wednesday.
2. **Bundle versus split, shown honestly.** One longer visit against two shorter ones, with the risk
   that missing parts or newly found defects extend the stay. The product must not silently stack
   everything onto one visit.
3. **Pending rather than guaranteed booking.** The honest production model, where a garage can decline
   and the summary has to say *pending* rather than promising confirmed availability.

## Where the thinking lives

- `docs/fleet-maintenance-work-packages.md`: the build contract, scope and goals
- `docs/superpowers/specs/2026-09-23-fleet-maintenance-prototype-design.md`: the technical design
- `docs/fleet-maintenance-research-findings.md`: research and framing
- `docs/mockups/`: the two layouts the layout decision was made from
- `docs/acceptance.md`: what was verified, and what was not
```

- [ ] **Step 4: Verify the static bundle actually opens from the filesystem**

```bash
npm run build
open dist/index.html   # on macOS
```

Confirm the app loads with no console errors and the capacity band renders. If assets 404, check that
`base: './'` is still set in `vite.config.ts`.

- [ ] **Step 5: Verify a clean checkout works**

```bash
git status --short          # expect no untracked source files
grep -n 'dist' .gitignore   # expect dist/ to be ignored
npm test
```

- [ ] **Step 6: Run the walkthrough twice consecutively**

G6 requires two consecutive walkthroughs to behave consistently. Run the seven steps, hit `Reset
scenario`, and run them again. Confirm the second run is identical to the first.

- [ ] **Step 7: Commit**

```bash
git add README.md docs/acceptance.md .gitignore
git commit -m "docs: add the handoff, acceptance record and launch path

The README states what the prototype is, how to run it, what is
simulated, the decisions taken, the alternatives rejected, the
limitations and what would come next.

The acceptance record reports each goal as passed, failed or not run
with its evidence. G1 and G5 are recorded as self-run rather than
observed, which is a weaker claim than an observed walkthrough and is
stated as such rather than glossed."
```

---

## Self-review

Run against the spec after Task 16.

**Spec coverage.** Every section of the design spec maps to a task:

- S §1 constraints: Task 1 (stack, Vitest), Task 16 (delivery)
- S §2.2 derive-everything, idempotency, set-based dedup: Tasks 3, 8
- S §2.3 three decision layers: Tasks 1, 9
- S §2.4 clock as a parameter: Task 2, enforced by the global constraint
- S §2.5 module layout: Tasks 1 to 14
- S §3.1 capacity formula: Task 3
- S §3.2 three urgency states: Tasks 1, 5
- S §3.3 recommendation contract: Task 5
- S §3.4 three separate figures, cover not-available rule: Task 5, rendered in Task 13
- S §3.5 safety hard stop: Tasks 1, 3, 5, rendered disabled in Task 13
- S §3.6 deferral and clock-driven triggers: Tasks 6, 9
- S §3.7 plan week follows the clock, two authored weeks plus fallback: Tasks 3, 9
- S §3.8 four blockers, all reasons returned: Tasks 4, 7
- S §3.9 commit semantics: Task 8
- S §4 the whole fixture: Task 1, arithmetic verified in Task 3
- S §5 state shape and persistence with the version guard: Task 9
- S §6.1 chosen layout: Tasks 11, 12, 13
- S §6.2 three states below the band: Tasks 12, 14
- S §6.3 component to package mapping: Tasks 10 to 14
- S §6.4 queue ordering: Task 5, **with a correction to the spec applied in Task 5 Step 7**
- S §6.5 failure behaviour never a dialog: Tasks 10, 13
- S §7.1 the ten scenarios: Task 15
- S §7.2 self-run walkthrough recorded honestly: Task 16
- S §8 delivery and stated limitations: Task 16

**Placeholder scan.** No task contains TBD, TODO, "implement later", "add appropriate error handling",
"write tests for the above", or "similar to Task N". Every code step carries its code. The one
deliberately templated artefact is `docs/acceptance.md`, whose angle-bracket fields must be filled with
observed results, and Task 16 Step 1 says so explicitly.

**Type consistency.** Checked across tasks: `DraftDecision` is used with the same four fields
throughout; `Blocker` is the same four-variant union in Tasks 4, 7, 12 and 13; `weekFixtureFor` has one
signature in Tasks 3, 4, 7, 8, 11 and 13; `visitsFromDecisions` takes `(decisions, items)` everywhere;
`slotBlockers` takes the same four-key object in Tasks 4, 7 and 15; `recommendationFor` returns
`RecommendationView` consumed unchanged by all three detail blocks.

**One known ordering issue, resolved.** The spec's §6.4 cold-open order did not follow from its own
tiers. Task 5 implements a defensible rule, asserts the resulting order, and updates the spec in the
same commit.
