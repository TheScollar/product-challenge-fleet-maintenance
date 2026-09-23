import { describe, expect, it } from 'vitest'
import { consequenceView } from './consequence'
import { fixture } from './fixture'
import { recommendationFor, watchAvailable } from './recommendation'
import { orderQueue, urgencyRank } from './urgency'
import { coldOpenDecisions, item, vehicle } from './testSupport'
import type { Blocker } from './types'

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
