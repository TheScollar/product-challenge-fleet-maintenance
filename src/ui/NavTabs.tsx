export function NavTabs({
  active,
  onNavigate,
}: {
  active: 'fleet' | 'plan'
  onNavigate: (tab: 'fleet' | 'plan') => void
}) {
  return (
    <nav className="tabs">
      <button className={`tab${active === 'fleet' ? ' on' : ''}`} onClick={() => onNavigate('fleet')}>
        Fleet today
      </button>
      <button className={`tab${active === 'plan' ? ' on' : ''}`} onClick={() => onNavigate('plan')}>
        Week plan
      </button>
    </nav>
  )
}
