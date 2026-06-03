import { useState, useEffect } from 'react'
import { useBodyScrollLock } from '../../lib/useBodyScrollLock'

const PADDING = 10

export default function TourOverlay({ steps, onDone }) {
  const [step, setStep] = useState(0)
  const [rects, setRects] = useState([])
  useBodyScrollLock()

  const current = steps[step]
  const isLast = step === steps.length - 1

  // Supporte soit une cible unique (target), soit plusieurs (targets)
  const selectors = current.targets ?? (current.target ? [current.target] : [])
  const isMulti = (current.targets?.length ?? 0) > 0
  const selectorKey = selectors.join('|')

  useEffect(() => {
    if (selectors.length === 0) { setRects([]); return }
    function measure() {
      const rs = []
      for (const sel of selectors) {
        const el = document.querySelector(sel)
        if (!el) continue
        const r = el.getBoundingClientRect()
        rs.push({
          top: r.top - PADDING,
          left: r.left - PADDING,
          width: r.width + PADDING * 2,
          height: r.height + PADDING * 2,
        })
      }
      setRects(rs)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [step, selectorKey])

  const hasSpotlight = rects.length > 0

  // Centre du bounding-box combiné des cibles (pour ancrer la bulle au centre de la grille)
  const unionCenter = hasSpotlight ? {
    x: (Math.min(...rects.map(r => r.left)) + Math.max(...rects.map(r => r.left + r.width))) / 2,
    y: (Math.min(...rects.map(r => r.top)) + Math.max(...rects.map(r => r.top + r.height))) / 2,
  } : null

  const cardStyle = current.anchor === 'targets-center' && unionCenter
    ? { left: unionCenter.x, top: unionCenter.y, transform: 'translate(-50%, -50%)' }
    : undefined

  return (
    <div className={`tour-backdrop${hasSpotlight ? ' tour-backdrop--spotlight' : ''}`}>
      {isMulti && hasSpotlight && (
        <>
          <svg className="tour-mask-svg" width="100%" height="100%">
            <defs>
              <mask id="tour-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {rects.map((r, i) => (
                  <rect key={i} x={r.left} y={r.top} width={r.width} height={r.height} rx="10" fill="black" />
                ))}
              </mask>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#tour-mask)" />
          </svg>
          {rects.map((r, i) => (
            <div
              key={i}
              className="tour-spotlight tour-spotlight--ring"
              style={{ top: r.top, left: r.left, width: r.width, height: r.height }}
            />
          ))}
        </>
      )}

      {!isMulti && hasSpotlight && (
        <div
          className="tour-spotlight"
          style={{
            top: rects[0].top,
            left: rects[0].left,
            width: rects[0].width,
            height: rects[0].height,
          }}
        />
      )}

      <div key={step} className={`tour-card tour-card--${current.anchor ?? 'center'}`} style={cardStyle}>
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
