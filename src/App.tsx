import { useEffect, useMemo, useState } from 'react'
import { validatePlan } from './domain/validation'
import type { DraftDecision, ItemId } from './domain/types'
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
  // The selected item's staged-but-not-yet-applied decision, kept here (not
  // just inside ItemDetail) so the capacity band can preview it before Apply
  // to draft is clicked. Reset whenever the selection changes, below.
  const [pendingDecision, setPendingDecision] = useState<DraftDecision | null>(null)
  // Values, not a router: no URLs, no history entries. Two independent
  // pieces, because they answer different questions. `tab` is where the user
  // is; `planView` is which face the plan side is wearing. Keeping them apart
  // is what lets every route back to the plan (the tab, the fleet's button, an
  // attention card, a popover link) restore the summary instead of destroying
  // it and inviting a needless recommit. Only a commit, a week change or a
  // reset moves `planView`. [FO spec 3]
  const [tab, setTab] = useState<'fleet' | 'plan'>('fleet')
  const [planView, setPlanView] = useState<'planning' | 'summary'>('planning')
  // [cover note spec 5.4] Lazy-initialised so the synchronous localStorage
  // read only happens once, on mount, not on every render.
  const [showCoverNote, setShowCoverNote] = useState(() => !hasSeenCoverNote())

  const weekId = activeWeekId(state)

  useEffect(() => {
    setTab('fleet')
    setPlanView('planning')
    setSelectedItemId(null)
  }, [weekId])

  // A stale preview must not survive past the item it previewed, whether the
  // selection moves to another item or clears entirely.
  useEffect(() => {
    setPendingDecision(null)
  }, [selectedItemId])

  const decisions = useMemo(() => draftFor({ fixture, state, weekId }), [fixture, state, weekId])
  const previewDecisions = useMemo(
    () => (pendingDecision ? { ...decisions, [pendingDecision.itemId]: pendingDecision } : decisions),
    [decisions, pendingDecision],
  )
  const blockers = useMemo(
    () => validatePlan({ fixture, weekId, decisions }),
    [fixture, weekId, decisions],
  )
  const selectedItem = fixture.items.find((i) => i.id === selectedItemId) ?? null

  // Crossing to the plan side never decides which face it wears: an untouched
  // committed week keeps showing its summary. Only selection moves. [FO spec 3]
  const openPlan = (itemId: ItemId | null) => {
    if (itemId !== null) setSelectedItemId(itemId)
    setTab('plan')
  }

  // The cover note is a full screen, not chrome over the plan: the demo bar
  // does not render here. [cover note spec 4]
  if (showCoverNote) {
    return (
      <CoverNote
        onOpenPlan={() => {
          markCoverNoteSeen()
          setShowCoverNote(false)
          // Its click-through always lands on the fleet, whichever surface
          // About was opened from. `planView` is untouched, so a summary left
          // behind on the plan side is still there. [cover note spec 4]
          setTab('fleet')
        }}
      />
    )
  }

  return (
    <>
      <DemoBar
        onAbout={() => setShowCoverNote(true)}
        onReset={() => {
          setTab('fleet')
          setPlanView('planning')
          setSelectedItemId(null)
        }}
      />
      <NavTabs active={tab} onNavigate={setTab} />
      {tab === 'fleet' ? (
        <FleetView decisions={decisions} blockers={blockers} onOpenPlan={openPlan} />
      ) : (
        <>
          <PlanHeader
            blockers={blockers}
            decisions={decisions}
            onCommit={() => {
              dispatch({ type: 'commit', weekId })
              setPlanView('summary')
            }}
            onSelectItem={setSelectedItemId}
          />
          <CapacityBand decisions={previewDecisions} selectedItemId={selectedItemId} />
          {planView === 'summary' && state.committedByWeek[weekId] ? (
            <CommitSummary onEdit={() => setPlanView('planning')} />
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
                    onApply={(decision) => dispatch({ type: 'set-decision', weekId, decision })}
                    onPendingChange={setPendingDecision}
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
