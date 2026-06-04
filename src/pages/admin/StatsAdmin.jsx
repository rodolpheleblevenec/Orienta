import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getAdminSecret, clearAdminSecret } from '../../lib/adminSecret'
import BarChart from './BarChart'

const COLORS = {
  active: '#00B899',     // joueurs actifs
  newUsers: '#f2603f',   // nouveaux inscrits
  gridsDaily: '#00B899', // grilles du jour
  gridsCommunity: '#F59E0B', // grilles communauté
}

const KPI_CARDS = [
  { key: 'total_users', label: 'Joueurs inscrits', icon: '👥' },
  { key: 'active_7d', label: 'Actifs (7 j)', icon: '🟢' },
  { key: 'total_grids', label: 'Grilles créées', icon: '📅' },
  { key: 'total_plays', label: 'Parties jouées', icon: '🎯' },
  { key: 'success_rate', label: 'Réussite', icon: '🏆', suffix: '%' },
]

export default function StatsAdmin() {
  const [stats, setStats] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | error

  useEffect(() => { load() }, [])

  async function load() {
    setStatus('loading')
    const { data, error } = await supabase.functions.invoke('admin', {
      body: { admin_secret: getAdminSecret(), action: 'get-stats' },
    })
    if (error || !data || data.error) {
      if (data?.error === 'unauthorized') clearAdminSecret()
      setStatus('error')
      return
    }
    setStats(data)
    setStatus('ready')
  }

  if (status === 'loading') {
    return <div className="admin-suggestions stats-state">Chargement des statistiques…</div>
  }
  if (status === 'error') {
    return (
      <div className="admin-suggestions stats-state">
        <p>Impossible de charger les statistiques.</p>
        <button className="admin-sugg-status" onClick={load} type="button">Réessayer</button>
      </div>
    )
  }

  const { kpis, series } = stats

  return (
    <div className="admin-stats">
      <div className="stats-kpis">
        {KPI_CARDS.map(c => (
          <div key={c.key} className="stats-kpi">
            <span className="stats-kpi-icon">{c.icon}</span>
            <span className="stats-kpi-value">{kpis[c.key] ?? 0}{c.suffix ?? ''}</span>
            <span className="stats-kpi-label">{c.label}</span>
          </div>
        ))}
      </div>

      <div className="stats-panel">
        <h3 className="stats-panel-title">Activité des joueurs / jour</h3>
        <p className="stats-panel-sub">
          Joueurs distincts ayant ouvert l'app, et nouveaux inscrits.
        </p>
        <BarChart
          data={series}
          series={[
            { key: 'active', label: 'Joueurs actifs', color: COLORS.active },
            { key: 'new_users', label: 'Nouveaux inscrits', color: COLORS.newUsers },
          ]}
        />
      </div>

      <div className="stats-panel">
        <h3 className="stats-panel-title">Grilles créées / jour</h3>
        <p className="stats-panel-sub">Grilles du jour (admin) et grilles communauté.</p>
        <BarChart
          stacked
          data={series}
          series={[
            { key: 'grids_daily', label: 'Grille du jour', color: COLORS.gridsDaily },
            { key: 'grids_community', label: 'Communauté', color: COLORS.gridsCommunity },
          ]}
        />
      </div>
    </div>
  )
}
