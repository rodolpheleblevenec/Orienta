import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Présence temps réel des joueurs (Supabase Realtime Presence).
//
// Singleton partagé : plusieurs composants (panneau desktop du hub + liste du
// burger mobile dans le header) consomment la MÊME présence sans ouvrir deux
// canaux 'hub-online' concurrents. Un compteur de références démonte le canal
// quand plus personne n'écoute.
let channel = null
let channelKey = null          // user.id pour lequel le canal a été ouvert
let latestMeta = null          // dernières méta (cosmétiques) à diffuser
let players = []
let refCount = 0
const listeners = new Set()

function buildList() {
  if (!channel) { players = []; return }
  const state = channel.presenceState()
  players = Object.values(state)
    .map(metas => metas[0])
    .filter(Boolean)
    // On embarque les cosmétiques (cadre, couleur, statut) dans la présence :
    // ils ne s'affichent que dans la vitrine « En ligne », vue par tous.
    .map(m => ({
      id: m.id, pseudo: m.pseudo, selected_skin: m.selected_skin,
      equipped_frame: m.equipped_frame ?? null,
      equipped_color: m.equipped_color ?? null,
      status_text: m.status_text ?? null,
    }))
    // Tri stable : soi-même d'abord, puis ordre d'arrivée.
    .sort((a, b) => (a.id === channelKey ? -1 : b.id === channelKey ? 1 : 0))
  listeners.forEach(l => l(players))
}

function start(user) {
  channelKey = user.id
  channel = supabase.channel('hub-online', { config: { presence: { key: user.id } } })
  channel
    .on('presence', { event: 'sync' }, buildList)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED' && latestMeta) channel.track(latestMeta)
    })
}

function stop() {
  if (channel) supabase.removeChannel(channel)
  channel = null; channelKey = null; latestMeta = null; players = []
}

export function useOnlinePlayers(user) {
  const [list, setList] = useState(players)

  useEffect(() => {
    if (!user?.id) { setList([]); return }

    latestMeta = {
      id: user.id,
      pseudo: user.pseudo,
      selected_skin: user.selected_skin ?? 1,
      equipped_frame: user.equipped_frame ?? null,
      equipped_color: user.equipped_color ?? null,
      status_text: user.status_text ?? null,
      online_at: new Date().toISOString(),
    }

    // (Re)démarre le canal au 1er abonné ou si l'utilisateur change ; sinon pousse
    // les méta à jour (cosmétiques modifiés) si le canal est déjà connecté.
    if (!channel || channelKey !== user.id) { stop(); start(user) }
    else if (channel.state === 'joined') { channel.track(latestMeta) }

    refCount++
    const listener = (p) => setList(p)
    listeners.add(listener)
    setList(players)

    return () => {
      listeners.delete(listener)
      refCount -= 1
      if (refCount <= 0) { refCount = 0; stop() }
    }
  }, [user?.id, user?.pseudo, user?.selected_skin, user?.equipped_frame, user?.equipped_color, user?.status_text])

  return list
}
