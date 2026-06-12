import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { getLevelProgress, getLevelProgressCollective } from '../../lib/levels'
import { MARINE_ITEMS, getMarineItem } from '../../lib/marineItems'
import { visibleChangelog } from '../../lib/changelog'
import Header from '../../components/ui/Header'

// '2026-06-12' → '12 juin 2026' (pour l'onglet Nouveauté).
function formatChangelogDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function ProfilePage() {
  const { user, refreshUser, shop, fetchShop, setStatus } = useAuthStore()
  const [activeTab, setActiveTab] = useState('profil')
  const [activityTab, setActivityTab] = useState('jouees')
  const [stats, setStats] = useState(null)
  const [playHistory, setPlayHistory] = useState([])
  const [createdGrids, setCreatedGrids] = useState([])
  const [collectiveLevel, setCollectiveLevel] = useState(1)
  const [selectedSkin, setSelectedSkin] = useState(user?.selected_skin ?? 1)
  const [suggestion, setSuggestion] = useState('')
  const [suggestionSending, setSuggestionSending] = useState(false)
  const [suggestionSent, setSuggestionSent] = useState(false)
  const [statusVal, setStatusVal] = useState(user?.status_text ?? '')
  const [statusMsg, setStatusMsg] = useState(null)
  const [savingStatus, setSavingStatus] = useState(false)

  useEffect(() => {
    if (user?.selected_skin != null) setSelectedSkin(user.selected_skin)
  }, [user?.selected_skin])

  // Charge la boutique (pour savoir si « Statut perso » est possédé) + synchronise le champ.
  useEffect(() => { fetchShop() }, [])
  useEffect(() => { setStatusVal(user?.status_text ?? '') }, [user?.status_text])

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('orienta_plays')
        .select('id, grid_id, score, success, completed_at, attempts_count, time_seconds, xp_earned, orienta_grids(clue_top, clue_right, clue_bottom, clue_left, difficulty)')
        .eq('player_id', user.id).not('completed_at', 'is', null)
        .order('completed_at', { ascending: false }).limit(20),

      supabase.from('orienta_grids')
        .select('id, clue_top, created_at, status, difficulty, orienta_plays(success)')
        .eq('creator_id', user.id).order('created_at', { ascending: false }).limit(20),

      supabase.from('orienta_collective_progress').select('*').eq('id', 1).single(),
    ]).then(([playsRes, gridsRes, collectiveRes]) => {
      const plays = playsRes.data ?? []
      setPlayHistory(plays)
      setCreatedGrids(gridsRes.data ?? [])
      const wins = plays.filter(p => p.success).length
      const total = plays.reduce((s, p) => s + (p.score ?? 0), 0)
      setStats({
        played: plays.length,
        winRate: plays.length > 0 ? Math.round((wins / plays.length) * 100) : 0,
        avgScore: plays.length > 0 ? Math.round(total / plays.length) : 0,
        bestScore: plays.reduce((m, p) => Math.max(m, p.score ?? 0), 0),
      })
      if (collectiveRes.data) {
        const cp = getLevelProgressCollective(collectiveRes.data.total_xp)
        setCollectiveLevel(cp.currentLevel.level)
      }
    })
  }, [user])

  const ownsStatus = (shop?.items ?? []).some(i => i.code === 'status_custom' && i.owned)
  async function handleSetStatus() {
    setSavingStatus(true)
    const res = await setStatus(statusVal.trim())
    setSavingStatus(false)
    if (res?.ok) setStatusMsg({ ok: true, text: res.status ? '✅ Statut enregistré.' : '✅ Statut effacé.' })
    else setStatusMsg({ ok: false, text: 'Échec — réessaie.' })
  }

  if (!user) return null

  const handleSelectSkin = async (level) => {
    const prev = selectedSkin
    setSelectedSkin(level)
    const { data, error } = await supabase.functions.invoke('account', {
      body: { action: 'skin', user_id: user.id, skin: level },
    })
    if (error || data?.error) { setSelectedSkin(prev); return }
    await refreshUser()
  }

  const handleSendSuggestion = async () => {
    const content = suggestion.trim()
    if (!content || suggestionSending) return
    setSuggestionSending(true)
    const { data, error } = await supabase.functions.invoke('account', {
      body: { action: 'suggestion', user_id: user.id, content },
    })
    setSuggestionSending(false)
    if (error || !data || data.error) {
      alert("Échec de l'envoi de ton idée. Réessaie.")
      return
    }
    setSuggestionSent(true)
    setSuggestion('')
  }

  const userLevelProgress = getLevelProgress(user.xp)

  const DIFF_LABEL = { facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile' }
  const DIFF_COLOR = { facile: '#00A889', moyen: '#E89010', difficile: '#F0440A' }
  const STATUS_LABEL = { published: 'Publié', draft: 'Brouillon', archived: 'Archivé' }

  function relativeDate(dateStr) {
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
    if (days === 0) return "Aujourd'hui"
    if (days === 1) return 'Hier'
    return `Il y a ${days}j`
  }

  function formatTime(secs) {
    if (!secs) return null
    return secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m${secs % 60 > 0 ? String(secs % 60).padStart(2, '0') : ''}`
  }

  const avatarContent = selectedSkin > 1
    ? getMarineItem(selectedSkin).name.split(' ')[0]
    : user.pseudo[0].toUpperCase()

  return (
    <div className="profile-page">
      <Header />
      <main className="profile-main">

        <div className="profile-tabs">
          {[['profil', 'Profil'], ['activite', 'Activité'], ['nouveaute', 'Nouveauté']].map(([id, label]) => (
            <button
              key={id}
              className={`profile-tab${activeTab === id ? ' profile-tab--active' : ''}`}
              onClick={() => setActiveTab(id)}
              type="button"
            >{label}</button>
          ))}
        </div>

        {activeTab === 'profil' && (
          <>
            <div className="profile-header-block">
              <div className="profile-avatar-wrap">
                <div className="profile-avatar">{avatarContent}</div>
                <div className="profile-level-badge">{user.level}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="profile-name-row">
                  <h1 className="profile-name">{user.pseudo}</h1>
                  <div className="profile-streak-pills">
                    <span className="profile-streak-pill">🔥 {user.streak_current}</span>
                    <span className="profile-streak-pill">🏆 {user.streak_best}</span>
                  </div>
                </div>
                <div className="profile-xp-bar">
                  <div className="profile-xp-info">
                    <span className="profile-xp-label">{userLevelProgress.currentLevel.name}</span>
                    <span className="profile-xp-amount">{user.xp.toLocaleString()} XP</span>
                  </div>
                  <div className="profile-xp-track">
                    <motion.div
                      className="profile-xp-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${userLevelProgress.pct}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                  </div>
                  {userLevelProgress.nextLevel && (
                    <div className="profile-xp-next">
                      {(userLevelProgress.nextLevel.xp - user.xp).toLocaleString()} XP pour {userLevelProgress.nextLevel.name}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {ownsStatus && (
              <section className="profile-section profile-status-section">
                <h2 style={{ marginBottom: 10 }}>Mon statut</h2>
                <div className="comfort-editor">
                  <p className="comfort-editor-title">💬 Affiché sous ton pseudo dans la bulle « En ligne »</p>
                  <div className="comfort-editor-row">
                    <input
                      className="comfort-input"
                      placeholder="Ex. 🔥 en chasse"
                      value={statusVal}
                      maxLength={40}
                      onChange={e => { setStatusVal(e.target.value); setStatusMsg(null) }}
                    />
                    <button className="shop-btn shop-btn--buy" type="button" disabled={savingStatus} onClick={handleSetStatus}>
                      {savingStatus ? '…' : 'Enregistrer'}
                    </button>
                  </div>
                  {statusMsg && <p className={`comfort-msg${statusMsg.ok ? ' comfort-msg--ok' : ' comfort-msg--err'}`}>{statusMsg.text}</p>}
                </div>
              </section>
            )}

            {stats && (
              <div className="profile-stats-card">
                <div className="profile-stats-grid">
                  {[
                    { label: 'Parties',  value: stats.played },
                    { label: 'Réussite', value: `${stats.winRate}%` },
                    { label: 'Moy.',     value: stats.avgScore },
                    { label: 'Meilleur', value: stats.bestScore },
                  ].map((s, i) => (
                    <motion.div key={s.label} className="profile-stat-item"
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}>
                      <span className="profile-stat-value">{s.value}</span>
                      <span className="profile-stat-label">{s.label}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            <section className="profile-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                <h2 style={{ marginBottom: 0 }}>Ton bestiaire</h2>
                <span style={{ fontSize: '12px', color: 'var(--ink-3)' }}>Déverrouillés avec ton XP</span>
              </div>
              <div className="skin-grid">
                {MARINE_ITEMS.map((item) => {
                  const isUnlocked = user.level >= item.level || collectiveLevel >= item.level
                  const isSelected = selectedSkin === item.level
                  return (
                    <motion.div
                      key={item.level}
                      className={`skin-card ${isUnlocked ? 'skin-card--unlocked' : 'skin-card--locked'} ${isSelected ? 'skin-card--active' : ''}`}
                      whileHover={isUnlocked && !isSelected ? { scale: 1.05 } : {}}
                      onClick={() => isUnlocked && !isSelected && handleSelectSkin(item.level)}
                    >
                      <div className="skin-creature">
                        {isUnlocked ? (
                          <span style={{ fontSize: '44px', lineHeight: 1 }}>{item.name.split(' ')[0]}</span>
                        ) : (
                          <>
                            <span style={{ fontSize: '44px', lineHeight: 1, opacity: 0.3 }}>{item.name.split(' ')[0]}</span>
                            <div className="skin-lock">🔒</div>
                          </>
                        )}
                      </div>
                      <div className="skin-info">
                        <div className="skin-name">{item.name}</div>
                        <div className="skin-xp-threshold">{item.xpThreshold.toLocaleString()} XP</div>
                        {isSelected && <div className="skin-badge">✓ Actif</div>}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </section>

            <section className="profile-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                <h2 style={{ marginBottom: 0 }}>💡 Boîte à idées</h2>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--ink-3)', marginBottom: '12px' }}>
                Une idée pour améliorer le jeu ? Un bug, une envie, une suggestion ? Partage-la ici, je lis tout !
              </p>

              {suggestionSent ? (
                <div className="suggestion-sent">
                  <span className="suggestion-sent-icon">✅</span>
                  <div>
                    <p className="suggestion-sent-title">Merci, ton idée a bien été envoyée !</p>
                    <button
                      type="button"
                      className="suggestion-again"
                      onClick={() => setSuggestionSent(false)}
                    >
                      Proposer une autre idée
                    </button>
                  </div>
                </div>
              ) : (
                <div className="suggestion-box">
                  <textarea
                    className="suggestion-textarea"
                    value={suggestion}
                    onChange={e => setSuggestion(e.target.value.slice(0, 1000))}
                    placeholder="Écris ton idée ici…"
                    rows={4}
                  />
                  <div className="suggestion-footer">
                    <span className="suggestion-count">{suggestion.length}/1000</span>
                    <button
                      type="button"
                      className="btn-primary suggestion-send"
                      onClick={handleSendSuggestion}
                      disabled={!suggestion.trim() || suggestionSending}
                    >
                      {suggestionSending ? '…' : 'Envoyer'}
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === 'nouveaute' && (
          <section className="profile-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
              <h2 style={{ marginBottom: 0 }}>Nouveautés</h2>
              <span style={{ fontSize: '12px', color: 'var(--ink-3)' }}>Les dernières features</span>
            </div>
            <ol className="changelog-list">
              {visibleChangelog().map((entry, i) => (
                <li key={entry.date + i} className="changelog-entry">
                  <span className="changelog-dot" aria-hidden="true" />
                  <div className="changelog-body">
                    <div className="changelog-head">
                      <span className="changelog-emoji">{entry.emoji}</span>
                      <h3 className="changelog-title">{entry.title}</h3>
                    </div>
                    <span className="changelog-date">{formatChangelogDate(entry.date)}</span>
                    <ul className="changelog-items">
                      {entry.items.map((it, j) => <li key={j}>{it}</li>)}
                    </ul>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {activeTab === 'activite' && (
          <>
            <div className="activity-tabs">
              <button
                className={`activity-tab${activityTab === 'jouees' ? ' activity-tab--active' : ''}`}
                onClick={() => setActivityTab('jouees')}
                type="button"
              >
                Grilles jouées
                <span className="activity-tab-count">{playHistory.length}</span>
              </button>
              <button
                className={`activity-tab${activityTab === 'creees' ? ' activity-tab--active' : ''}`}
                onClick={() => setActivityTab('creees')}
                type="button"
              >
                Mes grilles
                <span className="activity-tab-count">{createdGrids.length}</span>
              </button>
            </div>

            {activityTab === 'jouees' && (
              playHistory.length === 0
                ? <p className="profile-empty">Aucune partie jouée encore.</p>
                : (
                  <ul className="grid-list">
                    {playHistory.map((p, i) => {
                      const diff = p.orienta_grids?.difficulty
                      const time = formatTime(p.time_seconds)
                      const clues = [
                        p.orienta_grids?.clue_top,
                        p.orienta_grids?.clue_right,
                        p.orienta_grids?.clue_bottom,
                        p.orienta_grids?.clue_left,
                      ].filter(Boolean)
                      return (
                        <li key={i} className="grid-card">
                          <div className="grid-card-top">
                            <div className="grid-card-clues">
                              {clues.map((c, ci) => <span key={ci} className="grid-card-clue-pill">{c}</span>)}
                            </div>
                            <span className={`grid-card-result ${p.success ? 'success' : 'fail'}`}>
                              {p.success ? '✓' : '✗'} {p.score}
                            </span>
                          </div>
                          <div className="grid-card-meta">
                            {diff && <span style={{ color: DIFF_COLOR[diff], fontWeight: 700 }}>{DIFF_LABEL[diff]}</span>}
                            <span>{p.attempts_count} essai{p.attempts_count > 1 ? 's' : ''}</span>
                            {time && <span>{time}</span>}
                            <span>{relativeDate(p.completed_at)}</span>
                          </div>
                          <Link
                            to={`/result/${p.grid_id}`}
                            state={{ score: p.score ?? 0, success: p.success ?? false, timeSeconds: p.time_seconds ?? 0, attemptCount: p.attempts_count ?? 1, xp: p.xp_earned ?? 0, baseXp: p.xp_earned ?? 0, bonusXp: 0, streakCurrent: 0 }}
                            className="grid-card-link"
                          >Voir les essais →</Link>
                        </li>
                      )
                    })}
                  </ul>
                )
            )}

            {activityTab === 'creees' && (
              createdGrids.length === 0
                ? <p className="profile-empty">Aucune grille créée encore.</p>
                : (
                  <ul className="grid-list">
                    {createdGrids.map(g => {
                      const plays = g.orienta_plays ?? []
                      const completedPlays = plays.filter(p => p.success !== null)
                      const successRate = completedPlays.length > 0
                        ? Math.round((completedPlays.filter(p => p.success).length / completedPlays.length) * 100)
                        : null
                      return (
                        <li key={g.id} className="grid-card">
                          <div className="grid-card-top">
                            <span className="grid-card-title">{g.clue_top ?? '—'}</span>
                            <div className="grid-card-badges">
                              {g.difficulty && (
                                <span className="grid-card-diff-badge" style={{ color: DIFF_COLOR[g.difficulty] }}>
                                  {DIFF_LABEL[g.difficulty]}
                                </span>
                              )}
                              {g.status && (
                                <span className={`grid-card-status grid-card-status--${g.status}`}>
                                  {STATUS_LABEL[g.status] ?? g.status}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="grid-card-meta">
                            <span>{completedPlays.length} joueur{completedPlays.length !== 1 ? 's' : ''}</span>
                            {successRate !== null && <span>{successRate}% réussite</span>}
                            <span>{relativeDate(g.created_at)}</span>
                          </div>
                          <Link to={`/dashboard/${g.id}`} className="grid-card-link">Dashboard →</Link>
                        </li>
                      )
                    })}
                  </ul>
                )
            )}
          </>
        )}

      </main>
    </div>
  )
}
