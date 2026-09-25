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
  /** The triggers a deferral of this item may name. Scoped to the item, so a
   *  van is never offered a follow-up about a different van. [S 4.4] */
  triggerOptions: Trigger[]
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

export interface ReplacementBooking {
  vehicleId: VehicleId
  startDate: ISODate
  days: number
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
  budgetEur: number
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
  replacementDayRateEur: number
  defaultBudgetEur: number
}

export interface DayCapacity {
  date: ISODate
  vehicleClass: VehicleClass
  owned: number
  unavailable: VehicleId[]
  cover: number
  /** Pool rentals first, then ad hoc bookings, in the order they were counted. */
  coverIds: string[]
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
  bookings: Record<VehicleId, ReplacementBooking>
}

export interface DeferralRecord {
  itemId: ItemId
  deferral: Deferral
  decidedOn: ISODate
  weekId: WeekId
}
