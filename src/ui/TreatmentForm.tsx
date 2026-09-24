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
