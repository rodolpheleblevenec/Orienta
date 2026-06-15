import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getAdminSecret, clearAdminSecret } from '../../lib/adminSecret'
import { ORGANS, getBossByKey } from '../../lib/raid'

// ── Panneau admin : inspection des raids ─────────────────────────────
// Relit, pour une session donnée, le déroulé d'une équipe : essais (avec les
// mots posés et le résultat de chaque tentative) + tchat d'équipage. Sert à
// observer comment ça se passe et repérer les frictions UX.
// Lecture via l'Edge Function `raid` (actions admin-list-raids / admin-raid-detail),
// vérifiées par le secret admin — les tables ne sont pas exposées au client.

const STATUS = {
  waiting:  { label: 'En attente', cls: 'waiting' },
  active:   { label: 'En cours',   cls: 'active' },
  won:      { label: 'Victoire',   cls: 'won' },
  lost:     { label: 'Défaite',    cls: 'lost' },
  expired:  { label: 'Expirée',    cls: 'expired' },
}

function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z')
  return d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z')
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
function durationOf(a, b) {
  if (!a || !b) return null
  const sec = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000)
  if (sec < 0) return null
  const m = Math.floor(sec / 60), s = sec % 60
  return m ? `${m}′${String(s).padStart(2, '0')}″` : `${s}″`
}
const roleLabel = (r) => (r && ORGANS[r]) ? `${ORGANS[r].emoji} ${ORGANS[r].label}` : (r || '')

