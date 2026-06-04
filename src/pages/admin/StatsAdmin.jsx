import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getAdminSecret, clearAdminSecret } from '../../lib/adminSecret'
import BarChart from './BarChart'
import BreakdownBar from './BreakdownBar'

const C = {
  accent: '#00B899',
  coral: '#f2603f',
  warning: '#F59E0B',
  indigo: '#6366F1',
  grey: '#9aa1ac',
}

const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const fmtDate = (iso) => iso ? `${parseInt(iso.slice(8, 10), 10)} ${MONTHS_SHORT[parseInt(iso.slice(5, 7), 10) - 1]}` : '—'
const fmtTime = (sec) => {
  if (!sec) return '—'
  const m = Math.floor(sec / 60), s = sec % 60
  return m ? `${m}′${String(s).padStart(2, '0')}″` : `${s}″`
}

const SUBTABS = [
  ['overview', 'Vue d’ensemble'],
  ['grids', 'Grilles'],
  ['retention', 'Rétention'],
  ['onboarding', 'Onboarding'],
  ['community', 'Communauté'],
]

const KPI_CARDS = [
  { key: 'total_users', label: 'Joueurs inscrits', icon: '👥' },
  { key: 'active_7d', label: 'Actifs (7 j)', icon: '🟢' },
  { key: 'total_grids', label: 'Grilles créées', icon: '📅' },
  { key: 'total_plays', label: 'Parties jouées', icon: '🎯' },
  { key: 'success_rate', label: 'Réussite', icon: '🏆', suffix: '%' },
]

function Kpi({ value, label, icon, suffix }) {
  return (
    <div className="stats-kpi">
      <span className="stats-kpi-icon">{icon}</span>
      <span className="stats-kpi-value">{value ?? 0}{suffix ?? ''}</span>
      <span className="stats-kpi-label">{label}</span>
    </div>
  )
}

