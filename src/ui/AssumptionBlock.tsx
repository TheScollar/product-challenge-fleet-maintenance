import type { RecommendationView } from '../domain/recommendation'

export function AssumptionBlock({ recommendation }: { recommendation: RecommendationView }) {
  return (
    <div className="block">
      <div className="blocktitle">Assumption in play</div>
      {recommendation.assumption === null ? (
        <p>
          No assumption supports a waiting period here. The evidence establishes that something is
          wrong, not how long it can wait, so the proposed action is to assess rather than to predict.
        </p>
      ) : (
        <p>{recommendation.assumption}</p>
      )}
    </div>
  )
}
