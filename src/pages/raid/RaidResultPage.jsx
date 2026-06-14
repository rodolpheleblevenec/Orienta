import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Header from '../../components/ui/Header'
import { supabase } from '../../lib/supabase'
import RaidResultView from './RaidResultView'

// Page « résultat » d'un raid terminé (victoire / défaite). Autonome : elle lit le
// résultat par session_id via l'action `result` de l'Edge Function (aucun secret, pas
// besoin du canal temps réel) → consultable même rouverte plus tard ou par partage.
// L'affichage est délégué à RaidResultView (présentation pure, aussi utilisée en preview).
// Décisions de cadrage : pages internes (RequireAuth), record = meilleur temps,
// arènes de test affichées « hors classement », défaite = record à battre + revanche.

export default function RaidResultPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [inProgress, setInProgress] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true); setError(false); setInProgress(false)
    ;(async () => {
      const { data: res, error: err } = await supabase.functions.invoke('raid', {
        body: { action: 'result', session_id: sessionId },
      })
      if (!alive) return
      if (err || !res?.session) { setError(true); setLoading(false); return }
      // Session pas encore terminée → on l'indique (au lieu d'une redirection muette).
      if (res.session.status !== 'won' && res.session.status !== 'lost') {
        setInProgress(true); setLoading(false); return
      }
      setData(res); setLoading(false)
    })()
    return () => { alive = false }
  }, [sessionId, navigate])

  if (loading) {
    return (<><Header /><main className="raid-page"><div className="raid-loading">Chargement du résultat…</div></main></>)
  }
  if (inProgress) {
    return (
      <>
        <Header />
        <main className="raid-page">
          <div className="raid-res raid-res--lost">
            <div className="raid-res-emoji">⚔️</div>
            <h1 className="raid-h1">Ce raid est encore en cours</h1>
            <p className="raid-sub">Le combat n’est pas terminé — le résultat s’affichera une fois l’assaut final joué.</p>
            <div className="raid-res-actions">
              <button className="btn-primary" onClick={() => navigate('/raid')}>Rejoindre l’arène</button>
              <button className="btn-secondary" onClick={() => navigate('/hub')}>Retour au hub</button>
            </div>
          </div>
        </main>
      </>
    )
  }
  if (error || !data) {
    return (
      <>
        <Header />
        <main className="raid-page">
          <div className="raid-res raid-res--lost">
            <div className="raid-res-emoji">🌫️</div>
            <h1 className="raid-h1">Résultat introuvable</h1>
            <p className="raid-sub">Ce raid n’existe plus ou n’est pas encore terminé.</p>
            <div className="raid-res-actions">
              <button className="btn-primary" onClick={() => navigate('/raid')}>Aller à l’arène</button>
              <button className="btn-secondary" onClick={() => navigate('/hub')}>Retour au hub</button>
            </div>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Header />
      <main className="raid-page"><RaidResultView data={data} /></main>
    </>
  )
}