export default function StatsAdmin() {
  const [stats, setStats] = useState(null)
  const [status, setStatus] = useState('loading')
  const [tab, setTab] = useState('overview')

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

  if (status === 'loading') return <div className="admin-suggestions stats-state">Chargement des statistiques…</div>
  if (status === 'error') return (
    <div className="admin-suggestions stats-state">
      <p>Impossible de charger les statistiques.</p>
      <button className="admin-sugg-status" onClick={load} type="button">Réessayer</button>
    </div>
  )

  return (
    <div className="admin-stats">
      <div className="stats-subtabs">
        {SUBTABS.map(([id, label]) => (
          <button key={id} type="button"
            className={`stats-subtab${tab === id ? ' stats-subtab--active' : ''}`}
            onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'overview' && <Overview stats={stats} />}
      {tab === 'grids' && <Grids stats={stats} />}
      {tab === 'retention' && <Retention stats={stats} />}
      {tab === 'onboarding' && <Onboarding stats={stats} />}
      {tab === 'community' && <Community stats={stats} />}
    </div>
  )
}

/* ───────────────────────── Vue d'ensemble ───────────────────────── */
function Overview({ stats }) {
  const { kpis, series } = stats
  return (
    <>
      <div className="stats-kpis">
        {KPI_CARDS.map(c => <Kpi key={c.key} {...c} value={kpis[c.key]} />)}
      </div>
      <Panel title="Activité des joueurs / jour" sub="Joueurs distincts ayant ouvert l’app, et nouveaux inscrits.">
        <BarChart data={series} series={[
          { key: 'active', label: 'Joueurs actifs', color: C.accent },
          { key: 'new_users', label: 'Nouveaux inscrits', color: C.coral },
        ]} />
      </Panel>
      <Panel title="Grilles créées / jour" sub="Grilles du jour (admin) et grilles communauté.">
        <BarChart stacked data={series} series={[
          { key: 'grids_daily', label: 'Grille du jour', color: C.accent },
          { key: 'grids_community', label: 'Communauté', color: C.warning },
        ]} />
      </Panel>
    </>
  )
}

/* ───────────────────────── Grilles ───────────────────────── */
function Grids({ stats }) {
  const { grids_difficulty, error_breakdown } = stats
  return (
    <>
      <Panel title="Difficulté par grille du jour" sub="Les grilles récentes — repère celles trop dures (réussite basse, beaucoup d’essais ou d’abandons).">
        {grids_difficulty.length === 0 ? <p className="stats-empty">Pas encore de données.</p> : (
          <div className="stats-table-wrap">
            <table className="stats-table">
              <thead>
                <tr><th>Date</th><th>Joueurs</th><th>Réussite</th><th>Temps médian</th><th>Essais moy.</th><th>Abandon</th></tr>
              </thead>
              <tbody>
                {grids_difficulty.map(g => (
                  <tr key={g.grid_id}>
                    <td>{fmtDate(g.date)}</td>
                    <td>{g.players}</td>
                    <td><Pct v={g.success_rate} good /></td>
                    <td>{fmtTime(g.median_time)}</td>
                    <td>{g.avg_attempts}</td>
                    <td><Pct v={g.abandon_rate} bad /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title="Types de réponses (toutes parties)" sub="Sur l’ensemble des cartes jouées : bien placées, bonne carte mais mauvaise orientation, ou à côté.">
        <BreakdownBar segments={[
          { label: 'Bien placées', value: error_breakdown.full, color: C.accent },
          { label: 'Bonne carte, mauvaise rotation', value: error_breakdown.rotation, color: C.warning },
          { label: 'À côté', value: error_breakdown.neither, color: C.coral },
        ]} />
      </Panel>
    </>
  )
}

/* ───────────────────────── Rétention ───────────────────────── */
function Retention({ stats }) {
  const { retention, streak_buckets, days_active_buckets } = stats
  return (
    <>
      <div className="stats-kpis">
        <Kpi icon="📅" label="Actifs aujourd’hui" value={retention.dau} />
        <Kpi icon="🗓️" label="Actifs (7 j)" value={retention.wau} />
        <Kpi icon="🧲" label="Stickiness (DAU/WAU)" value={retention.stickiness} suffix="%" />
        <Kpi icon="↩️" label="Rétention J+1" value={retention.j1 ?? '—'} suffix={retention.j1 != null ? '%' : ''} />
        <Kpi icon="🔁" label="Rétention J+7" value={retention.j7 ?? '—'} suffix={retention.j7 != null ? '%' : ''} />
      </div>
      <p className="stats-note">
        Rétention = part des joueurs revenus le lendemain (J+1) ou 7 jours après (J+7) leur 1ʳᵉ venue.
        Bases : {retention.j1_base} joueur(s) pour J+1, {retention.j7_base} pour J+7. Cet indicateur s’étoffe avec le temps.
      </p>
      <Panel title="Distribution des séries (streaks)" sub="Combien de joueurs à quelle série de jours consécutifs.">
        <BarChart data={streak_buckets} xKey="label" xFormat={v => v}
          series={[{ key: 'count', label: 'Joueurs', color: C.accent }]} />
      </Panel>
      <Panel title="Assiduité — nombre de jours actifs par joueur" sub="Joueurs ponctuels (1 j) vs réguliers (plusieurs jours).">
        <BarChart data={days_active_buckets} xKey="label" xFormat={v => v}
          series={[{ key: 'count', label: 'Joueurs', color: C.indigo }]} />
      </Panel>
    </>
  )
}

/* ───────────────────────── Onboarding ───────────────────────── */
function Onboarding({ stats }) {
  const { funnel, played_signup_rate } = stats
  const max = Math.max(1, ...funnel.map(f => f.count))
  return (
    <>
      <div className="stats-kpis">
        <Kpi icon="⚡" label="Jouent le jour de l’inscription" value={played_signup_rate} suffix="%" />
      </div>
      <Panel title="Parcours des joueurs" sub="De l’inscription au retour. (Étapes indicatives, pas strictement imbriquées.)">
        <div className="stats-funnel">
          {funnel.map((f, i) => (
            <div key={f.label} className="stats-funnel-row">
              <span className="stats-funnel-label">{f.label}</span>
              <div className="stats-funnel-track">
                <div className="stats-funnel-bar" style={{ width: `${(100 * f.count) / max}%`, background: [C.accent, C.indigo, C.warning, C.coral][i] }} />
              </div>
              <span className="stats-funnel-value">{f.count}</span>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}

/* ───────────────────────── Communauté ───────────────────────── */
function Community({ stats }) {
  const { calendar_coverage, social_series, top_grids, suggestions_by_status, suggestions_series, skins } = stats
  const cc = calendar_coverage
  const lowRunway = cc.runway < 3
  return (
    <>
      <div className={`stats-coverage ${lowRunway ? 'stats-coverage--warn' : ''}`}>
        <span className="stats-coverage-icon">{lowRunway ? '⚠️' : '✅'}</span>
        <div className="stats-coverage-text">
          <strong className="stats-coverage-main">
            {cc.runway === 0
              ? 'Aucune grille pour aujourd’hui et après !'
              : `${cc.runway} jour${cc.runway > 1 ? 's' : ''} d’avance`}
          </strong>
          <span className="stats-coverage-sub">
            Grilles programmées jusqu’au {fmtDate(cc.last_date)} · {cc.future_count} grille(s) à venir
          </span>
        </div>
      </div>

      <Panel title="Engagement social / jour" sub="Votes (cœurs) et commentaires laissés sur les grilles.">
        <BarChart data={social_series} series={[
          { key: 'upvotes', label: 'Votes', color: C.coral },
          { key: 'comments', label: 'Commentaires', color: C.indigo },
        ]} />
      </Panel>

      <Panel title="Top grilles" sub="Les grilles les plus appréciées (votes).">
        {top_grids.length === 0 ? <p className="stats-empty">Pas encore de données.</p> : (
          <div className="stats-table-wrap">
            <table className="stats-table">
              <thead><tr><th>Grille</th><th>❤️ Votes</th><th>Joueurs</th><th>Réussite</th></tr></thead>
              <tbody>
                {top_grids.map((g, i) => (
                  <tr key={i}>
                    <td>{g.date ? fmtDate(g.date) : g.label}</td>
                    <td>{g.upvotes}</td>
                    <td>{g.players}</td>
                    <td><Pct v={g.success_rate} good /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Boîte à idées" sub="Suggestions reçues, par statut et par jour.">
        <BreakdownBar segments={[
          { label: 'Nouveau', value: byStatus(suggestions_by_status, 'nouveau'), color: C.accent },
          { label: 'Vu', value: byStatus(suggestions_by_status, 'vu'), color: C.warning },
          { label: 'Traité', value: byStatus(suggestions_by_status, 'traite'), color: C.indigo },
          { label: 'Rejeté', value: byStatus(suggestions_by_status, 'rejete'), color: C.grey },
        ]} />
        <div className="stats-spacer" />
        <BarChart data={suggestions_series} series={[{ key: 'count', label: 'Suggestions', color: C.accent }]} />
      </Panel>

      <Panel title="Skins choisis" sub="Répartition des créatures sélectionnées par les joueurs.">
        <BarChart data={skins} xKey="label" xFormat={v => v}
          series={[{ key: 'count', label: 'Joueurs', color: C.indigo }]} />
      </Panel>
    </>
  )
}

/* ───────────────────────── Helpers UI ───────────────────────── */
function Panel({ title, sub, children }) {
  return (
    <div className="stats-panel">
      <h3 className="stats-panel-title">{title}</h3>
      {sub && <p className="stats-panel-sub">{sub}</p>}
      {children}
    </div>
  )
}

function Pct({ v, good, bad }) {
  let cls = 'stats-pct'
  if (good) cls += v >= 70 ? ' stats-pct--ok' : v >= 40 ? ' stats-pct--mid' : ' stats-pct--bad'
  if (bad) cls += v <= 15 ? ' stats-pct--ok' : v <= 35 ? ' stats-pct--mid' : ' stats-pct--bad'
  return <span className={cls}>{v} %</span>
}

const byStatus = (arr, s) => arr.find(x => x.status === s)?.count ?? 0
