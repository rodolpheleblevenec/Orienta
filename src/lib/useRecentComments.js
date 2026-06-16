import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Fil communautaire du hub (« Ça papote ») : les derniers commentaires laissés
// sur les grilles. La lecture cross-grilles est impossible côté client (RLS) →
// on passe par l'Edge Function `social` (action `feed`, service_role) qui ne
// renvoie que des champs publics.
export function useRecentComments(user) {
  const [comments, setComments] = useState([])

  useEffect(() => {
    if (!user?.id) {
      setComments([])
      return
    }
    let cancelled = false

    const load = () => {
      supabase.functions
        .invoke('social', { body: { action: 'feed', user_id: user.id, limit: 6 } })
        .then(({ data }) => {
          if (!cancelled && Array.isArray(data?.comments)) setComments(data.comments)
        })
        .catch(() => {})
    }
    load()

    // Rafraîchit quand l'onglet redevient actif : fil « vivant » sans polling.
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [user?.id])

  return comments
}
