import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PhysicsSpike } from './PhysicsSpike.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PhysicsSpike />
  </StrictMode>,
)
