import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import Header from '../../components/ui/Header'
import CollectiveGauge from '../../components/ui/CollectiveGauge'
import GridCard from '../../components/ui/GridCard'
import CreatedGridCard from '../../components/ui/CreatedGridCard'

export default function HubPage() {
  const { user } = useAuthStore()
  const [grids, setGrids] = useState([])
  const [createdGrid, setCreatedGrid] = useState(null)
  const [playedGridIds, setPlayedGridIds] = useState(new Set())
  const [hasCreatedToday, setHasCreatedToday] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetchData = async () => {
      const now = new Date().toISOString()
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const [{ data: activeGrids }, { data: plays }, { data: todayGrid }] = await Promise.all([
        supabase
          .from('orienta_grids')
          .select('*, orienta_users(pseudo), orienta_plays(success, player_id, completed_at)')
          .eq('status', 'published')
          .neq('creator_id', user.id)
          .gt('expires_at', now)
          .order('created_at', { ascending: false }),

        supabase
          .from('orienta_plays')
          .select('grid_id')
          .eq('player_id', user.id),

        supabase
          .from('orienta_grids')
          .select('*, orienta_users(pseudo), orienta_plays(success, player_id, completed_at, attempts_count)')
          .eq('creator_id', user.id)
          .gte('created_at', todayStart.toISOString())
          .limit(1)
          .single(),
      ])

      setGrids(activeGrids ?? [])
      setPlayedGridIds(new Set((plays ?? []).map(p => p.grid_id)))
      if (todayGrid && todayGrid.id) {
        setCreatedGrid(todayGrid)
        setHasCreatedToday(true)
      }
      setLoading(false)
    }
    fetchData()
  }, [user])

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
            {!createdGrid ? (
              <div className="my-grid-section">
                <div className="my-grid-empty">
                  <h3>Vous n'avez pas encore créé votre grille du jour</h3>
                  <Link
                    to="/create"
                    className="create-grid-btn"
                    onClick={e => hasCreatedToday && e.preventDefault()}
                  >
                    + Créer ma grille
                  </Link>
                </div>
              </div>
            ) : (
              <div className="my-grid-card-container">
                <CreatedGridCard grid={createdGrid} index={0} />
              </div>
            )}
          </section>
        </div>

        {/* Grilles du jour */}
        <section>
          <h2 className="section-title">Grilles du jour</h2>

          {loading ? (
            <div className="hub-loading">
              {[1, 2, 3].map(i => <div key={i} className="grid-card-skeleton" />)}
            </div>
          ) : grids.length === 0 ? (
            <div className="empty-state">
              <p>Aucune grille aujourd'hui — sois le premier à en créer une !</p>
            </div>
          ) : (
            <div className="cards-grid">
              {grids.map((grid, i) => (
                <GridCard
                  key={grid.id}
                  grid={grid}
                  played={playedGridIds.has(grid.id)}
                  index={i}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
