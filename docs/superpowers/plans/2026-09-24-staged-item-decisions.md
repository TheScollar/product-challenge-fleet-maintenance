# Staged Item Decisions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `Apply to draft` the single, uniform way anything in the item detail panel (treatment,
slot date, deferral) reaches the plan, instead of today's split where slot and treatment dispatch
immediately and only the deferral fields are staged.

**Architecture:** `ItemDetail` starts owning a local `DraftDecision` (seeded from the committed one,
reset for free whenever `App.tsx` remounts it via `key={item.id}`). `TreatmentForm` and `SlotPicker`
become controlled by that local value through the existing `onChange` prop; a new `onApply` prop is the
only path that dispatches `set-decision`. `ItemDetail` reports its local value up to `App.tsx`, which
overlays it on the committed decisions map for `CapacityBand` only, so the band previews live while
`PlanHeader` and `DecisionQueue` keep reading the plain committed state.

**Tech Stack:** React 19, TypeScript, Vite, Vitest (domain-only, `environment: 'node'`, no
`@testing-library`, no component tests — see `vite.config.ts`).

## Global Constraints

- No new dependencies. No new test infrastructure; this project has no component-test setup and none is
  being added (`vite.config.ts` runs Vitest with `environment: 'node'` against `src/**/*.test.ts` only).
- No changes to `src/domain/*` or `src/state/planReducer.ts`. `set-decision` keeps receiving one
  complete `DraftDecision`, unchanged shape, unchanged reducer behavior.
- No changes to `src/ui/SlotPicker.tsx`, `src/ui/PlanHeader.tsx`, `src/ui/DecisionQueue.tsx`, or
  `src/ui/CapacityBand.tsx`. They already take the right props for this change; only `App.tsx`, their
  caller, changes what it passes them.
- Preserve existing copy, class names, and comment style exactly. Match the file's existing convention
  of comments only where the WHY is non-obvious.
- Spec of record: `docs/superpowers/specs/2026-09-24-staged-item-decisions-design.md`.

---

## Task 1: Stage the item decision behind Apply to draft, with a live capacity-band preview

**Files:**
- Modify: `src/ui/TreatmentForm.tsx`
- Modify: `src/ui/ItemDetail.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `TreatmentForm` prop `onApply: (d: DraftDecision) => void` (new, alongside the existing
  `onChange: (d: DraftDecision) => void`, which now means "stage" rather than "commit").
- Produces: `ItemDetail` props `onApply: (d: DraftDecision) => void` and
  `onPendingChange: (d: DraftDecision) => void` (replacing its old single `onChange` prop).
- Consumes (from existing code, unchanged): `DraftDecision`, `ItemId`, `OpenItem`, `Vehicle` from
  `src/domain/types.ts`; `watchAvailable`, `watchUnavailableReason` from
  `src/domain/recommendation.ts`; `deferralErrors` from `src/domain/deferral.ts`.

This is one task because the three files form a single prop-threading change: `TreatmentForm`'s new
`onApply` prop is meaningless until `ItemDetail` supplies it, and `ItemDetail`'s new props are
meaningless until `App.tsx` supplies them. No intermediate state between edits type-checks, so they land
together.

- [ ] **Step 1: Edit `src/ui/TreatmentForm.tsx`**

Add an `onApply` prop and make `apply()` call it instead of `onChange`. `pick()` keeps calling
`onChange`, that's now the "stage this" path. Replace the full file with:

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
  onApply,
}: {
  item: OpenItem
  vehicle: Vehicle
  decision: DraftDecision
  onChange: (d: DraftDecision) => void
  onApply: (d: DraftDecision) => void
}) {
  const allowWatch = watchAvailable(item, vehicle)
  const [draft, setDraft] = useState<Partial<Deferral>>(decision.deferral ?? {})
  const errors = deferralErrors(draft)
  const needsDeferral = decision.treatment === 'watch'
  const canApply = needsDeferral ? errors.length === 0 : decision.slotDate !== null
  // Two forms can be mounted for two items, so control ids carry the item id.
  const fieldId = (name: string) => `${item.id}-${name}`

  function pick(kind: TreatmentKind) {
    if (kind !== 'act-now' && !allowWatch) return
    // A slot belongs to a visit and a deferral belongs to a watch, so leaving
    // either treatment drops the field the other one owns.
    onChange({
      ...decision,
      treatment: kind,
      slotDate: kind === 'watch' ? null : decision.slotDate,
      deferral: kind === 'watch' ? decision.deferral : null,
    })
  }

  function apply() {
    if (!canApply) return
    onApply({
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
            disabled={t.kind !== 'act-now' && !allowWatch}
            onClick={() => pick(t.kind)}
            title={t.kind !== 'act-now' && !allowWatch ? watchUnavailableReason() : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!allowWatch && <div className="blockedreason">{watchUnavailableReason()}</div>}

      {needsDeferral && (
        <>
          <div className="field">
            <label htmlFor={fieldId('rationale')}>
              Rationale <span className="req">required</span>
            </label>
            <textarea
              id={fieldId('rationale')}
              value={draft.reason ?? ''}
              onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
              placeholder="Why is waiting defensible on this evidence?"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="field">
              <label htmlFor={fieldId('review-date')}>
                Review date <span className="req">required</span>
              </label>
              <input
                id={fieldId('review-date')}
                type="date"
                value={draft.reviewDate ?? ''}
                onChange={(e) => setDraft({ ...draft, reviewDate: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor={fieldId('trigger')}>
                Trigger <span className="req">required</span>
              </label>
              <select
                id={fieldId('trigger')}
                value={draft.trigger?.label ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    // The label is the option key and the triggers are the
                    // item's own, so the full Trigger is stored, odometer
                    // thresholds included.
                    trigger: item.triggerOptions.find((t) => t.label === e.target.value),
                  })
                }
              >
                <option value="">Choose a trigger</option>
                {item.triggerOptions.map((t) => (
                  <option key={t.label} value={t.label}>
                    {t.label}
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
```

