import { useMemo } from 'react'
import { validatePlan } from './domain/validation'
import { usePlan } from './state/PlanProvider'
import { activeWeekId, draftFor } from './state/planReducer'
import { CapacityBand } from './ui/CapacityBand'
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
      <CapacityBand decisions={decisions} selectedItemId={null} />
      {/* DecisionQueue and ItemDetail mount here in Tasks 12 and 13 */}
    </>
  )
}
