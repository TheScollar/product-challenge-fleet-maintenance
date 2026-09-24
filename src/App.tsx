import { useEffect, useMemo, useState } from 'react'
import { validatePlan } from './domain/validation'
import type { ItemId } from './domain/types'
import { hasSeenCoverNote, markCoverNoteSeen } from './state/coverNoteSeen'
import { usePlan } from './state/PlanProvider'
import { activeWeekId, draftFor } from './state/planReducer'
import { CapacityBand } from './ui/CapacityBand'
import { CommitSummary } from './ui/CommitSummary'
import { CoverNote } from './ui/CoverNote'
import { DecisionQueue } from './ui/DecisionQueue'
import { DemoBar } from './ui/DemoBar'
import { FleetView } from './ui/FleetView'
import { ItemDetail } from './ui/ItemDetail'
import { NavTabs } from './ui/NavTabs'
import { PlanHeader } from './ui/PlanHeader'

export default function App() {
  const { state, dispatch, fixture } = usePlan()
  const [selectedItemId, setSelectedItemId] = useState<ItemId | null>(null)
  // A value, not a router: three states, no URLs, no history entries. The
  // fleet view is the landing surface; decisions stay on the week plan.
  // [FO spec 3]
  const [view, setView] = useState<'fleet' | 'planning' | 'summary'>('fleet')
  // [cover note spec 5.4] Lazy-initialised so the synchronous localStorage
  // read only happens once, on mount, not on every render.
  const [showCoverNote, setShowCoverNote] = useState(() => !hasSeenCoverNote())

  const weekId = activeWeekId(state)

  useEffect(() => {
    setView('fleet')
    setSelectedItemId(null)
  }, [weekId])

  const decisions = useMemo(() => draftFor({ fixture, state, weekId }), [fixture, state, weekId])
  const blockers = useMemo(
    () => validatePlan({ fixture, weekId, decisions }),
    [fixture, weekId, decisions],
  )
  const selectedItem = fixture.items.find((i) => i.id === selectedItemId) ?? null

  const openPlan = (itemId: ItemId | null) => {
    if (itemId !== null) setSelectedItemId(itemId)
    setView('planning')
  }

  // The cover note is a full screen, not chrome over the plan: the demo bar
  // does not render here. [cover note spec 4]
  if (showCoverNote) {
    return (
      <CoverNote
        onOpenPlan={() => {
          markCoverNoteSeen()
          setShowCoverNote(false)
        }}
      />
    )
  }

  return (
    <>
      <DemoBar
        onAbout={() => setShowCoverNote(true)}
        onReset={() => {
          setView('fleet')
          setSelectedItemId(null)
        }}
      />
      <NavTabs
        active={view === 'fleet' ? 'fleet' : 'plan'}
        onNavigate={(tab) => {
          if (tab === 'fleet') setView('fleet')
          // Clicking the already-active plan tab must not yank summary back
          // to planning. [FO spec 3]
          else if (view === 'fleet') setView('planning')
        }}
      />
      {view === 'fleet' ? (
        <FleetView decisions={decisions} blockers={blockers} onOpenPlan={openPlan} />
      ) : (
        <>
          <PlanHeader
            blockers={blockers}
            decisions={decisions}
            onCommit={() => {
              dispatch({ type: 'commit', weekId })
              setView('summary')
            }}
            onSelectItem={setSelectedItemId}
          />
          <CapacityBand decisions={decisions} selectedItemId={selectedItemId} />
          {view === 'summary' && state.committedByWeek[weekId] ? (
            <CommitSummary onEdit={() => setView('planning')} />
          ) : (
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
          )}
        </>
      )}
    </>
  )
}
