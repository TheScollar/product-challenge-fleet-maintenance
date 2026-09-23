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
