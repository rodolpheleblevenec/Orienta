// Petit graphe à barres en SVG inline (aucune dépendance).
//
// props:
//   data    : [{ [xKey]: string, ... }]
//   series  : [{ key, label, color }]  — une ou plusieurs valeurs par entrée
//   stacked : true → barres empilées ; false (défaut) → barres groupées
//   height  : hauteur du tracé en px (défaut 160)
//   xKey    : champ servant d'abscisse (défaut 'date')
//   xFormat : (val) => string pour l'étiquette d'abscisse (défaut : format date court)

const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

function fmtDay(iso) {
  const d = parseInt(iso.slice(8, 10), 10)
  const m = parseInt(iso.slice(5, 7), 10) - 1
  return `${d} ${MONTHS_SHORT[m]}`
}

export default function BarChart({ data, series, stacked = false, height = 160, xKey = 'date', xFormat = fmtDay }) {
  if (!data || data.length === 0) {
    return <p className="stats-empty">Pas encore de données.</p>
  }

  // Valeur max (échelle Y) : somme par entrée si empilé, sinon max individuel.
  const maxVal = Math.max(
    1,
    ...data.map(row =>
      stacked
        ? series.reduce((a, s) => a + (row[s.key] ?? 0), 0)
        : Math.max(0, ...series.map(s => row[s.key] ?? 0)),
    ),
  )

  const PAD_L = 26
  const PAD_B = 22
  const PAD_T = 6
  const W = Math.max(data.length * 30, 320)
  const plotH = height
  const totalH = plotH + PAD_T + PAD_B
  const totalW = W + PAD_L

  const slot = W / data.length
  const groupW = slot * 0.62
  const x0 = (i) => PAD_L + i * slot + (slot - groupW) / 2
  const yOf = (v) => PAD_T + plotH * (1 - v / maxVal)

  const ticks = [0, Math.round(maxVal / 2), maxVal].filter((v, i, a) => a.indexOf(v) === i)

  // Étiquettes X : toutes si peu d'entrées, sinon espacées.
  const labelStep = data.length <= 12 ? 1 : Math.ceil(data.length / 8)

  return (
    <div className="stats-chart">
      <svg viewBox={`0 0 ${totalW} ${totalH}`} className="stats-chart-svg" role="img"
           preserveAspectRatio="xMidYMid meet">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD_L} y1={yOf(t)} x2={totalW} y2={yOf(t)} className="stats-grid-line" />
            <text x={PAD_L - 6} y={yOf(t) + 3} className="stats-axis-label" textAnchor="end">{t}</text>
          </g>
        ))}

        {data.map((row, i) => {
          if (stacked) {
            let acc = 0
            return (
              <g key={i}>
                {series.map((s) => {
                  const v = row[s.key] ?? 0
                  const h = plotH * (v / maxVal)
                  const y = yOf(acc + v)
                  acc += v
                  if (v === 0) return null
                  return (
                    <rect key={s.key} x={x0(i)} y={y} width={groupW} height={h} rx="2" fill={s.color}>
                      <title>{`${xFormat(row[xKey])} — ${s.label} : ${v}`}</title>
                    </rect>
                  )
                })}
              </g>
            )
          }
          const bw = groupW / series.length
          return (
            <g key={i}>
              {series.map((s, j) => {
                const v = row[s.key] ?? 0
                const h = plotH * (v / maxVal)
                return (
                  <rect key={s.key} x={x0(i) + j * bw} y={yOf(v)} width={Math.max(bw - 1, 1)} height={h} rx="2" fill={s.color}>
                    <title>{`${xFormat(row[xKey])} — ${s.label} : ${v}`}</title>
                  </rect>
                )
              })}
            </g>
          )
        })}

        {data.map((row, i) => (
          (i % labelStep === 0 || i === data.length - 1) ? (
            <text key={i} x={x0(i) + groupW / 2} y={totalH - 6}
                  className="stats-axis-label" textAnchor="middle">{xFormat(row[xKey])}</text>
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
