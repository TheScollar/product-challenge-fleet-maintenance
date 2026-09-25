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
            releaseRecordedOn: '2026-10-05',
          }
        : null,
  }
}

const vehicles: Vehicle[] = [
  ...STANDARD_IDS.map((id, i) => buildVehicle(id, 'standard', i)),
  ...SPECIALIST_IDS.map((id, i) => buildVehicle(id, 'specialist', i + 30)),
]

const covers: Cover[] = []

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
      coverUnavailable: false,
      uncoveredAssignmentsNote: 'One standard assignment uncovered every day V-012 is held.',
    },
    proposal: { treatment: 'act-now', slotDate: '2026-09-29', deferral: null },
    // Watch is disabled for a safety-class item, so it offers no trigger.
    triggerOptions: [],
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
      coverUnavailable: false,
      uncoveredAssignmentsNote: 'None on the proposed day.',
    },
    proposal: { treatment: 'act-now', slotDate: '2026-09-29', deferral: null },
    triggerOptions: [
      {
        kind: 'odometer',
        vehicleId: 'V-103',
        thresholdKm: 66_000,
        label: 'Odometer passes 66,000 km',
      },
    ],
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
      coverUnavailable: false,
      uncoveredAssignmentsNote: 'Depends on the day chosen. Tuesday leaves one assignment uncovered.',
    },
    proposal: { treatment: 'act-now', slotDate: '2026-09-29', deferral: null },
    triggerOptions: [
      {
        kind: 'odometer',
        vehicleId: 'V-118',
        thresholdKm: 49_500,
        label: 'Odometer passes 49,500 km',
      },
    ],
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
      coverUnavailable: true,
      uncoveredAssignmentsNote: 'One specialist assignment uncovered on any day this van is in.',
    },
    // Arrives undisposed on purpose: the specialist shortfall should appear
    // when the user schedules it, not at cold open. [S 4.4]
    proposal: { treatment: 'act-now', slotDate: null, deferral: null },
    triggerOptions: [{ kind: 'event', eventId: 'v041-dtc-recurs', label: 'DTC P0300 recurs' }],
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
    triggerOptions: [
      { kind: 'event', eventId: 'v027-wipe-degrades', label: 'Driver reports the wipe quality degrading' },
    ],
  },
  {
    id: 'item-v024',
    vehicleId: 'V-024',
    title: 'Front tyre tread approaching the legal minimum',
    garageId: 'werkstatt-berg',
    evidence: {
      observation:
        'Front-axle tread depth read at 2.1 mm, telematics-linked. Statutory minimum under StVZO is 1.6 mm.',
      source: 'Telematics tread-depth feed',
      receivedOn: '2026-10-05',
      verbatim: null,
    },
    urgency: {
      kind: 'estimate',
      because: 'Tread read 2.1 mm on 5 Oct against a 1.6 mm legal minimum under StVZO.',
      relevantDate: null,
    },
    assumption:
      'A single tread reading does not establish a wear rate, so no replacement date is projected. The finding alone is evidence enough to book the visit this week rather than wait for a second reading.',
    safetyClass: false,
    parts: { name: 'Front tyre pair', readyOn: '2026-10-07' },
    visitDays: 1,
    canExtendToDays: null,
    consequence: {
      qualitative:
        'Tread continues toward the legal minimum with each week driven. No regulatory deadline applies yet, and replacing now avoids a rushed booking once the margin closes.',
      serviceCostEur: 240,
      coverUnavailable: false,
      uncoveredAssignmentsNote: 'Depends on the day chosen. Thursday leaves one assignment uncovered.',
    },
    proposal: { treatment: 'act-now', slotDate: '2026-10-08', deferral: null },
    triggerOptions: [
      {
        kind: 'odometer',
        vehicleId: 'V-024',
        thresholdKm: 64_000,
        label: 'Odometer passes 64,000 km',
      },
    ],
  },
  {
    id: 'item-v105',
    vehicleId: 'V-105',
    title: 'Hauptuntersuchung (HU) due',
    garageId: 'werkstatt-berg',
    evidence: {
      observation: 'HU sticker expires 31 Oct 2026. No test slot booked yet.',
      source: 'Fleet registration record',
      receivedOn: '2026-10-05',
      verbatim: null,
    },
    urgency: {
      kind: 'deadline',
      because:
        'Legally required roadworthiness test (HU) must be completed before the sticker expires. Driving past that date without a valid HU is an administrative offence.',
      relevantDate: '2026-10-31',
    },
    assumption: null,
    safetyClass: false,
    parts: null,
    visitDays: 1,
    canExtendToDays: null,
    consequence: {
      qualitative:
        'A missed HU deadline is an administrative offence and can affect insurance cover if the van is stopped without a valid test. Booking now, well ahead of 31 Oct, avoids a last-minute scramble if the test finds a defect needing a follow-up visit before the sticker expires.',
      serviceCostEur: 120,
      coverUnavailable: false,
      uncoveredAssignmentsNote: 'Depends on the day chosen. Thursday leaves one assignment uncovered.',
    },
    proposal: { treatment: 'act-now', slotDate: '2026-10-08', deferral: null },
    triggerOptions: [
      { kind: 'event', eventId: 'v105-hu-reminder', label: 'Registration office sends the final HU reminder' },
    ],
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
    coverIds: [],
    itemIds: ['item-v012', 'item-v041', 'item-v103', 'item-v118', 'item-v027'],
    budgetEur: 3000,
  },
  {
    weekId: '2026-10-05',
    days: WEEK_41,
    demand: { standard: 38, specialist: 7 },
    coverIds: ['R-1'],
    itemIds: ['item-v024', 'item-v105'],
    budgetEur: 3000,
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
  replacementDayRateEur: 140,
  defaultBudgetEur: 3000,
}
