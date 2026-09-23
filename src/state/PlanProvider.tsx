import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { fixture as defaultFixture } from '../domain/fixture'
import type { Fixture } from '../domain/types'
import { planReducer, type AppState, type PlanAction } from './planReducer'
import { clearState, loadState, saveState } from './persistence'

interface PlanContextValue {
  state: AppState
  dispatch: (action: PlanAction) => void
  fixture: Fixture
}

const PlanContext = createContext<PlanContextValue | null>(null)

export function PlanProvider({
  children,
  fixture = defaultFixture,
}: {
  children: ReactNode
  fixture?: Fixture
}) {
  const [state, dispatch] = useReducer(
    (s: AppState, a: PlanAction) => planReducer(s, a, fixture),
    fixture,
    loadState,
  )

  useEffect(() => {
    if (state.storageNotice === null) saveState(state)
  }, [state])

  const value = useMemo(
    () => ({
      state,
      fixture,
      dispatch: (action: PlanAction) => {
        if (action.type === 'reset') clearState()
        dispatch(action)
      },
    }),
    [state, fixture],
  )

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>
}

export function usePlan(): PlanContextValue {
  const value = useContext(PlanContext)
  if (value === null) throw new Error('usePlan must be used inside a PlanProvider')
  return value
}
