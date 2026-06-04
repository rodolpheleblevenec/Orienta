import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const STATUSES = [
  { id: 'nouveau', label: 'Nouveau', emoji: '🆕' },
  { id: 'vu',      label: 'Vu',      emoji: '👀' },
  { id: 'traite',  label: 'Traité',  emoji: '✅' },
  { id: 'rejete',  label: 'Rejeté',  emoji: '🗑️' },
]

const FILTERS = [
  { id: 'tous',    label: 'Tous' },
  { id: 'nouveau', label: 'Nouveaux' },
  { id: 'vu',      label: 'Vus' },
  { id: 'traite',  label: 'Traités' },
  { id: 'rejete',  label: 'Rejetés' },
]

function formatDateTime(iso) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')
  return `${date} à ${time}`
}

export default function SuggestionsAdmin() {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('tous')

  useEffect(() => {
    fetchSuggestions()
  }, [])

  async function fetchSuggestions() {
    setLoading(true)
    const { data } = await supabase
      .from('orienta_suggestions')
      .select('*')
      .order('created_at', { ascending: false })
    setSuggestions(data ?? [])
    setLoading(false)
  }

  async function updateStatus(id, status) {
    setSuggestions(prev => prev.map(s => (s.id === id ? { ...s, status } : s)))
    await supabase.from('orienta_suggestions').update({ status }).eq('id', id)
  }

  const visible = filter === 'tous'
    ? suggestions
    : suggestions.filter(s => s.status === filter)

  const newCount = suggestions.filter(s => s.status === 'nouveau').length

  return (
    <section className="admin-suggestions">
      <div className="admin-suggestions-head">
        <h2 className="admin-editor-title">
          Boîte à idées
          {newCount > 0 && <span className="admin-sugg-newbadge">{newCount} nouveau{newCount > 1 ? 'x' : ''}</span>}
        </h2>
      </div>

      <div className="admin-sugg-filters">
        {FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            className={`admin-sugg-filter${filter === f.id ? ' admin-sugg-filter--on' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="profile-empty">Chargement…</p>
      ) : visible.length === 0 ? (
        <p className="profile-empty">Aucune idée pour ce filtre.</p>
      ) : (
        <ul className="admin-sugg-list">
          {visible.map(s => (
            <li key={s.id} className={`admin-sugg-card admin-sugg-card--${s.status}`}>
              <div className="admin-sugg-meta">
                <span className="admin-sugg-author">{s.pseudo}</span>
                <span className="admin-sugg-date">{formatDateTime(s.created_at)}</span>
              </div>
              <p className="admin-sugg-content">{s.content}</p>
              <div className="admin-sugg-actions">
                {STATUSES.map(st => (
                  <button
                    key={st.id}
                    type="button"
                    className={`admin-sugg-status${s.status === st.id ? ' admin-sugg-status--on' : ''}`}
                    onClick={() => updateStatus(s.id, st.id)}
                  >
                    {st.emoji} {st.label}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
