import { useEffect, useState, useCallback } from 'react'
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
// Abonnés aux invitations RAID reçues (canal hub-online partagé). Module-level :
// survit aux redémarrages du canal (changement d'utilisateur) comme `listeners`.
const inviteListeners = new Set()

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
  channel = supabase.channel('hub-online', {
    config: { presence: { key: user.id }, broadcast: { self: false } },
  })
  channel
    .on('presence', { event: 'sync' }, buildList)
    // Invitation RAID : un joueur clique « Jouez ensemble » → broadcast à tous les
    // connectés du hub (même canal partagé que la présence). Ignore sa propre invite.
    .on('broadcast', { event: 'raid-invite' }, ({ payload }) => {
      if (!payload || payload.from_id === channelKey) return
      inviteListeners.forEach(l => l(payload))
    })
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

// Diffuse une invitation RAID à tous les joueurs en ligne via le canal hub-online
// partagé (déjà monté par le Header). Fire-and-forget : l'appelant navigue ensuite
// vers /raid. Renvoie false si le canal n'est pas encore prêt.
export function sendRaidInvite(from) {
  if (!channel || channel.state !== 'joined' || !from?.id) return false
  channel.send({
    type: 'broadcast',
    event: 'raid-invite',
    payload: { from_id: from.id, from_pseudo: from.pseudo ?? 'Un joueur', ts: Date.now() },
  })
  return true
}

// S'abonne aux invitations RAID reçues (réutilise le canal hub-online déjà monté).
// Renvoie [invite, dismiss] : invite = { from_id, from_pseudo, ts } | null.
export function useRaidInvite() {
  const [invite, setInvite] = useState(null)
  useEffect(() => {
    const listener = (payload) => setInvite(payload)
    inviteListeners.add(listener)
    return () => { inviteListeners.delete(listener) }
  }, [])
  const dismiss = useCallback(() => setInvite(null), [])
  return [invite, dismiss]
}
