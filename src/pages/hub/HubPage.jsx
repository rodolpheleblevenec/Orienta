import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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

export default function HubPage() {
  const { user } = useAuthStore()
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
          .select('*, orienta_users(pseudo), orienta_plays(success, player_id, completed_at)')
          .eq('status', 'published')
          .neq('creator_id', user.id)
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

        {/* Top Sections: Collective Gauge + My Grid */}
        <div className="top-sections">
          {/* Collective Gauge */}
          <section>
            <h2 className="section-title">Progression Collective</h2>
            <CollectiveGauge />
          </section>

          {/* My Grid Section */}
          <section>
            <h2 className="section-title">Ma grille</h2>
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

        {/* Challenge journalier */}
        {(todayDaily || loading) && (
          <section>
            <h2 className="section-title">Challenge journalier</h2>
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
                    <a href="#daily-archives" className="daily-archives-link">
                      Grilles précédentes ({archiveDailies.length}) →
                    </a>
                  )}
                </div>
              </div>
            ) : null}
          </section>
        )}

        {/* Archives — grilles des 7 derniers jours */}
        {archiveDailies.length > 0 && (
          <section id="daily-archives">
            <h2 className="section-title">Grilles précédentes</h2>
            <div className="cards-grid">
              {archiveDailies.map((grid, i) => (
                <div key={grid.id} className="daily-archive-item">
                  <span className="daily-archive-label">{formatDayLabel(grid.daily_date)}</span>
                  <GridCard
                    grid={grid}
                    playInfo={dailyPlaysMap.get(grid.id) ?? null}
                    index={i}
                    isDaily
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Grilles des autres joueurs */}
        <section className="hub-section--spaced">
          <h2 className="section-title">Grilles des autres joueurs</h2>

          {loading ? (
            <div className="hub-loading">
              {[1, 2, 3].map(i => <div key={i} className="grid-card-skeleton" />)}
            </div>
          ) : grids.length === 0 ? (
            <div className="empty-state">
              <p>Aucune grille cette semaine — sois le premier à en créer une !</p>
            </div>
          ) : (
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
          )}
        </section>
      </main>
    </div>
  )
}
