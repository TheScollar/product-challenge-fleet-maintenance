# Staged Item Decisions: Design Spec

Unifies how the item detail panel (Treatment + Slot) commits changes: every field stages locally and
only reaches the plan when `Apply to draft` is clicked, instead of today's split where treatment and
slot write through immediately and only the deferral fields are staged.

**Status.** Approved in brainstorming on 2026-09-24.

---

## 1. Why this exists

Raised while using the prototype: V-012 (safety-class, already held) made `Apply to draft` look either
broken or wrongly disabled. Its treatment and slot arrive pre-decided, `act-now`, Tue 29 Sep, seeded
straight from `item.proposal` in `fixture.ts`, and picking a day in `SlotPicker` dispatches
`set-decision` immediately (`App.tsx:115`). Only the three deferral fields (rationale, review date,
trigger) are staged behind Apply today; treatment and slot are not. That split is what made the button
feel inert for V-012: there was nothing left to apply.

This is not a bug against the current spec: `2026-09-23-fleet-maintenance-prototype-design.md:228` only
ever ties `Apply to draft` to the deferral fields. Separately confirmed and unchanged by this spec: a
vehicle's hold (`vehicle.hold`, checked by `isHeldOn` in `capacity.ts:33`) is a fixed fact of the
fixture tied to `releaseRecordedOn`. No plan action clears it; only the demo clock reaching that date
does. Committing a plan still does not shorten a hold.

This spec makes the interaction model consistent instead: everything in the item panel stages locally,
and `Apply to draft` is the one, uniform way anything reaches the plan.

## 2. Behavior change

Choosing a treatment (Act now / Bundle / Watch), picking a slot day, and filling in the deferral fields
all edit a local, uncommitted draft scoped to the currently selected item. Nothing reaches
`draftByWeek` until **Apply to draft** is clicked. Clicking it again after changing any field re-commits
whatever is currently staged; there is no limit of one apply per item.

`Apply to draft`'s enabled/disabled rule is unchanged: a chosen slot date for Act now/Bundle, or a
complete rationale + review date + trigger for Watch, now evaluated against the staged draft instead of
the committed one. It does not additionally check whether the staged draft differs from what's
committed, so clicking it with nothing new to say is still a harmless no-op, same as today.

## 3. Data flow and component responsibilities

- **`ItemDetail`** (`src/ui/ItemDetail.tsx`), already remounted per item via `key={item.id}` in
  `App.tsx:112`, owns the staged `DraftDecision` in local state, seeded from the committed decision on
  mount.
- **`TreatmentForm`** and **`SlotPicker`** become controlled by that local value: their existing
  `onChange` prop now updates local state only. A new `onApply` path, surfaced from `ItemDetail`, is the
  only thing that dispatches `set-decision`.
- **`ItemDetail`** reports its staged decision up to `App.tsx` as it changes. `App.tsx` merges that
  single item's staged decision over the committed `decisions` map and passes the merged copy to
  `CapacityBand` only, so the band and its "Reacting to V-x" label move live as the user experiments,
  before anything is applied.
- **`PlanHeader`** (the summary pills) and **`DecisionQueue`** (Blocking/Settled grouping) keep reading
  the plain committed `decisions` and `blockers` exactly as today (`App.tsx:88-89, 101-103`). An item
  changes bucket, and the pill counts change, only once `Apply to draft` is clicked.

No change to `src/domain/*` or `src/state/planReducer.ts`. `set-decision` continues to receive one
complete `DraftDecision`, so the write-side contract is untouched.

## 4. Edge cases

**Switching items or tabs mid-edit.** A staged-but-unapplied change is discarded silently when the
selected item changes, remounting `ItemDetail` with a fresh local draft. This matches how an unapplied
deferral edit is already discarded today; no new warning is introduced.

**Re-applying unchanged input.** Clicking Apply to draft when the staged draft already matches the
committed decision is allowed and is a no-op write. Considered and rejected: disabling Apply until the
staged draft actually differs from the committed one. Rejected to keep the enablement rule identical to
today's, one condition, not two, and because a no-op dispatch has no observable cost.

**Scope: only the currently selected item stages.** Only one item's decision can be pending at a time,
matching the existing one-detail-pane-open UI. The capacity-band preview merge in `App.tsx` only ever
overlays the single selected item's staged decision.

## 5. Testing

The reducer and domain layer are unaffected. `planReducer.test.ts`, `commit.test.ts`, and the scenario
suite exercise `set-decision` with a complete `DraftDecision`, which does not change shape or timing
relative to those tests. This is a UI-layer change with no existing component tests. Verification is a
live browser walkthrough: pick a day for V-012, confirm the band reacts and the grouping doesn't move
until Apply; change the day and Apply again; toggle Watch on a non-safety item, fill the deferral,
Apply, and confirm switching away before Apply discards the edit.
