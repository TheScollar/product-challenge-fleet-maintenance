import { formatDay } from '../domain/clock'
import type { RecommendationView } from '../domain/recommendation'

export function EvidenceBlock({ recommendation }: { recommendation: RecommendationView }) {
  return (
    <div className="block">
      <div className="blocktitle">Observation</div>
      <dl className="kv">
        <dt>What was seen</dt>
        <dd>{recommendation.observation}</dd>
        <dt>Source</dt>
        <dd>
          {recommendation.source}{' '}
          <span className="src">· received {formatDay(recommendation.receivedOn)}</span>
        </dd>
        {recommendation.relevantDate !== null && (
          <>
            <dt>Relevant date</dt>
            <dd>{formatDay(recommendation.relevantDate)}</dd>
          </>
        )}
      </dl>
      {recommendation.verbatim !== null && (
        <div className="verbatim">{recommendation.verbatim}</div>
      )}
    </div>
  )
}
