import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import Header from '../../components/ui/Header'
import CollectiveGauge from '../../components/ui/CollectiveGauge'
import GridCard from '../../components/ui/GridCard'
import CreatedGridCard from '../../components/ui/CreatedGridCard'

function formatDayLabel(dateStr) {
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (dateStr === today) return "Aujourd'hui"
  if (dateStr === yesterday) return 'Hier'
  return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })
}

function SectionTitle({ children, tip }) {
  return (
    <h2 className="section-title">
      {children}
      <span className="section-tip" data-tip={tip}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </span>
    </h2>
  )
}

export default function HubPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const today = new Date().toISOString().split('T')[0]
  const hasForfeited = localStorage.getItem(`orienta_create_forfeit_${user?.id}`) === today

  const [grids, setGrids] = useState([])
  const [createdGrid, setCreatedGrid] = useState(null)
  const [playsMap, setPlaysMap] = useState(new Map())
  const [hasCreatedToday, setHasCreatedToday] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dailyGrids, setDailyGrids] = useState([])
  const [dailyPlaysMap, setDailyPlaysMap] = useState(new Map())
  const [showAllCommunity, setShowAllCommunity] = useState(false)

  useEffect(() => {
    if (!user) return
    const fetchData = async () => {
      const now = new Date().toISOString()
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const todayDate = now.split('T')[0]
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

    const [{ data: activeGrids }, { data: plays }, { data: todayGrid }, { data: dailyGridData }] = await Promise.all([
        supabase
          .from('orienta_grids')
          .select('*, orienta_users(pseudo, selected_skin), orienta_plays(success, player_id, completed_at)')
          .eq('status', 'published')
          .is('daily_date', null)
          .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
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
          .gte('created_at', todayStart.toISOString())
          .limit(1)
          .single(),

        supabase
          .from('orienta_grids')
          .select('*, orienta_users(pseudo), orienta_plays(player_id, success, score, completed_at, orienta_users(pseudo))')
          .eq('status', 'published')
          .gte('daily_date', sevenDaysAgo)
          .lte('daily_date', todayDate)
          .order('daily_date', { ascending: false }),
      ])

      const playsById = new Map((plays ?? []).map(p => [p.grid_id, { completed: !!p.completed_at, attemptsCount: p.attempts_count ?? 0 }]))
      setGrids(activeGrids ?? [])
      setPlaysMap(playsById)
      setDailyGrids(dailyGridData ?? [])
      setDailyPlaysMap(playsById)
      if (todayGrid && todayGrid.id) {
        setCreatedGrid(todayGrid)
        setHasCreatedToday(true)
      }
      setLoading(false)
    }
    fetchData()
  }, [user])

  const utcToday = new Date().toISOString().split('T')[0]
  const todayDaily = dailyGrids.find(g => g.daily_date === utcToday)
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

  return (
    <div className="hub-page">
      <Header />
      <main className="hub-main">

        {/* Ligne 1 — Challenge journalier */}
        <section>
          <SectionTitle tip="La grille du jour, commune à tous les joueurs. Résous-la pour marquer des points et grimper au classement.">Challenge journalier</SectionTitle>
          {loading ? (
            <div className="hub-loading"><div className="grid-card-skeleton" /></div>
          ) : todayDaily ? (
            <div className="daily-challenge-layout">
              <div className="daily-challenge-card">
                <GridCard
                  grid={todayDaily}
                  playInfo={dailyPlaysMap.get(todayDaily.id) ?? null}
                  index={0}
                  isDaily
                />
              </div>
              <div className="daily-challenge-side">
                <div className="daily-lb">
                  <div className="daily-lb-header">
                    <svg className="daily-lb-trophy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3"/>
                      <path d="M18 9h3a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-3"/>
                      <path d="M6 4h12v8a6 6 0 0 1-12 0V4Z"/>
                      <path d="M12 18v4"/>
                      <path d="M8 22h8"/>
                    </svg>
                    <span className="daily-lb-title">Classement du jour</span>
                  </div>

                  {dailyTop3.length === 0 ? (
                    <div className="daily-lb-empty">
                      <div className="daily-lb-empty-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 9H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3"/>
                          <path d="M18 9h3a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-3"/>
                          <path d="M6 4h12v8a6 6 0 0 1-12 0V4Z"/>
                          <path d="M12 18v4"/>
                          <path d="M8 22h8"/>
                        </svg>
                      </div>
                      <p className="daily-lb-empty-text">Aucun joueur n'a encore terminé le challenge aujourd'hui.</p>
                      <p className="daily-lb-empty-cta">Sois le premier !</p>
                    </div>
                  ) : (
                    <ol className="daily-lb-list">
                      {dailyTop3.map((p, i) => (
                        <li key={i} className={`daily-lb-row${p.player_id === user?.id ? ' daily-lb-row--me' : ''}`}>
                          <span className={`daily-lb-rank daily-lb-rank--${i + 1}`}>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                          </span>
                          <span className="daily-lb-name">{p.orienta_users?.pseudo ?? '?'}</span>
                          <span className="daily-lb-score">{p.score} pts</span>
                        </li>
                      ))}
                    </ol>
                  )}

                  {myDailyPlay && !myInTop3 && (
                    <>
                      <div className="daily-lb-separator">···</div>
                      <div className="daily-lb-row daily-lb-row--me">
                        <span className="daily-lb-rank">#{myDailyRank}</span>
                        <span className="daily-lb-name">{user?.pseudo}</span>
                        <span className="daily-lb-score">{myDailyPlay.score ?? 0} pts</span>
                      </div>
                    </>
                  )}
                </div>

                {archiveDailies.length > 0 && (
                  <button
                    className="daily-archives-link"
                    onClick={() => navigate('/daily-archives')}
                    type="button"
                  >
                    Grilles précédentes ({archiveDailies.length}) →
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="daily-empty-state">
              <div className="daily-empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </div>
              <h3 className="daily-empty-title">Pas de challenge aujourd'hui</h3>
              <p className="daily-empty-text">En attente du prochain défi. Reviens plus tard ou rejoue les challenges précédents !</p>
              {archiveDailies.length > 0 && (
                <button
                  className="btn-secondary"
                  onClick={() => navigate('/daily-archives')}
                  type="button"
                >
                  Voir les challenges précédents
                </button>
              )}
            </div>
          )}
        </section>

        {/* Ligne 2 — Progression Collective + Ma grille */}
        <div className="top-sections">
          <section>
            <SectionTitle tip="Chaque partie jouée fait avancer toute la communauté. Montez ensemble pour débloquer de nouvelles créatures !">Progression Collective</SectionTitle>
            <CollectiveGauge />
          </section>

          <section>
            <SectionTitle tip="Crée une grille par jour pour faire jouer la communauté et gagner de l'XP à chaque réussite.">Ma grille</SectionTitle>
            {createdGrid ? (
              <div className="my-grid-card-container">
                <CreatedGridCard grid={createdGrid} index={0} />
              </div>
            ) : hasForfeited ? (
              <div className="my-grid-section">
                <div className="my-grid-empty">
                  <h3>Tu as loupé la création du jour</h3>
                  <p className="my-grid-forfeit-hint">Tu as abandonné une grille chronométrée. Reviens demain pour une nouvelle chance !</p>
                  <span className="create-grid-btn create-grid-btn--disabled">+ Créer ma grille</span>
                </div>
              </div>
            ) : (
              <div className="my-grid-section">
                <div className="my-grid-empty">
                  <h3>Vous n'avez pas encore créé votre grille du jour</h3>
                  <Link to="/create" className="create-grid-btn">
                    + Créer ma grille
                  </Link>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Ligne 3 — Grilles des autres joueurs */}
        <section className="hub-section--spaced">
          <SectionTitle tip="Les grilles créées par la communauté ces 7 derniers jours. Joue-les pour marquer de l'XP et faire progresser leur créateur.">Grilles des autres joueurs</SectionTitle>

          {loading ? (
            <div className="hub-loading">
              {[1, 2, 3].map(i => <div key={i} className="grid-card-skeleton" />)}
            </div>
          ) : grids.length === 0 ? (
            <div className="community-empty-state">
              <div className="community-empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 16v-4"/>
                  <path d="M12 8h.01"/>
                </svg>
              </div>
              <h3 className="community-empty-title">Aucune grille cette semaine</h3>
              <p className="community-empty-text">La communauté attend tes créations ! Sois le premier à proposer une grille.</p>
              <Link to="/create" className="btn-primary">
                Créer ma grille
              </Link>
            </div>
          ) : (
            <>
              {todaysCommunityGrids.length === 0 && (
                <div className="community-no-today">
                  <p>Aucune grille créée aujourd'hui</p>
                </div>
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
                <button
                  className="community-show-more"
                  onClick={() => setShowAllCommunity(true)}
                  type="button"
                >
                  Voir plus — {olderGroups.reduce((n, [, g]) => n + g.length, 0)} grille{olderGroups.reduce((n, [, g]) => n + g.length, 0) > 1 ? 's' : ''} plus ancienne{olderGroups.reduce((n, [, g]) => n + g.length, 0) > 1 ? 's' : ''}
                </button>
              )}
            </div>
            </>
          )}
        </section>
      </main>
    </div>
  )
}
