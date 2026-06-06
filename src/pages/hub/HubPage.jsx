import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import Header from '../../components/ui/Header'
import CollectiveGauge from '../../components/ui/CollectiveGauge'
import GridCard from '../../components/ui/GridCard'
import CreatedGridCard from '../../components/ui/CreatedGridCard'
import WinnerWelcomeModal from '../../components/ui/WinnerWelcomeModal'
import OnlinePlayersPanel from '../../components/ui/OnlinePlayersPanel'
import { useOnlinePlayers } from '../../lib/useOnlinePlayers'

function formatDayLabel(dateStr) {
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (dateStr === today) return "Aujourd'hui"
  if (dateStr === yesterday) return 'Hier'
  return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })
}

function formatDateLine(dateStr) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

const DIFF_LABEL = { facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile' }
const DIFF_COLOR_CLASS = { facile: 'spill--teal', moyen: 'spill--amber', difficile: 'spill--coral' }

function statusLabel(playInfo) {
  if (!playInfo) return 'Non joué'
  if (playInfo.completed) return 'Terminé'
  return 'En cours'
}

export default function HubPage() {
  const { user, markTourDone } = useAuthStore()
  const navigate = useNavigate()
  const today = new Date().toISOString().split('T')[0]
  const hasForfeited = localStorage.getItem(`orienta_create_forfeit_${user?.id}`) === today

  const [grids, setGrids] = useState([])
  const [createdGrid, setCreatedGrid] = useState(null)
  const [playsMap, setPlaysMap] = useState(new Map())
  const [hasCreatedToday, setHasCreatedToday] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dailyGrids, setDailyGrids] = useState([])
  const [showAllCommunity, setShowAllCommunity] = useState(false)
  const [communitySort, setCommunitySort] = useState('recent') // 'recent' | 'best' | 'unplayed'
  const [livePlayStats, setLivePlayStats] = useState(null)
  const [pendingGrant, setPendingGrant] = useState(null)   // droit de créer la grille du jour (gagnant)
  const [showWinnerModal, setShowWinnerModal] = useState(false)

  // Présence temps réel : qui est connecté sur le hub en ce moment.
  // Panneau affiché (desktop only) uniquement s'il y a au moins un AUTRE joueur.
  const onlinePlayers = useOnlinePlayers(user)
  const showOnlinePanel = onlinePlayers.some(p => p.id !== user?.id)

  useEffect(() => {
    if (!user) return
    const fetchData = async () => {
      const now = new Date().toISOString()
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayDate = now.split('T')[0]
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

      const [{ data: activeGrids }, { data: plays }, { data: todayGrid }, { data: dailyGridData }, { data: grantData }] = await Promise.all([
        supabase
          .from('orienta_grids')
          .select('*, orienta_users(pseudo, selected_skin), orienta_plays(success, player_id, completed_at)')
          .eq('status', 'published')
          .is('daily_date', null)
          .is('daily_status', null)   // exclut les grilles de réserve (piste quotidienne, sans date)
          .order('created_at', { ascending: false }),

        supabase
          .from('orienta_plays')
          .select('grid_id, completed_at, attempts_count')
          .eq('player_id', user.id),

        supabase
          .from('orienta_grids')
          .select('*, orienta_users(pseudo), orienta_plays(success, player_id, completed_at, attempts_count)')
          .eq('creator_id', user.id)
          .is('daily_date', null)
          .is('daily_status', null)
          .gte('created_at', todayStart.toISOString())
          .limit(1)
          .single(),

        supabase
          .from('orienta_grids')
          .select('*, orienta_users(pseudo, is_system), orienta_plays(player_id, success, score, completed_at, orienta_users(pseudo))')
          .eq('status', 'published')
          .gte('daily_date', sevenDaysAgo)
          .lte('daily_date', todayDate)
          .order('daily_date', { ascending: false }),

        supabase
          .from('orienta_grid_grants')
          .select('id, target_date, source_date, status, onboarding_seen_at')
          .eq('winner_user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      // Un joueur peut avoir plusieurs rows de play sur une même grille (doublons en base).
      // On fusionne par grid_id : une partie terminée ne doit JAMAIS être écrasée par un
      // doublon non terminé, sinon le statut « Terminé » (et le déblocage communauté) saute.
      const playsById = new Map()
      for (const p of plays ?? []) {
        const prev = playsById.get(p.grid_id)
        playsById.set(p.grid_id, {
          completed: (prev?.completed ?? false) || !!p.completed_at,
          attemptsCount: Math.max(prev?.attemptsCount ?? 0, p.attempts_count ?? 0),
        })
      }
      setGrids(activeGrids ?? [])
      setPlaysMap(playsById)
      setDailyGrids(dailyGridData ?? [])
      if (todayGrid && todayGrid.id) {
        setCreatedGrid(todayGrid)
        setHasCreatedToday(true)
      }
      setPendingGrant(grantData ?? null)
      if (grantData && !grantData.onboarding_seen_at) setShowWinnerModal(true)
      setLoading(false)
    }
    fetchData()
  }, [user])

  const utcToday = new Date().toISOString().split('T')[0]
  const todayDaily = dailyGrids.find(g => g.daily_date === utcToday)

  useEffect(() => {
    if (!todayDaily?.id) return

    const plays = todayDaily.orienta_plays ?? []
    setLivePlayStats({ total: plays.length, successful: plays.filter(p => p.success).length })

    const channel = supabase
      .channel(`daily-plays-${todayDaily.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orienta_plays', filter: `grid_id=eq.${todayDaily.id}` },
        async () => {
          const { data } = await supabase
            .from('orienta_plays')
            .select('success')
            .eq('grid_id', todayDaily.id)
          if (data) setLivePlayStats({ total: data.length, successful: data.filter(p => p.success).length })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [todayDaily?.id])
  const archiveDailies = dailyGrids.filter(g => g.daily_date !== utcToday)

  const dailyTop3 = todayDaily
    ? [...(todayDaily.orienta_plays ?? [])]
        .filter(p => p.success && p.score != null && p.completed_at)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
    : []

  const myDailyPlay = todayDaily
    ? (todayDaily.orienta_plays ?? []).find(p => p.player_id === user?.id && p.completed_at)
    : null

  const myDailyRank = myDailyPlay
    ? (todayDaily.orienta_plays ?? [])
        .filter(p => p.success && p.score != null && p.completed_at)
        .filter(p => p.score > (myDailyPlay.score ?? 0)).length + 1
    : null

  const myInTop3 = dailyTop3.some(p => p.player_id === user?.id)

  const twoDaysAgoDate = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0]
  const todayDate = new Date().toISOString().split('T')[0]
  const todaysCommunityGrids = grids.filter(g => g.created_at.split('T')[0] === todayDate)

  const communityGroups = (() => {
    const map = {}
    for (const grid of grids) {
      const date = grid.created_at.split('T')[0]
      if (!map[date]) map[date] = []
      map[date].push(grid)
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a))
  })()

  const recentGroups = communityGroups.filter(([date]) => date >= twoDaysAgoDate)
  const olderGroups = communityGroups.filter(([date]) => date < twoDaysAgoDate)
  const visibleGroups = showAllCommunity ? communityGroups : recentGroups

  // Tri "meilleures" — toutes les grilles à plat, par upvotes décroissants
  const bestGrids = [...grids].sort(
    (a, b) => (b.upvotes_count ?? 0) - (a.upvotes_count ?? 0) || b.created_at.localeCompare(a.created_at)
  )

  // Filtre "jamais jouées" — grilles que le joueur n'a pas terminées : aucune partie enregistrée
  // OU partie en cours (non terminée). Une grille en cours reste à finir, donc on la garde.
  // On exclut ses propres grilles : on n'y joue jamais, elles n'ont pas leur place ici.
  // grids est déjà trié par created_at décroissant.
  const unplayedGrids = grids.filter(g => g.creator_id !== user?.id && !playsMap.get(g.id)?.completed)

  // Communauté débloquée dès que le joueur a terminé sa 1ʳᵉ grille (gagnée ou perdue),
  // qu'elle soit du jour ou des jours passés. playsMap contient toutes ses plays.
  const hasCompletedAnyGrid = [...playsMap.values()].some(v => v.completed)
  const showRevealBanner = hasCompletedAnyGrid && !!user && !user.community_unlocked_seen
  const dismissReveal = () => { if (!user?.community_unlocked_seen) markTourDone('community_unlocked_seen') }

  const dailyPlayInfo = todayDaily ? (playsMap.get(todayDaily.id) ?? null) : null
  const totalDailyPlayers = livePlayStats?.total ?? (todayDaily ? (todayDaily.orienta_plays ?? []).length : 0)
  const successfulDailyPlays = livePlayStats?.successful ?? (todayDaily ? (todayDaily.orienta_plays ?? []).filter(p => p.success).length : 0)
  const dailySuccessRate = totalDailyPlayers > 0 ? Math.round((successfulDailyPlays / totalDailyPlayers) * 100) : null

  // Crédit créateur : uniquement pour une grille du jour issue d'un JOUEUR (pas du compte système / réserve).
  const dailyCreator = todayDaily?.orienta_users?.is_system === false
    ? todayDaily.orienta_users.pseudo
    : null

  const hasCompletedDaily = !!myDailyPlay
  const hasSucceededDaily = myDailyPlay?.success === true
  const statusSpillClass = hasSucceededDaily ? 'hub-spill--teal' : hasCompletedDaily ? 'hub-spill--coral' : ''
  const statusText = hasSucceededDaily ? 'Terminé ✓' : hasCompletedDaily ? 'Échoué' : statusLabel(dailyPlayInfo)

  return (
    <div className="hub-page">
      <Header />
      <div className={`hub-shell${showOnlinePanel ? ' hub-shell--with-panel' : ''}`}>
      <main className="hub-main">

        {/* Bannière « tu as gagné » — droit de créer la grille du jour (persistante jusqu'au claim) */}
        {pendingGrant && (
          <Link to={`/create?grant=${pendingGrant.id}`} className="hub-grant-banner">
            <span className="hub-grant-banner-emoji">🏆</span>
            <span className="hub-grant-banner-body">
              <strong>Tu as gagné&nbsp;!</strong> À toi de créer la grille du jour du {formatDateLine(pendingGrant.target_date)}.
            </span>
            <span className="hub-grant-banner-cta">Créer ma grille →</span>
          </Link>
        )}

        {/* ===== PARTIE 01 — LA GRILLE DU JOUR ===== */}
        <section className="hub-part">
          <div className="hub-part-head">
            <span className="hub-kick"><span className="hub-kick-num">01</span>La grille du jour</span>
            <span className="hub-kick-rule" />
            {todayDaily && (
              <span className="hub-dateline">
                <span className="hub-dateline-no">
                  {todayDaily.edition_number ? `Édition N°${todayDaily.edition_number}` : 'Challenge du jour'}
                </span>
                <span className="hub-dateline-sep" />
                {formatDateLine(todayDaily.daily_date)}
              </span>
            )}
          </div>

          {loading ? (
            <div className="hub-loading">
              <div className="grid-card-skeleton" style={{ height: 320 }} />
            </div>
          ) : todayDaily ? (
            <div className="hub-hero">
              {/* Carte hero gauche */}
              <div className="hub-hero-card">
                <div className="hub-eyebrow">
                  <span className="hub-eyebrow-dot" />
                  Challenge du jour
                </div>
                <h1 className="hub-hero-title">La grille<br />du jour</h1>
                <p className="hub-hero-p">
                  Faites pivoter les quatre cartes, suivez les indices et placez tout juste.
                  Une nouvelle grille chaque matin.
                </p>
                {dailyCreator && (
                  <div className="hub-creator-credit">
                    <span className="hub-creator-credit-icon">✍️</span>
                    Grille créée par <strong>{dailyCreator}</strong>
                  </div>
                )}
                <div className="hub-stat-row">
                  <div className={`hub-spill ${statusSpillClass}`}>
                    <span className="hub-spill-k">Statut</span>
                    <span className="hub-spill-v">{statusText}</span>
                  </div>
                  <div className={`hub-spill ${DIFF_COLOR_CLASS[todayDaily.difficulty] ?? 'hub-spill--teal'}`}>
                    <span className="hub-spill-k">Niveau</span>
                    <span className="hub-spill-v">{DIFF_LABEL[todayDaily.difficulty] ?? '—'}</span>
                  </div>
                  {hasCompletedDaily ? (
                    <>
                      <div className="hub-spill">
                        <span className="hub-spill-k">Ton score</span>
                        <span className="hub-spill-v">{myDailyPlay.score ?? 0}<span className="hub-spill-unit"> pts</span></span>
                      </div>
                      <div className="hub-spill">
                        <span className="hub-spill-k">Ton rang</span>
                        <span className="hub-spill-v">{hasSucceededDaily && myDailyRank ? `#${myDailyRank}` : '—'}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="hub-spill">
                        <span className="hub-spill-k hub-spill-k--live"><span className="hub-ldot" />Joueurs</span>
                        <span className="hub-spill-v">{totalDailyPlayers}</span>
                      </div>
                      <div className="hub-spill">
                        <span className="hub-spill-k hub-spill-k--live"><span className="hub-ldot" />Réussite</span>
                        <span className="hub-spill-v">{dailySuccessRate !== null ? `${dailySuccessRate}%` : '—'}</span>
                      </div>
                    </>
                  )}
                </div>
                <div className={`hub-actions${hasCompletedDaily ? ' hub-actions--done' : ''}`}>
                  {hasCompletedDaily ? (
                    <>
                      {archiveDailies.length > 0 && (
                        <Link to="/daily-archives" className="hub-btn-secondary">
                          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                          Grilles précédentes ({archiveDailies.length})
                        </Link>
                      )}
                      <button className="hub-ghost-link" onClick={() => navigate(`/dashboard/${todayDaily.id}`)} type="button">
                        Statistiques du jour →
                      </button>
                    </>
                  ) : (
                    <>
                      <Link to={`/play/${todayDaily.id}`} className="hub-btn-play">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                        Jouer la grille
                      </Link>
                      {archiveDailies.length > 0 && (
                        <button className="hub-ghost-link" onClick={() => navigate('/daily-archives')} type="button">
                          Grilles précédentes ({archiveDailies.length}) →
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Bloc vidéo / animation droite */}
              <aside className="hub-stage">
                <div className="hub-media">
                  <div className="hub-media-top">
                    <span className="hub-media-kind">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="23 7 16 12 23 17 23 7"/>
                        <rect x="1" y="5" width="15" height="14" rx="2"/>
                      </svg>
                      Découvrir le jeu
                    </span>
                    <span className="hub-media-live">
                      <span className="hub-ldot" />
                      En boucle
                    </span>
                  </div>
                  <div className="hub-media-center">
                    <img
                      src="/orienta_motion_design.gif"
                      alt="Animation tutoriel : les cartes d'une grille Orienta pivotent jusqu'à la résolution"
                      className="hub-demo-gif"
                      loading="lazy"
                      decoding="async"
                      width="720"
                      height="720"
                    />
                  </div>
                  <div className="hub-media-info">
                    <h3>Une grille. Chaque jour.<br />Avec tout le monde.</h3>
                    <p>Tournez les cartes, suivez les indices, résolvez la grille.</p>
                  </div>
                </div>
              </aside>
            </div>
          ) : (
            <div className="daily-empty-state">
              <div className="daily-empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </div>
              <h3 className="daily-empty-title">Pas de challenge aujourd'hui</h3>
              <p className="daily-empty-text">En attente du prochain défi. Reviens plus tard ou rejoue les challenges précédents !</p>
              {archiveDailies.length > 0 && (
                <button className="btn-secondary" onClick={() => navigate('/daily-archives')} type="button">
                  Voir les challenges précédents
                </button>
              )}
            </div>
          )}

          {/* Classement du jour */}
          {!loading && todayDaily && (
            <div className="hub-rank-panel">
              <div className="hub-rank-head">
                <div>
                  <h2 className="hub-rank-title">Classement du jour</h2>
                  <p className="hub-rank-sub">Les meilleurs scores sur la grille d'aujourd'hui</p>
                  <p className="hub-rank-reward">🏆 Le 1ᵉʳ du classement gagne le droit de créer la grille du jour du {formatDateLine(new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0])}.</p>
                </div>
                {hasCompletedDaily && (
                  <button className="hub-rank-see" onClick={() => navigate(`/dashboard/${todayDaily.id}`)} type="button">Tout voir</button>
                )}
              </div>
              {dailyTop3.length === 0 ? (
                <div className="daily-lb-empty">
                  <div className="daily-lb-empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M6 9H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3"/>
                      <path d="M18 9h3a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-3"/>
                      <path d="M6 4h12v8a6 6 0 0 1-12 0V4Z"/>
                      <path d="M12 18v4"/><path d="M8 22h8"/>
                    </svg>
                  </div>
                  <p className="daily-lb-empty-text">Aucun joueur n'a encore terminé le challenge.</p>
                  <p className="daily-lb-empty-cta">Sois le premier !</p>
                </div>
              ) : (
                <ol className="hub-rank-row">
                  {dailyTop3.map((p, i) => (
                    <li key={i} className={`hub-rank-item${p.player_id === user?.id ? ' hub-rank-item--me' : ''}`}>
                      <span className="hub-rank-medal hub-rank-medal--gold" style={i === 1 ? { background: 'linear-gradient(135deg,#c3c9d1,#9aa3ad)' } : i === 2 ? { background: 'linear-gradient(135deg,#dfa074,#c07d4d)' } : {}}>
                        {i + 1}
                      </span>
                      <span className="hub-rank-meta">
                        <span className="hub-rank-nm">{p.orienta_users?.pseudo ?? '?'}</span>
                        <span className="hub-rank-pt">{p.score} <span>pts</span></span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              {myDailyPlay && !myInTop3 && (
                <div className="hub-rank-me">
                  <span className="hub-rank-medal" style={{ background: 'var(--bg-tint)', color: 'var(--ink-2)', fontSize: '13px' }}>#{myDailyRank}</span>
                  <span className="hub-rank-meta">
                    <span className="hub-rank-nm">{user?.pseudo}</span>
                    <span className="hub-rank-pt">{myDailyPlay.score ?? 0} <span>pts</span></span>
                  </span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ===== PARTIE 02 — LA COMMUNAUTÉ ===== */}
        {/* Masquée tant que le joueur n'a pas terminé sa 1ʳᵉ grille (anti-flash via !loading) */}
        {!loading && (
        <section className="hub-part hub-part-2">
          <div className="hub-part-head">
            <span className="hub-kick"><span className="hub-kick-num">02</span>La communauté</span>
            <span className="hub-kick-rule" />
          </div>

          {!hasCompletedAnyGrid ? (
          /* État A — verrouillé : teaser d'onboarding */
          <div className="hub-community-teaser">
            <div className="hub-community-teaser-lock">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h3 className="hub-create-title">La communauté est verrouillée</h3>
            <p className="hub-create-desc">Termine ta première grille — celle du jour ou une des jours passés — pour débloquer les créations de la communauté et proposer les tiennes.</p>
          </div>
          ) : (
          <>
          {/* État B — révélation : on accompagne le joueur vers la création */}
          {showRevealBanner && (
            <div className="hub-reveal-banner">
              <button className="hub-reveal-close" onClick={dismissReveal} type="button" aria-label="Fermer">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
              </button>
              <div className="hub-reveal-emoji">🎉</div>
              <div className="hub-reveal-body">
                <h3 className="hub-reveal-title">Bravo pour ta première grille&nbsp;!</h3>
                <p className="hub-reveal-text">Ça t'a plu de résoudre une grille&nbsp;? Maintenant, à toi de créer la tienne et de la soumettre aux autres joueurs.</p>
              </div>
              <Link to="/create" className="hub-btn-create" onClick={dismissReveal}>
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Créer ma grille
              </Link>
            </div>
          )}

          {/* Créer ma grille */}
          {createdGrid ? (
            <div className="my-grid-card-container">
              <CreatedGridCard grid={createdGrid} index={0} />
            </div>
          ) : hasForfeited ? (
            <div className="hub-create-block hub-create-block--disabled">
              <div>
                <div className="hub-eyebrow" style={{ marginBottom: 8 }}><span className="hub-eyebrow-dot" /> Ma grille</div>
                <h3 className="hub-create-title">Tu as loupé la création du jour</h3>
                <p className="hub-create-desc">Tu as abandonné une grille chronométrée. Reviens demain !</p>
              </div>
              <span className="hub-btn-create hub-btn-create--disabled">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Créer ma grille
              </span>
            </div>
          ) : (
            <div className="hub-create-block">
              <div>
                <div className="hub-eyebrow" style={{ marginBottom: 8 }}><span className="hub-eyebrow-dot" /> Ma grille</div>
                <h3 className="hub-create-title">Vous n'avez pas encore créé votre grille</h3>
                <p className="hub-create-desc">Composez la vôtre et défiez la communauté dès aujourd'hui.</p>
              </div>
              <Link to="/create" className="hub-btn-create">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Créer ma grille
              </Link>
            </div>
          )}

          {/* Grilles des autres joueurs */}
          <div className="hub-sec-head">
            <h2>Grilles des autres joueurs</h2>
            {!loading && grids.length > 0 && (
              <div className="community-sort" role="tablist" aria-label="Trier les grilles">
                <button
                  type="button"
                  role="tab"
                  aria-selected={communitySort === 'recent'}
                  className={`community-sort-btn${communitySort === 'recent' ? ' is-active' : ''}`}
                  onClick={() => setCommunitySort('recent')}
                >
                  🕐 Plus récentes
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={communitySort === 'best'}
                  className={`community-sort-btn${communitySort === 'best' ? ' is-active' : ''}`}
                  onClick={() => setCommunitySort('best')}
                >
                  🔥 Meilleures
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={communitySort === 'unplayed'}
                  className={`community-sort-btn${communitySort === 'unplayed' ? ' is-active' : ''}`}
                  onClick={() => setCommunitySort('unplayed')}
                >
                  ✨ Jamais jouées
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="hub-loading">
              {[1, 2, 3, 4].map(i => <div key={i} className="grid-card-skeleton" style={{ height: 160 }} />)}
            </div>
          ) : grids.length === 0 ? (
            <div className="community-empty-state">
              <div className="community-empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 16v-4"/><path d="M12 8h.01"/>
                </svg>
              </div>
              <h3 className="community-empty-title">Aucune grille cette semaine</h3>
              <p className="community-empty-text">La communauté attend tes créations ! Sois le premier à proposer une grille.</p>
              <Link to="/create" className="btn-primary">Créer ma grille</Link>
            </div>
          ) : communitySort === 'best' ? (
            <div className="cards-grid">
              {bestGrids.map((grid, i) => (
                <GridCard
                  key={grid.id}
                  grid={grid}
                  playInfo={playsMap.get(grid.id) ?? null}
                  index={i}
                  isOwnGrid={grid.creator_id === user?.id}
                />
              ))}
            </div>
          ) : communitySort === 'unplayed' ? (
            unplayedGrids.length === 0 ? (
              <div className="community-empty-state">
                <div className="community-empty-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="m9 12 2 2 4-4"/>
                  </svg>
                </div>
                <h3 className="community-empty-title">Tu as joué toutes les grilles !</h3>
                <p className="community-empty-text">Bravo, tu as fait le tour de la communauté. Reviens plus tard pour de nouvelles grilles.</p>
              </div>
            ) : (
              <div className="cards-grid">
                {unplayedGrids.map((grid, i) => (
                  <GridCard
                    key={grid.id}
                    grid={grid}
                    playInfo={playsMap.get(grid.id) ?? null}
                    index={i}
                    isOwnGrid={grid.creator_id === user?.id}
                  />
                ))}
              </div>
            )
          ) : (
            <>
              {todaysCommunityGrids.length === 0 && (
                <div className="community-no-today"><p>Aucune grille créée aujourd'hui</p></div>
              )}
              <div className="community-groups">
                {visibleGroups.map(([date, dateGrids]) => (
                  <div key={date} className="community-group">
                    <h3 className="community-group-date">{formatDayLabel(date)}</h3>
                    <div className="cards-grid">
                      {dateGrids.map((grid, i) => (
                        <GridCard
                          key={grid.id}
                          grid={grid}
                          playInfo={playsMap.get(grid.id) ?? null}
                          index={i}
                          isOwnGrid={grid.creator_id === user?.id}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                {!showAllCommunity && olderGroups.length > 0 && (
                  <button className="community-show-more" onClick={() => setShowAllCommunity(true)} type="button">
                    Voir plus — {olderGroups.reduce((n, [, g]) => n + g.length, 0)} grille{olderGroups.reduce((n, [, g]) => n + g.length, 0) > 1 ? 's' : ''} plus ancienne{olderGroups.reduce((n, [, g]) => n + g.length, 0) > 1 ? 's' : ''}
                  </button>
                )}
              </div>
            </>
          )}
          </>
          )}
        </section>
        )}
      </main>

      {showOnlinePanel && (
        <OnlinePlayersPanel players={onlinePlayers} currentUserId={user?.id} />
      )}
      </div>

      {showWinnerModal && pendingGrant && (
        <WinnerWelcomeModal grant={pendingGrant} onClose={() => setShowWinnerModal(false)} />
      )}
    </div>
  )
}
