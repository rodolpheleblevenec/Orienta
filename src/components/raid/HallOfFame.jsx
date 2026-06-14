import { useState, useEffect } from 'react'
import { ORGANS, getBossByKey } from '../../lib/raid'

// Hall of Fame d'une semaine : les équipages ayant vaincu le boss, classés du plus
// rapide au plus lent. Les données viennent de l'action `hof` de l'Edge Function
// (dérivées des sessions `won` + participants — aucune table dédiée).
const fmtTime = (s) => s == null ? '—' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const hueOf = (s) => { let h = 0; for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h }

function Member({ pseudo, role }) {
  const o = role ? ORGANS[role] : null
  return (
    <span className="raid-hof-member" title={o?.label || ''}>
      <span className="raid-hof-mav" style={{ background: `hsl(${hueOf(pseudo)} 52% 52%)` }}>{(pseudo?.[0] || '?').toUpperCase()}</span>
      {o?.emoji && <span className="raid-hof-mrole">{o.emoji}</span>}
      <span className="raid-hof-mname">{pseudo}</span>
    </span>
  )
}

// `compact` : variante allégée pour le sas de préparation (titre « record à battre »,
// top 3 + meilleur temps en avant). Sinon : Hall of Fame complet (arène vide).
export default function HallOfFame({ level, fetchHof, compact = false }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    ;(async () => {
      const d = await fetchHof(level)
      if (!alive) return
      setData(d || null); setLoading(false)
    })()
    return () => { alive = false }
  }, [level, fetchHof])

  if (loading) return <div className="raid-hof raid-hof--loading">Chargement du Hall of Fame…</div>

  const boss = getBossByKey(data?.boss_key)
  const teams = data?.teams || []
  const first = data?.firstClear

  // ── Variante compacte (sas) : le record à battre + le podium de la semaine. ──
  if (compact) {
    const top = teams.slice(0, 3)
    const best = teams[0]?.clear_seconds
    const attempts = (data?.attempts || []).slice(0, 5)
    return (
      <div className="raid-hof raid-hof--compact">
        <div className="raid-hof-head">
          <span className="raid-hof-emoji">🏆</span>
          <div className="raid-hof-headtxt">
            <h2 className="raid-hof-title">Le record à battre cette semaine</h2>
            <p className="raid-hof-sub">
              {best != null
                ? <>Meilleur temps : <b>{fmtTime(best)}</b> · {boss.name}</>
                : <>Personne n’a encore vaincu {boss.name} — à vous de marquer l’histoire !</>}
            </p>
          </div>
        </div>
        {top.length > 0 && (
          <ol className="raid-hof-list raid-hof-list--compact">
            {top.map((t, i) => (
              <li key={t.session_id} className={`raid-hof-row${i === 0 ? ' raid-hof-row--gold' : ''}`}>
                <span className="raid-hof-rank">{i + 1}</span>
                <span className="raid-hof-time">{fmtTime(t.clear_seconds)}</span>
                <span className="raid-hof-team">
                  {t.members.map(m => <Member key={m.pseudo + m.role} pseudo={m.pseudo} role={m.role} />)}
                </span>
              </li>
            ))}
          </ol>
        )}
        {attempts.length > 0 && (
          <div className="raid-hof-tries">
            <div className="raid-hof-tries-title">🌊 Ils ont tenté leur chance</div>
            <ul className="raid-hof-tries-list">
              {attempts.map((a) => (
                <li key={a.session_id} className="raid-hof-try">
                  <span className="raid-hof-try-team">
                    {a.members.map(m => <Member key={m.pseudo + m.role} pseudo={m.pseudo} role={m.role} />)}
                  </span>
                  <span className="raid-hof-try-stats">
                    <span className="raid-hof-try-stat" title="Assauts franchis">⚔️ {a.assaults_cleared}/{a.assault_count}</span>
                    <span className="raid-hof-try-stat" title="Bouées restantes">🛟 {a.lives}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="raid-hof">
      <div className="raid-hof-head">
        <span className="raid-hof-emoji">{boss.emoji}</span>
        <div className="raid-hof-headtxt">
          <h2 className="raid-hof-title">Hall of Fame — {boss.name}</h2>
          <p className="raid-hof-sub">Semaine {data?.level ?? level} · les équipages les plus rapides</p>
        </div>
      </div>

      {first && first.members?.length > 0 && (
        <div className="raid-hof-first">
          🥇 <b>Première victoire de la semaine</b> — {first.members.map(m => m.pseudo).join(', ')}
          {first.clear_seconds != null && <> en <b>{fmtTime(first.clear_seconds)}</b></>}
        </div>
      )}

      {teams.length === 0 ? (
        <div className="raid-hof-empty">
          <span className="raid-hof-empty-emoji">🏴‍☠️</span>
          Personne n'a encore vaincu {boss.name} cette semaine. <b>Soyez les premiers !</b>
        </div>
      ) : (
        <ol className="raid-hof-list">
          {teams.map((t, i) => (
            <li key={t.session_id} className={`raid-hof-row${i === 0 ? ' raid-hof-row--gold' : ''}`}>
              <span className="raid-hof-rank">{i + 1}</span>
              <span className="raid-hof-time">{fmtTime(t.clear_seconds)}</span>
              <span className="raid-hof-team">
                {t.members.map(m => <Member key={m.pseudo + m.role} pseudo={m.pseudo} role={m.role} />)}
              </span>
              <span className="raid-hof-tier">{t.tier}&nbsp;👤</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
