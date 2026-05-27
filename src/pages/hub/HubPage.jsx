import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import Header from '../../components/ui/Header'
import CollectiveGauge from '../../components/ui/CollectiveGauge'
import GridCard from '../../components/ui/GridCard'

export default function HubPage() {
  const { user } = useAuthStore()
  const [grids, setGrids] = useState([])
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
          .select('*, orienta_users(pseudo), orienta_plays(success, player_id)')
          .eq('status', 'published')
          .gt('expires_at', now)
          .order('created_at', { ascending: false }),

        supabase
          .from('orienta_plays')
          .select('grid_id')
          .eq('player_id', user.id),

        supabase
          .from('orienta_grids')
          .select('id')
          .eq('creator_id', user.id)
          .gte('created_at', todayStart.toISOString())
          .limit(1),
      ])

      setGrids(activeGrids ?? [])
      setPlayedGridIds(new Set((plays ?? []).map(p => p.grid_id)))
      setHasCreatedToday((todayGrid ?? []).length > 0)
      setLoading(false)
    }
    fetchData()
  }, [user])

  return (
    <div className="hub-page">
      <Header />
      <main className="hub-main">
        <CollectiveGauge />

        <section className="hub-section">
          <div className="hub-section-header">
            <h2>Grilles du jour</h2>
            <Link
              to="/create"
              className={`btn-primary hub-create-btn ${hasCreatedToday ? 'btn-primary--disabled' : ''}`}
              onClick={e => hasCreatedToday && e.preventDefault()}
              aria-disabled={hasCreatedToday}
            >
              {hasCreatedToday ? 'Grille créée ✓' : '+ Créer une grille'}
            </Link>
          </div>

          {loading ? (
            <div className="hub-loading">
              {[1, 2, 3].map(i => <div key={i} className="grid-card-skeleton" />)}
            </div>
          ) : grids.length === 0 ? (
            <div className="hub-empty">
              <p>Aucune grille aujourd'hui — sois le premier à en créer une !</p>
            </div>
          ) : (
            <div className="grid-list">
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
