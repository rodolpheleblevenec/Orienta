// Barre de composition horizontale (100 %) + légende avec valeurs/pourcentages.
// props: segments = [{ label, value, color }]
export default function BreakdownBar({ segments }) {
  const total = segments.reduce((a, s) => a + s.value, 0)
  if (total === 0) return <p className="stats-empty">Pas encore de données.</p>

  return (
    <div className="stats-breakdown">
      <div className="stats-breakdown-bar">
        {segments.map(s => s.value > 0 && (
          <div
            key={s.label}
            className="stats-breakdown-seg"
            style={{ width: `${(100 * s.value) / total}%`, background: s.color }}
            title={`${s.label} : ${s.value} (${Math.round((100 * s.value) / total)} %)`}
          />
        ))}
      </div>
      <div className="stats-legend">
        {segments.map(s => (
          <span key={s.label} className="stats-legend-item">
            <span className="stats-legend-dot" style={{ background: s.color }} />
            {s.label} · <strong>{s.value}</strong> ({Math.round((100 * s.value) / total)} %)
          </span>
        ))}
      </div>
    </div>
  )
}
