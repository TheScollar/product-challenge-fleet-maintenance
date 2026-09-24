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

  it('has seven open items, each referencing a real vehicle', () => {
    expect(fixture.items).toHaveLength(7)
    const ids = new Set(fixture.vehicles.map((v) => v.id))
    for (const item of fixture.items) expect(ids.has(item.vehicleId)).toBe(true)
  })

  it('authors two new standard-class cases for week 41, both act-now on Thursday', () => {
    const v024 = fixture.items.find((i) => i.id === 'item-v024')!
    const v105 = fixture.items.find((i) => i.id === 'item-v105')!
    expect(v024.vehicleId).toBe('V-024')
    expect(v024.urgency.kind).toBe('estimate')
    expect(v024.safetyClass).toBe(false)
    expect(v024.proposal).toEqual({ treatment: 'act-now', slotDate: '2026-10-08', deferral: null })
    expect(v105.vehicleId).toBe('V-105')
    expect(v105.urgency.kind).toBe('deadline')
    expect(v105.safetyClass).toBe(false)
    expect(v105.proposal).toEqual({ treatment: 'act-now', slotDate: '2026-10-08', deferral: null })
    expect(fixture.vehicles.find((v) => v.id === 'V-024')?.vehicleClass).toBe('standard')
    expect(fixture.vehicles.find((v) => v.id === 'V-105')?.vehicleClass).toBe('standard')
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

  it('prices a standard replacement at a single fixture-wide day rate', () => {
    expect(fixture.replacementDayRateEur).toBe(140)
  })

  it('sets a weekly budget for both authored weeks and a default for the rest', () => {
    expect(fixture.weeks.find((w) => w.weekId === '2026-09-28')!.budgetEur).toBe(3000)
    expect(fixture.weeks.find((w) => w.weekId === '2026-10-05')!.budgetEur).toBe(3000)
    expect(fixture.defaultBudgetEur).toBe(3000)
  })

  it('authors two weeks, the second carrying two new cases plus resurfacing', () => {
    expect(fixture.weeks.map((w) => w.weekId)).toEqual(['2026-09-28', '2026-10-05'])
    expect(fixture.weeks[0].itemIds).toHaveLength(5)
    expect(fixture.weeks[1].itemIds).toEqual(['item-v024', 'item-v105'])
  })

  it('seeds the demo clock on the Monday of week 40', () => {
    expect(SEED_DATE).toBe('2026-09-28')
  })
})

describe('each item carries its own deferral triggers', () => {
  const optionsFor = (id: string) => fixture.items.find((i) => i.id === id)!.triggerOptions

  it('offers none for the safety-class item, where watch is disabled anyway', () => {
    expect(optionsFor('item-v012')).toEqual([])
  })

  it('offers V-103 an odometer trigger ahead of its 70,000 km interval', () => {
    expect(optionsFor('item-v103')).toEqual([
      {
        kind: 'odometer',
        vehicleId: 'V-103',
        thresholdKm: 66_000,
        label: 'Odometer passes 66,000 km',
      },
    ])
  })

  it('offers V-118 the odometer trigger the design names', () => {
    expect(optionsFor('item-v118')).toEqual([
      {
        kind: 'odometer',
        vehicleId: 'V-118',
        thresholdKm: 49_500,
        label: 'Odometer passes 49,500 km',
      },
    ])
  })

  it('offers V-041 the recurrence event that the fixture schedules', () => {
    expect(optionsFor('item-v041')).toEqual([
      { kind: 'event', eventId: 'v041-dtc-recurs', label: 'DTC P0300 recurs' },
    ])
  })

  it('offers V-027 the event its own proposed deferral names', () => {
    expect(optionsFor('item-v027')).toEqual([
      { kind: 'event', eventId: 'v027-wipe-degrades', label: 'Driver reports the wipe quality degrading' },
    ])
  })

  it('offers V-024 a recheck odometer trigger', () => {
    expect(optionsFor('item-v024')).toEqual([
      {
        kind: 'odometer',
        vehicleId: 'V-024',
        thresholdKm: 64_000,
        label: 'Odometer passes 64,000 km',
      },
    ])
  })

  it('offers V-105 the HU reminder event, which never fires in the fixture', () => {
    expect(optionsFor('item-v105')).toEqual([
      { kind: 'event', eventId: 'v105-hu-reminder', label: 'Registration office sends the final HU reminder' },
    ])
    expect(fixture.events.some((e) => e.eventId === 'v105-hu-reminder')).toBe(false)
  })

  it('never offers an item a trigger about another vehicle', () => {
    for (const i of fixture.items) {
      for (const t of i.triggerOptions) {
        if (t.kind === 'odometer') expect(t.vehicleId).toBe(i.vehicleId)
      }
    }
  })
})