- [ ] **Step 2: Edit `src/ui/ItemDetail.tsx`**

`ItemDetail` now owns the staged `DraftDecision` locally (seeded from the committed one), and reports it
upward for the capacity-band preview. Replace the full file with:

```tsx
import { useEffect, useState } from 'react'
import { formatDay } from '../domain/clock'
import { recommendationFor } from '../domain/recommendation'
import { urgencyLabel } from '../domain/urgency'
import type { DraftDecision, ItemId, OpenItem } from '../domain/types'
import { usePlan } from '../state/PlanProvider'
import { activeWeekId, queueFor } from '../state/planReducer'
import { AssumptionBlock } from './AssumptionBlock'
import { ConsequenceBlock } from './ConsequenceBlock'
import { EvidenceBlock } from './EvidenceBlock'
import { SlotPicker } from './SlotPicker'
import { TreatmentForm } from './TreatmentForm'

export function ItemDetail({
  item,
  decisions,
  onApply,
  onPendingChange,
}: {
  item: OpenItem
  decisions: Record<ItemId, DraftDecision>
  onApply: (d: DraftDecision) => void
  onPendingChange: (d: DraftDecision) => void
}) {
  const { state, fixture } = usePlan()
  const vehicle = fixture.vehicles.find((v) => v.id === item.vehicleId)!
  const entry = queueFor({ fixture, state, weekId: activeWeekId(state) }).find(
    (e) => e.item.id === item.id,
  )
  const recommendation = recommendationFor(item)
  const committed = decisions[item.id] ?? {
    itemId: item.id,
    treatment: null,
    slotDate: null,
    deferral: null,
  }
  // App.tsx remounts this component via key={item.id}, so switching items
  // always reseeds from the committed decision and discards whatever was
  // staged here but never applied.
  const [decision, setDecision] = useState<DraftDecision>(committed)

  useEffect(() => {
    onPendingChange(decision)
  }, [decision, onPendingChange])

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
      <div className="because">{item.urgency.because}</div>
      {entry !== undefined && entry.priorDecision !== null && (
        <div className="because">
          Previously: watch, decided {formatDay(entry.priorDecision.decidedOn)}.{' '}
          {entry.priorDecision.deferral.reason}
        </div>
      )}

      <EvidenceBlock recommendation={recommendation} />
      <AssumptionBlock recommendation={recommendation} />
      <ConsequenceBlock recommendation={recommendation} />

      {decision.treatment !== 'watch' && (
        <SlotPicker
          item={item}
          decisions={decisions}
          selectedDate={decision.slotDate}
          onPick={(date) => setDecision({ ...decision, slotDate: date })}
        />
      )}

      <TreatmentForm item={item} vehicle={vehicle} decision={decision} onChange={setDecision} onApply={onApply} />
    </div>
  )
}
```

Note what did not change: `SlotPicker` still receives the plain committed `decisions` map (not the
staged one). Its own feasibility/effect math (`slotOptions`, `shortfallsUnder` in
`src/domain/feasibility.ts`) already excludes the item being edited from its own bay-usage count
(`baysUsedOn(..., excludeItemId)`), so it only ever needs other items' committed slots, which this
change never touches.

- [ ] **Step 3: Edit `src/App.tsx`**

