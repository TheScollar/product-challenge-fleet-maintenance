import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { PlanProvider } from './state/PlanProvider'
import './ui/theme.css'

const root = document.getElementById('root')
if (root === null) throw new Error('Root element #root is missing from index.html')

createRoot(root).render(
  <StrictMode>
    <PlanProvider>
      <App />
    </PlanProvider>
  </StrictMode>,
)
