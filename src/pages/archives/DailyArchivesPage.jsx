import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import Header from '../../components/ui/Header'
import GridCard from '../../components/ui/GridCard'

function formatDayLabel(dateStr) {
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (dateStr === today) return "Aujourd'hui"
  if (dateStr === yesterday) return 'Hier'
  return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })
}

export default function DailyArchivesPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

  const [dailyGrids, setDailyGrids] = useState([])
  const [playsMap, setPlaysMap] = useState(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetchData = async () => {
      const { data: dailyGridData } = await supabase
        .from('orienta_grids')
        .select('*, orienta_users(pseudo, selected_skin), orienta_plays(player_id, success, score, completed_at, orienta_users(pseudo))')
        .eq('status', 'published')
        .gte('daily_date', sevenDaysAgo)
        .lte('daily_date', today)
        .order('daily_date', { ascending: false })

      const { data: plays } = await supabase
        .from('orienta_plays')
        .select('grid_id, completed_at, attempts_count')
        .eq('player_id', user.id)

      // Un joueur peut avoir plusieurs rows de play sur une même grille (doublons
      // en base). On fusionne par grid_id : une partie terminée ne doit JAMAIS être
      // écrasée par un doublon non terminé (sinon le statut « Terminé » saute, cf. HubPage).
      const playsById = new Map()
      for (const p of plays ?? []) {
        const prev = playsById.get(p.grid_id)
        playsById.set(p.grid_id, {
          completed: (prev?.completed ?? false) || !!p.completed_at,
          attemptsCount: Math.max(prev?.attemptsCount ?? 0, p.attempts_count ?? 0),
        })
      }
      setDailyGrids(dailyGridData ?? [])
      setPlaysMap(playsById)
      setLoading(false)
    }
    fetchData()
  }, [user])

  const archiveGroups = (() => {
    const map = {}
    for (const grid of dailyGrids) {
      const date = grid.daily_date
      if (!map[date]) map[date] = []
      map[date].push(grid)
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a))
  })()

  return (
    <div className="hub-page">
      <Header />
      <main className="hub-main archives-main">
        <div className="archives-header">
          <button className="archives-back" onClick={() => navigate('/')} type="button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Retour au hub
          </button>
          <h1 className="archives-title">Challenges passés</h1>
          <p className="archives-subtitle">Rejoue les défis des derniers jours, ou consulte les statistiques de ceux que tu as terminés</p>
        </div>

        {loading ? (
          <div className="hub-loading">
            {[1, 2, 3].map(i => <div key={i} className="grid-card-skeleton" />)}
          </div>
        ) : archiveGroups.length === 0 ? (
          <div className="empty-state">
            <p>Aucun challenge précédent pour le moment.</p>
          </div>
        ) : (
          <div className="cards-grid">
            {dailyGrids.map((grid, i) => (
              <div key={grid.id} className="daily-archive-card-wrapper">
                <span className="daily-archive-card-date">{formatDayLabel(grid.daily_date)}</span>
                <GridCard
                  grid={grid}
                  playInfo={playsMap.get(grid.id) ?? null}
                  index={i}
                  isDaily
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
