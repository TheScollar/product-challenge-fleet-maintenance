import type { CostSummary } from '../domain/costs'

export function CostAgainstBudget({ summary }: { summary: CostSummary }) {
  return (
    <div className="costs">
      <div className="cost">
        <div className="n">EUR {summary.serviceCostEur.toLocaleString('en-GB')}</div>
        <div className="l">Service cost</div>
      </div>
      <div className="cost">
        <div className="n">EUR {summary.coverCostEur.toLocaleString('en-GB')}</div>
        <div className="l">Replacement cover</div>
      </div>
      <div className={`cost${summary.overByEur !== null ? ' over' : ''}`}>
        <div className="n">EUR {summary.totalEur.toLocaleString('en-GB')}</div>
        <div className="l">
          {summary.overByEur !== null
            ? `EUR ${summary.overByEur.toLocaleString('en-GB')} over the EUR ${summary.budgetEur.toLocaleString('en-GB')} budget`
            : `Of a EUR ${summary.budgetEur.toLocaleString('en-GB')} weekly budget`}
        </div>
      </div>
    </div>
  )
}
