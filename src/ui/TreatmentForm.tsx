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
}: {
  item: OpenItem
  vehicle: Vehicle
  decision: DraftDecision
  onChange: (d: DraftDecision) => void
}) {
  const allowWatch = watchAvailable(item, vehicle)
  const [draft, setDraft] = useState<Partial<Deferral>>(decision.deferral ?? {})
  const errors = deferralErrors(draft)
  const needsDeferral = decision.treatment === 'watch'
  const canApply = needsDeferral ? errors.length === 0 : decision.slotDate !== null

  function pick(kind: TreatmentKind) {
    if (kind !== 'act-now' && !allowWatch) return
    onChange({ ...decision, treatment: kind, slotDate: kind === 'watch' ? null : decision.slotDate })
  }

  function apply() {
    if (!canApply) return
    onChange({
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
            <label>
              Rationale <span className="req">required</span>
            </label>
            <textarea
              value={draft.reason ?? ''}
              onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
              placeholder="Why is waiting defensible on this evidence?"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="field">
              <label>
                Review date <span className="req">required</span>
              </label>
              <input
                type="date"
                value={draft.reviewDate ?? ''}
                onChange={(e) => setDraft({ ...draft, reviewDate: e.target.value })}
              />
            </div>
            <div className="field">
              <label>
                Trigger <span className="req">required</span>
              </label>
              <select
                value={draft.trigger?.kind === 'event' ? draft.trigger.eventId : ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    trigger:
                      e.target.value === ''
                        ? undefined
                        : {
                            kind: 'event',
                            eventId: e.target.value,
                            label: TRIGGER_LABELS[e.target.value] ?? e.target.value,
                          },
                  })
                }
              >
                <option value="">Choose a trigger</option>
                {Object.entries(TRIGGER_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
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

/** Fixture-backed triggers. Only v041-dtc-recurs is scheduled to fire. [S 4.4] */
const TRIGGER_LABELS: Record<string, string> = {
  'v041-dtc-recurs': 'DTC P0300 recurs',
  'v027-wipe-degrades': 'Driver reports the wipe quality degrading',
}
