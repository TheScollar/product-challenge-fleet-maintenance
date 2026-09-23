import { useMemo, useState } from 'react'
import { validatePlan } from './domain/validation'
import type { ItemId } from './domain/types'
import { usePlan } from './state/PlanProvider'
import { activeWeekId, draftFor } from './state/planReducer'
import { CapacityBand } from './ui/CapacityBand'
import { DecisionQueue } from './ui/DecisionQueue'
import { DemoBar } from './ui/DemoBar'
import { ItemDetail } from './ui/ItemDetail'
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
  const selectedItem = fixture.items.find((i) => i.id === selectedItemId) ?? null

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
      </div>
    </>
  )
}
