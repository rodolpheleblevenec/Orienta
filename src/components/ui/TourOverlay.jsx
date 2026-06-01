import { useState } from 'react'
import { useBodyScrollLock } from '../../lib/useBodyScrollLock'

export default function TourOverlay({ steps, onDone }) {
  const [step, setStep] = useState(0)
  useBodyScrollLock()

  const current = steps[step]
  const isLast = step === steps.length - 1

  return (
    <div className="tour-backdrop">
      <div key={step} className={`tour-card tour-card--${current.anchor ?? 'center'}`}>
        {current.zone && <div className="tour-zone">{current.zone}</div>}
        <h3 className="tour-title">{current.title}</h3>
        <p className="tour-desc">{current.description}</p>
        <div className="tour-footer">
          <div className="tour-dots">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`tour-dot${i === step ? ' tour-dot--active' : i < step ? ' tour-dot--done' : ''}`}
              />
            ))}
          </div>
          <div className="tour-actions">
            <button className="tour-skip" onClick={onDone} type="button">Passer</button>
            <button
              className="btn-primary tour-next"
              onClick={isLast ? onDone : () => setStep(s => s + 1)}
              type="button"
            >
              {isLast ? "C'est parti !" : 'Suivant →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
