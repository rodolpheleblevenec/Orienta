// Petit graphe à barres en SVG inline (aucune dépendance).
//
// props:
//   data    : [{ date: 'YYYY-MM-DD', ... }]
//   series  : [{ key, label, color }]  — une ou plusieurs valeurs par jour
//   stacked : true → barres empilées ; false (défaut) → barres groupées
//   height  : hauteur du tracé en px (défaut 160)

const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

function fmtDay(iso) {
  const d = parseInt(iso.slice(8, 10), 10)
  const m = parseInt(iso.slice(5, 7), 10) - 1
  return `${d} ${MONTHS_SHORT[m]}`
}

export default function BarChart({ data, series, stacked = false, height = 160 }) {
  if (!data || data.length === 0) {
    return <p className="stats-empty">Pas encore de données.</p>
  }

  // Valeur max (pour l'échelle Y) : somme par jour si empilé, sinon max individuel.
  const dayTotal = (row, fn) => series.reduce((acc, s) => fn(acc, row[s.key] ?? 0), 0)
  const maxVal = Math.max(
    1,
    ...data.map(row =>
      stacked ? dayTotal(row, (a, v) => a + v) : Math.max(0, ...series.map(s => row[s.key] ?? 0)),
    ),
  )

  const PAD_L = 26   // marge gauche pour les libellés de l'axe Y
  const PAD_B = 22   // marge basse pour les dates
  const PAD_T = 6
  const W = Math.max(data.length * 26, 320)
  const plotH = height
  const totalH = plotH + PAD_T + PAD_B
  const totalW = W + PAD_L

  const slot = W / data.length
  const groupW = slot * 0.64
  const x0 = (i) => PAD_L + i * slot + (slot - groupW) / 2
  const yOf = (v) => PAD_T + plotH * (1 - v / maxVal)

  // 3 graduations Y (0, milieu, max)
  const ticks = [0, Math.round(maxVal / 2), maxVal].filter((v, i, a) => a.indexOf(v) === i)

  // étiquettes de dates espacées pour éviter le chevauchement
  const labelStep = Math.ceil(data.length / 8)

  return (
    <div className="stats-chart">
      <svg viewBox={`0 0 ${totalW} ${totalH}`} className="stats-chart-svg" role="img"
           preserveAspectRatio="xMidYMid meet">
        {/* grille + libellés Y */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD_L} y1={yOf(t)} x2={totalW} y2={yOf(t)} className="stats-grid-line" />
            <text x={PAD_L - 6} y={yOf(t) + 3} className="stats-axis-label" textAnchor="end">{t}</text>
          </g>
        ))}

        {/* barres */}
        {data.map((row, i) => {
          if (stacked) {
            let acc = 0
            return (
              <g key={row.date}>
                {series.map((s) => {
                  const v = row[s.key] ?? 0
                  const h = plotH * (v / maxVal)
                  const y = yOf(acc + v)
                  acc += v
                  if (v === 0) return null
                  return (
                    <rect key={s.key} x={x0(i)} y={y} width={groupW} height={h}
                          rx="2" fill={s.color}>
                      <title>{`${fmtDay(row.date)} — ${s.label} : ${v}`}</title>
                    </rect>
                  )
                })}
              </g>
            )
          }
          const bw = groupW / series.length
          return (
            <g key={row.date}>
              {series.map((s, j) => {
                const v = row[s.key] ?? 0
                const h = plotH * (v / maxVal)
                return (
                  <rect key={s.key} x={x0(i) + j * bw} y={yOf(v)} width={Math.max(bw - 1, 1)} height={h}
                        rx="2" fill={s.color}>
                    <title>{`${fmtDay(row.date)} — ${s.label} : ${v}`}</title>
                  </rect>
                )
              })}
            </g>
          )
        })}

        {/* étiquettes X (dates) */}
        {data.map((row, i) => (
          (i % labelStep === 0 || i === data.length - 1) ? (
            <text key={row.date} x={x0(i) + groupW / 2} y={totalH - 6}
                  className="stats-axis-label" textAnchor="middle">{fmtDay(row.date)}</text>
          ) : null
        ))}
      </svg>

      <div className="stats-legend">
        {series.map((s) => (
          <span key={s.key} className="stats-legend-item">
            <span className="stats-legend-dot" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}