export default function RaidAdmin() {
  const [sessions, setSessions] = useState(null)   // null = chargement
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)   // session_id
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => { loadList() }, [])

  async function loadList() {
    setError(null); setSessions(null)
    const { data, error } = await supabase.functions.invoke('raid', {
      body: { action: 'admin-list-raids', admin_secret: getAdminSecret() },
    })
    if (error || !data || data.error) {
      if (data?.error === 'unauthorized') { clearAdminSecret(); setError('Mot de passe administrateur incorrect.') }
      else setError('Échec du chargement des raids.')
      setSessions([])
      return
    }
    setSessions(data.sessions ?? [])
  }

  async function openDetail(id) {
    setSelected(id); setDetail(null); setDetailLoading(true)
    const { data, error } = await supabase.functions.invoke('raid', {
      body: { action: 'admin-raid-detail', admin_secret: getAdminSecret(), session_id: id },
    })
    setDetailLoading(false)
    if (error || !data || data.error) {
      if (data?.error === 'unauthorized') { clearAdminSecret(); setError('Mot de passe administrateur incorrect.') }
      setDetail({ error: true })
      return
    }
    setDetail(data)
  }

  if (sessions === null) return <p className="admin-empty">Chargement des raids…</p>

  // ── Vue détail d'une session ──
  if (selected) {
    const s = detail?.session
    const st = s ? (STATUS[s.status] ?? { label: s.status, cls: '' }) : null
    return (
      <div className="radmin">
        <div className="radmin-detail-head">
          <button className="btn-secondary" type="button" onClick={() => { setSelected(null); setDetail(null) }}>← Tous les raids</button>
        </div>

        {detailLoading && <p className="admin-empty">Chargement du détail…</p>}
        {detail?.error && <p className="admin-empty">Impossible de charger ce raid.</p>}

        {s && (
          <>
            <section className="radmin-summary">
              <h3 className="radmin-boss">
                {getBossByKey(s.boss_key).emoji} {getBossByKey(s.boss_key).name}
                <span className="radmin-level">Niveau {s.boss_level ?? '?'}</span>
                {s.is_test && <span className="radmin-test">test</span>}
                <span className={`radmin-badge radmin-badge--${st.cls}`}>{st.label}</span>
              </h3>
              <div className="radmin-meta-grid">
                <div><span className="radmin-k">Équipiers</span><span className="radmin-v">{s.tier ?? detail.participants.length}</span></div>
                <div><span className="radmin-k">Assauts</span><span className="radmin-v">{Math.min((s.assault_index ?? 0) + (s.status === 'won' ? 0 : 1), s.assault_count)}/{s.assault_count}</span></div>
                <div><span className="radmin-k">Bouées restantes</span><span className="radmin-v">{s.lives}</span></div>
                <div><span className="radmin-k">Durée</span><span className="radmin-v">{durationOf(s.started_at, s.ended_at) ?? '—'}</span></div>
                <div><span className="radmin-k">Démarré</span><span className="radmin-v">{fmtDateTime(s.started_at)}</span></div>
                <div><span className="radmin-k">Terminé</span><span className="radmin-v">{fmtDateTime(s.ended_at)}</span></div>
              </div>
              <div className="radmin-roster">
                {detail.participants.map((p) => (
                  <span key={p.user_id} className="radmin-chip">{roleLabel(p.role)} · {p.pseudo || 'joueur'}</span>
                ))}
              </div>
            </section>

            <div className="radmin-cols">
              {/* Essais */}
              <section className="radmin-panel">
                <h4 className="radmin-panel-title">🎯 Essais ({detail.attempts.length})</h4>
                {detail.attempts.length === 0 ? (
                  <p className="admin-empty">Aucun essai soumis.</p>
                ) : (
                  <ol className="radmin-attempts">
                    {detail.attempts.map((a) => {
                      const ok = a.correct_full === 4
                      return (
                        <li key={a.id} className={`radmin-attempt${ok ? ' radmin-attempt--ok' : ''}`}>
                          <div className="radmin-attempt-head">
                            <span className="radmin-assault">Assaut {(a.assault_index ?? 0) + 1}</span>
                            <span className={`radmin-result${ok ? ' radmin-result--ok' : ''}`}>
                              {ok ? '✓ Boss touché' : `${a.correct_full ?? 0} bien placée(s) · ${a.correct_rotation ?? 0} à tourner`}
                            </span>
                            <span className="radmin-attempt-time">{fmtTime(a.created_at)}</span>
                          </div>
                          {a.by_pseudo && <div className="radmin-attempt-by">validé par {a.by_pseudo}</div>}
                          <div className="radmin-placed">
                            {(a.placed ?? []).sort((x, y) => x.position - y.position).map((c, i) => (
                              <span key={i} className="radmin-placed-cell" title={`slot ${c.position} · ${c.rotation}°`}>
                                {c.words}{c.rotation ? <em> ↻{c.rotation}°</em> : null}
                              </span>
                            ))}
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                )}
              </section>

              {/* Tchat */}
              <section className="radmin-panel">
                <h4 className="radmin-panel-title">💬 Tchat ({detail.chat.length})</h4>
                {detail.chat.length === 0 ? (
                  <p className="admin-empty">Aucun message enregistré pour cette session.</p>
                ) : (
                  <ul className="radmin-chat">
                    {detail.chat.map((m) => (
                      <li key={m.id} className="radmin-msg">
                        <div className="radmin-msg-head">
                          <span className="radmin-msg-who">{m.pseudo || 'joueur'}</span>
                          {m.role && <span className="radmin-msg-role">{roleLabel(m.role)}</span>}
                          <span className="radmin-msg-time">{fmtTime(m.created_at)}</span>
                        </div>
                        <div className="radmin-msg-text">{m.text}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── Liste des sessions ──
  return (
    <div className="radmin">
      <div className="admin-section-head">
        <div>
          <h2 className="admin-editor-title">⚔️ Inspection des raids</h2>
          <p className="admin-section-sub">
            Relis le déroulé d'une équipe : essais (mots posés + résultat) et tchat de coordination.
            Le tchat n'est enregistré que depuis la mise en place de cette page.
          </p>
        </div>
        <button className="btn-secondary" type="button" onClick={loadList}>↻ Rafraîchir</button>
      </div>

      {error && <p className="admin-empty">{error}</p>}

      {sessions.length === 0 && !error ? (
        <p className="admin-empty">Aucune session de raid pour l'instant.</p>
      ) : (
        <ul className="radmin-list">
          {sessions.map((s) => {
            const st = STATUS[s.status] ?? { label: s.status, cls: '' }
            const c = s.counts ?? { players: 0, attempts: 0, messages: 0 }
            return (
              <li key={s.id} className="radmin-row" onClick={() => openDetail(s.id)} role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') openDetail(s.id) }}>
                <span className={`radmin-badge radmin-badge--${st.cls}`}>{st.label}</span>
                <span className="radmin-row-boss">
                  {getBossByKey(s.boss_key).emoji} Niv. {s.boss_level ?? '?'}
                  {s.is_test && <span className="radmin-test">test</span>}
                </span>
                <span className="radmin-row-date">{fmtDateTime(s.started_at || s.created_at)}</span>
                <span className="radmin-row-counts">
                  👤 {c.players} · 🎯 {c.attempts} · 💬 {c.messages}
                </span>
                <span className="radmin-row-go">›</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
