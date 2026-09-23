import type { RecommendationView } from '../domain/recommendation'

export function ConsequenceBlock({ recommendation }: { recommendation: RecommendationView }) {
  const c = recommendation.consequence
  const coverUnavailable = c.coverCost === 'not available'

  return (
    <div className="block">
      <div className="blocktitle">
        Consequence of waiting <span className="synthetic">SYNTHETIC PRICES</span>
      </div>
      <p>{c.qualitative}</p>
      <div className="costs">
        <div className="cost">
          <div className="n">{c.serviceCost}</div>
          <div className="l">Service cost</div>
        </div>
        <div className="cost">
          <div className={`n${coverUnavailable ? ' na' : ''}`}>{c.coverCost}</div>
          <div className="l">Replacement cover</div>
        </div>
        <div className="cost">
          <div className="n" style={{ fontSize: '12.5px' }}>
            {c.disruption}
          </div>
          <div className="l">Operational disruption</div>
        </div>
      </div>
    </div>
  )
}
