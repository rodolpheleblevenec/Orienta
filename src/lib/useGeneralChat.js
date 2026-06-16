import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from './supabase'

// Canal général d'organisation : un canal Realtime STABLE et partagé par toute
// l'app (bulle flottante) ET le SAS (salle d'attente) du RAID. Éphémère : les
// messages ne vivent que 10 minutes, puis disparaissent.
//
// Live    : Supabase Realtime broadcast (event 'chat') sur 'orienta-general'.
// Histo.  : Edge Function `chat` (action 'history' = 10 dernières minutes).
// Persist : Edge Function `chat` (action 'post', best-effort, purge l'éphémère).
const CHANNEL = 'orienta-general'
const WINDOW_MS = 10 * 60 * 1000 // 10 min
const MAX = 120

export function useGeneralChat(user) {
  const [chat, setChat] = useState([])
  const chanRef = useRef(null)

  // Garde uniquement les messages des 10 dernières minutes (éphémère à l'écran).
  const prune = useCallback((list) => {
    const min = Date.now() - WINDOW_MS
    return list.filter(m => (m.ts ?? 0) >= min).slice(-MAX)
  }, [])

  useEffect(() => {
    if (!user?.id) { setChat([]); return }
    let cancelled = false

    const channel = supabase.channel(CHANNEL, { config: { broadcast: { self: false } } })
    chanRef.current = channel
    channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
      setChat(c => prune([...c, payload]))
    })
    channel.subscribe()

    // Historique (10 min), fusionné avec d'éventuels messages live déjà reçus.
    supabase.functions.invoke('chat', { body: { action: 'history', user_id: user.id } })
      .then(({ data }) => {
        if (cancelled || !Array.isArray(data?.chat)) return
        setChat(c => {
          const seen = new Set(c.map(m => `${m.ts}:${m.user_id}`))
          const merged = [...data.chat.filter(m => !seen.has(`${m.ts}:${m.user_id}`)), ...c]
          merged.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0))
          return prune(merged)
        })
      })
      .catch(() => {})

    // Purge périodique → les vieux messages disparaissent même bulle ouverte.
    const iv = setInterval(() => setChat(c => prune(c)), 30_000)

    return () => { cancelled = true; clearInterval(iv); supabase.removeChannel(channel) }
  }, [user?.id, prune])

  const sendChat = useCallback((text) => {
    const t = (text ?? '').trim().slice(0, 240)
    if (!t || !user?.id) return
    const msg = { user_id: user.id, pseudo: user.pseudo, text: t, ts: Date.now(), role: null }
    setChat(c => prune([...c, msg])) // optimiste (broadcast self:false → pas d'écho)
    chanRef.current?.send({ type: 'broadcast', event: 'chat', payload: msg })
    supabase.functions.invoke('chat', { body: { action: 'post', user_id: user.id, text: t } }).catch(() => {})
  }, [user?.id, user?.pseudo, prune])

  const me = { user_id: user?.id, pseudo: user?.pseudo, role: null }
  return { chat, sendChat, me }
}
