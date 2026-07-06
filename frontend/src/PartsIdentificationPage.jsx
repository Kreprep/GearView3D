import { useEffect, useState } from 'react'
import ForkliftViewport from './gear_view_3_d_forklift_viewport'
import { getParts } from './lib/api'
import './PartsIdentificationPage.css'

function PartsIdentificationPage({ moduleName, onBack }) {
  const [hotspots, setHotspots] = useState([])

  useEffect(() => {
    getParts().then(setHotspots)
  }, [])

  return (
    <div className="training-page-container">
      <header className="training-page-header">
        <button className="back-button" onClick={onBack}>
          Back
        </button>
        <h1>{moduleName} - Parts Identification</h1>
      </header>

      <main className="training-content">
        <div className="content-section">
          <h2>Parts Identification Module</h2>
          <p>
            Explore the forklift model and review the function, safety reminder, and inspection focus for each major component.
            This module is designed for familiarization before supervised hands-on training.
          </p>

          <div className="lesson-card">
            <h3>Main Components</h3>
            <p>Forks, mast, carriage, lift chain, operator area, overhead guard, tires, counterweight, capacity plate, and warning devices.</p>
          </div>

          <section className="viewport-panel">
            <h3>Live Forklift Parts View</h3>
            <p>Use the controls below to inspect the forklift and select labeled parts.</p>
            {hotspots.length > 0 && <ForkliftViewport hotspots={hotspots} />}
          </section>
        </div>
      </main>
    </div>
  )
}

export default PartsIdentificationPage
