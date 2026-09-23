import { formatLongDay } from '../domain/clock'
import { nextResurfaceDate } from '../domain/deferral'
import { usePlan } from '../state/PlanProvider'

export function DemoBar({ onAbout }: { onAbout: () => void }) {
  const { state, dispatch, fixture } = usePlan()
  const nextReview = nextResurfaceDate({
    fixture,
    history: state.deferralHistory,
    after: state.demoDate,
  })

  return (
    <div className="demobar">
      <span className="tag">SIMULATED</span>
      <span className="clock">Demo clock: {formatLongDay(state.demoDate)}</span>
      <span style={{ color: '#8a6d2f' }}>Synthetic fleet and scenario prices</span>
      <span className="spacer" />
      <button onClick={() => dispatch({ type: 'advance-days', days: 1 })}>Advance 1 day</button>
      <button
        onClick={() => dispatch({ type: 'advance-to-next-review' })}
        disabled={nextReview === null}
        title={nextReview === null ? 'Nothing is deferred with a pending review' : `Jump to ${nextReview}`}
      >
        Advance to next review date
      </button>
      <button onClick={() => dispatch({ type: 'reset' })}>Reset scenario</button>
      <button onClick={onAbout}>About this prototype</button>
      {state.storageNotice !== null && (
        <div className="notice">
          {state.storageNotice}{' '}
          <button onClick={() => dispatch({ type: 'dismiss-notice' })}>Dismiss</button>
        </div>
      )}
    </div>
  )
}