Add a `pendingDecision` state for the capacity-band preview, reset it whenever the selection changes,
merge it over the committed decisions for `CapacityBand` only, and update the `ItemDetail` call site to
the new props. Replace the full file with:

```tsx
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
  // is what lets every route back to the plan (the tab, the fleet's own
  // button, an attention card, a popover link) restore the summary instead of
  // destroying it and inviting a needless recommit. Only a commit, a week
  // change or a reset moves `planView`. [FO spec 3]
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
```

Note what did not change: `PlanHeader` and `DecisionQueue` both still receive the plain committed
`decisions` and `blockers`. Only `CapacityBand` receives the merged `previewDecisions`.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 5: Run the existing suite**

Run: `npm test`
Expected: `Test Files 14 passed (14)`, `Tests 214 passed (214)`. This task touches no file under
`src/domain/*` or `src/state/*`, so this is a pure regression check, not new coverage.

- [ ] **Step 6: Commit**

```bash
git add src/ui/TreatmentForm.tsx src/ui/ItemDetail.tsx src/App.tsx
git commit -m "feat: stage the item decision behind Apply to draft"
```

---

## Task 2: Verify against a running instance

There is no component-test harness in this project (see Global Constraints), so verification is a live
browser walkthrough, the same method `docs/acceptance.md` already used for this app's other UI-layer
fixes. This task has no file changes of its own; if it finds a discrepancy, fix it in Task 1's files with
the smallest change that closes the gap, re-run Steps 4-5 of Task 1, and commit that fix separately
before continuing.

**Files:** None (verification only; see the contingency note above if a fix turns out to be needed).

- [ ] **Step 1: Start the dev server**

Run in the background: `npm run dev -- --port 5183 --strictPort`
Expected output includes: `VITE v8.3.0  ready` and `Local:   http://localhost:5183/`.

- [ ] **Step 2: Open a browser session and land on the fleet**

Using the browser tool, open `http://localhost:5183/`, then click the `Open the fleet` button.
Expected: page text includes `Fleet · Monday 28 September 2026` and a `V-012` attention card with
`SAFETY · HARD STOP`.

- [ ] **Step 3: Open V-012 in the week plan and capture the baseline**

Click the `V-012` card. Read the page. Expected page text includes `SETTLED`, `V-012`, `Tue 29 Sep
booked`, and further down `Apply to draft`. Read `localStorage.getItem('fleet-maintenance-prototype/v1')`
via the browser's JS-evaluation capability; expected: no key yet, or `item-v012` (if present from a
prior run in the same session) shows `"slotDate":"2026-09-29"`.

- [ ] **Step 4: Pick a different day without applying, and confirm nothing committed yet**

In the Slot panel, click `Wed 30 Sep`. Read the page again. Expected: the Wed 30 Sep option now shows as
selected, the Week Capacity band's Wed 30 Sep column and its flag line change to reflect the hypothetical
move, and the `V-012` row on the left, in the `Settled` group, still reads `Tue 29 Sep booked`. Evaluate
`localStorage.getItem('fleet-maintenance-prototype/v1')` and confirm `item-v012` is either absent or
still shows `"slotDate":"2026-09-29"`, proving the pick staged locally and did not dispatch.

- [ ] **Step 5: Apply, and confirm it commits**

Click `Apply to draft`. Evaluate localStorage again: `item-v012` now shows `"slotDate":"2026-09-30"`.
Read the page: the left list's `Settled` row for `V-012` now reads `Wed 30 Sep booked`.

- [ ] **Step 6: Change the day again and re-apply**

Click `Tue 29 Sep`. Confirm (as in Step 4) that localStorage still shows `2026-09-30` and the left list
still reads `Wed 30 Sep booked`. Click `Apply to draft` again. Confirm (as in Step 5) that localStorage
now shows `2026-09-29` and the left list reads `Tue 29 Sep booked`. This is the exact behavior that
started this work: pick, apply, change the pick, apply again.

- [ ] **Step 7: Confirm switching away discards an unapplied pick**

With V-012 selected and its last applied slot at Tue 29 Sep, click `Wed 30 Sep` again without applying.
Click a different item's card (`V-041`). Click back on `V-012`. Expected: the Slot panel shows `Tue 29
Sep` selected, not `Wed 30 Sep`, confirming the unapplied pick was discarded when the selection moved.

- [ ] **Step 8: Regression pass**

Run: `npx tsc --noEmit` and `npm test`
Expected: same as Task 1 Steps 4-5.

Run: `npm run build`
Expected: build succeeds (matches the check already recorded in `docs/acceptance.md`).

- [ ] **Step 9: Stop the dev server and close the browser session**

Stop the background dev server process and close the browser session opened in Step 2.
