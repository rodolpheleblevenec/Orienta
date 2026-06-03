import { useState, useEffect } from 'react'
import { useBodyScrollLock } from '../../lib/useBodyScrollLock'

const PADDING = 10

export default function TourOverlay({ steps, onDone }) {
  const [step, setStep] = useState(0)
  const [targetRect, setTargetRect] = useState(null)
  useBodyScrollLock()

  const current = steps[step]
  const isLast = step === steps.length - 1

  useEffect(() => {
    if (!current.target) {
      setTargetRect(null)
      return
    }
    function measure() {
      const el = document.querySelector(current.target)
      if (!el) { setTargetRect(null); return }
      const r = el.getBoundingClientRect()
      setTargetRect({
        top: r.top - PADDING,
        left: r.left - PADDING,
        width: r.width + PADDING * 2,
        height: r.height + PADDING * 2,
      })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [step, current.target])

  return (
    <div className={`tour-backdrop${targetRect ? ' tour-backdrop--spotlight' : ''}`}>
      {targetRect && (
        <div
          className="tour-spotlight"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
          }}
        />
      )}
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
