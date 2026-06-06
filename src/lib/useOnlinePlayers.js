import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Présence temps réel des joueurs sur le hub (Supabase Realtime Presence).
// Chaque client « track » son identité ; tous reçoivent la liste synchronisée
// par WebSocket. Les onglets multiples d'un même joueur sont fusionnés grâce à
// la clé de présence (= id du joueur).
//
// Prépare le futur mode multijoueur en temps réel : pour l'instant, sert
// uniquement à afficher qui est connecté en même temps.
export function useOnlinePlayers(user) {
  const [players, setPlayers] = useState([])

  useEffect(() => {
    if (!user?.id) { setPlayers([]); return }

    const channel = supabase.channel('hub-online', {
      config: { presence: { key: user.id } },
    })

    const syncPlayers = () => {
      // presenceState() : { [cléDePrésence]: [{ ...meta }, ...] }
      // Une entrée par joueur : on ne garde que la 1ʳᵉ meta de chaque clé.
      const state = channel.presenceState()
      const list = Object.values(state)
        .map(metas => metas[0])
        .filter(Boolean)
        .map(m => ({ id: m.id, pseudo: m.pseudo, selected_skin: m.selected_skin }))
        // Tri stable : soi-même d'abord, puis ordre d'arrivée.
        .sort((a, b) => (a.id === user.id ? -1 : b.id === user.id ? 1 : 0))
      setPlayers(list)
    }

    channel
      .on('presence', { event: 'sync' }, syncPlayers)
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        channel.track({
          id: user.id,
          pseudo: user.pseudo,
          selected_skin: user.selected_skin ?? 1,
          online_at: new Date().toISOString(),
        })
      })

    return () => { supabase.removeChannel(channel) }
  }, [user?.id, user?.pseudo, user?.selected_skin])

  return players
}
