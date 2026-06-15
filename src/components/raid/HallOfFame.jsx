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

  // ── Variante « sas » (section 02 « Le classement du raid ») : deux panneaux côte
  //    à côte — le classement des vainqueurs (rang · avatars superposés · temps) et
  //    les trinômes qui ont échoué (équipage + assauts franchis / bouées restantes). ──
  if (compact) {
    const top = teams.slice(0, 5)
    const attempts = (data?.attempts || []).slice(0, 5)
    const best = top[0]?.clear_seconds
    // Bulle d'équipage : avatars superposés ; au survol / focus (clic mobile) d'une
    // bulle, son pseudo complet (+ emoji de rôle) s'affiche dans un petit popover.
    const Crew = ({ members }) => (
      <span className="raid-hofc-crew">
        {members.map((m) => {
          const o = m.role ? ORGANS[m.role] : null
          return (
            <span key={m.pseudo + m.role} className="raid-hofc-av" tabIndex={0}
              style={{ background: `hsl(${hueOf(m.pseudo)} 52% 52%)` }}>
              {(m.pseudo?.[0] || '?').toUpperCase()}
              <span className="raid-hofc-pop">{o?.emoji ? o.emoji + ' ' : ''}{m.pseudo}</span>
            </span>
          )
        })}
      </span>
    )
    return (
      <div className="raid-classement-grid">
        {/* Classement : les équipages qui ont vaincu le boss, du plus rapide au plus lent. */}
        <div className="raid-hof raid-hof--compact">
          <div className="raid-hofc-blocktitle">🏆 Les plus rapides</div>
          {top.length === 0 ? (
            <p className="raid-hofc-empty">Personne n’a encore vaincu {boss.name} — soyez les premiers à le terrasser !</p>
          ) : (
            <div className="raid-hofc-list">
              {top.map((t, i) => {
                const gap = best != null && t.clear_seconds != null ? t.clear_seconds - best : null
                return (
                  <div key={t.session_id} className="raid-hofc-row">
                    <span className={`raid-hofc-rank${i === 0 ? ' is-gold' : ''}`}>{i === 0 ? '🥇' : i + 1}</span>
                    <Crew members={t.members} />
                    <span className="raid-hofc-winstats">
                      <span className="raid-hofc-wintime">⏱ {fmtTime(t.clear_seconds)}</span>
                      <span className="raid-hofc-winmeta">
                        <span title="Joueurs dans l’équipage">👥 {t.tier}</span>
                        {i === 0
                          ? <span className="raid-hofc-wingap raid-hofc-wingap--best">🏅 meilleur temps</span>
                          : gap != null && <span className="raid-hofc-wingap" title="Écart avec le meilleur temps">+{fmtTime(gap)}</span>}
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Trinômes qui ont échoué : montrent que ça joue/tente, et jusqu'où ils sont allés. */}
        <div className="raid-hof raid-hof--compact">
          <div className="raid-hofc-blocktitle">🌊 Ils ont tenté leur chance</div>
          {attempts.length === 0 ? (
            <p className="raid-hofc-empty">Aucune tentative malheureuse pour l’instant — bonne chance !</p>
          ) : (
            <ul className="raid-hofc-tries">
              {attempts.map((a) => (
                <li key={a.session_id} className="raid-hofc-try">
                  <Crew members={a.members} />
                  <span className="raid-hofc-trystats">
                    <span title="Assauts franchis">⚔️ {a.assaults_cleared}/{a.assault_count}</span>
                    <span title="Bouées restantes">🛟 {a.lives}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
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
