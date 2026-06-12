import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'

// Hook du mode RAID — temps réel via Supabase Realtime :
//   • PRESENCE  → le lobby (qui est là, son organe, son « prêt ») : instantané, zéro serveur.
//   • BROADCAST → les cartes qui bougent + le chat + le partage des couleurs : instantané.
//   • Edge Function `raid` UNIQUEMENT pour le rare/autoritaire : find / open-test /
//     start / view (vue scoped) / validate / timeout.
// Le déplacement des cartes ne touche jamais le serveur en cours de partie.
export function useRaidArena(user) {
  const [sessionId, setSessionId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [noArena, setNoArena] = useState(false)
  const [pub, setPub] = useState(null)           // session publique (statut + jeu)
  const [presenceRoster, setPresenceRoster] = useState([])  // lobby (Presence)
  const [serverRoster, setServerRoster] = useState([])      // combat (persisté au start)
  const [serverMe, setServerMe] = useState(null)
  const [view, setView] = useState({})           // vue scoped (clues/words/feedback)
  const [board, setBoard] = useState({})          // { slot: {handle, rotation} } (Broadcast)
  const [chat, setChat] = useState([])
  const [sharedFeedback, setSharedFeedback] = useState(null)
  const [busy, setBusy] = useState(false)         // start/validate en cours

  // Présence locale (mon organe / mon prêt) — mirroré dans le canal.
  const [myRole, setMyRole] = useState(null)
  const [myReady, setMyReady] = useState(false)

  const channelRef = useRef(null)
  const subscribedRef = useRef(false)
  const pubRef = useRef(null)
  const fetchViewRef = useRef(() => {})

  const status = pub?.status ?? null
  const inLobby = status === 'waiting' || status == null
  const roster = inLobby ? presenceRoster : serverRoster
  const role = inLobby ? myRole : (serverMe?.role ?? null)
  const me = inLobby ? { user_id: user?.id, pseudo: user?.pseudo, role: myRole, is_ready: myReady } : serverMe

  const call = useCallback(async (action, extra = {}) => {
    const { data, error } = await supabase.functions.invoke('raid', {
      body: { action, player_id: user?.id, pseudo: user?.pseudo, session_id: sessionId, ...extra },
    })
    if (error) return { error: error.message || 'error' }
    return data
  }, [user?.id, user?.pseudo, sessionId])

  // Applique une réponse autoritaire (start/validate/timeout/view) en local.
  const applyResult = useCallback((res) => {
    if (!res?.session) return
    const prev = pubRef.current
    pubRef.current = res.session
    setPub(res.session)
    if (res.roster) setServerRoster(res.roster)
    if ('me' in res) setServerMe(res.me)
    if (res.view) setView(res.view)
    const changed = !prev || prev.assault_index !== res.session.assault_index || prev.status !== res.session.status
    if (changed) { setBoard({}); setSharedFeedback(null) }
  }, [])

  // Récupère ma vue scoped (indices/mots) — appelée à chaque nouvel assaut.
  const fetchView = useCallback(async () => {
    const res = await call('view')
    if (res?.session) applyResult(res)
  }, [call, applyResult])
  fetchViewRef.current = fetchView

  // ── Démarrage : trouver l'arène ouverte. ──
  useEffect(() => {
    if (!user?.id) return
    let alive = true
    ;(async () => {
      const { data, error } = await supabase.functions.invoke('raid', { body: { action: 'find', player_id: user.id } })
      if (!alive) return
      if (error || !data?.session) { setNoArena(true); setLoading(false); return }
      pubRef.current = data.session
      setPub(data.session)
      setSessionId(data.session.id)
      setLoading(false)
    })()
    return () => { alive = false }
  }, [user?.id])

  // ── Canal Realtime (Presence + Broadcast). ──
  useEffect(() => {
    if (!sessionId || !user?.id) return
    subscribedRef.current = false
    const channel = supabase.channel(`raid-${sessionId}`, {
      config: { presence: { key: user.id }, broadcast: { self: false } },
    })

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      const list = Object.values(state).map(metas => metas[0]).filter(Boolean)
        .map(m => ({ user_id: m.id, pseudo: m.pseudo, role: m.role ?? null, is_ready: !!m.ready }))
      list.sort((a, b) => String(a.user_id).localeCompare(String(b.user_id)))
      setPresenceRoster(list)
    })

    channel.on('broadcast', { event: 'session' }, ({ payload }) => {
      const prev = pubRef.current
      pubRef.current = payload
      setPub(payload)
      const changed = !prev || prev.assault_index !== payload.assault_index || prev.status !== payload.status
      if (changed) {
        setBoard({}); setSharedFeedback(null)
        if (payload.status === 'active') fetchViewRef.current()
      }
    })
    channel.on('broadcast', { event: 'board' }, ({ payload }) => setBoard(payload.board || {}))
    channel.on('broadcast', { event: 'chat' }, ({ payload }) => setChat(c => [...c.slice(-80), payload]))
    channel.on('broadcast', { event: 'feedback' }, ({ payload }) => setSharedFeedback(payload.fb || null))

    channel.subscribe((s) => {
      if (s !== 'SUBSCRIBED') return
      subscribedRef.current = true
      channel.track({ id: user.id, pseudo: user.pseudo, role: null, ready: false })
    })
    channelRef.current = channel
    return () => { subscribedRef.current = false; supabase.removeChannel(channel); channelRef.current = null }
  }, [sessionId, user?.id, user?.pseudo])

  // Re-track la présence quand mon organe / prêt change.
  useEffect(() => {
    if (subscribedRef.current && channelRef.current) {
      channelRef.current.track({ id: user?.id, pseudo: user?.pseudo, role: myRole, ready: myReady })
    }
  }, [myRole, myReady, user?.id, user?.pseudo])

  // Résolution de conflit d'organe : si quelqu'un de "plus petit" tient le même → je lâche.
  useEffect(() => {
    if (!inLobby || !myRole) return
    const conflict = presenceRoster.find(p => p.role === myRole && p.user_id !== user?.id && String(p.user_id) < String(user?.id))
    if (conflict) setMyRole(null)
  }, [presenceRoster, myRole, inLobby, user?.id])

  // Quand le combat démarre (statut → active), récupère ma vue scoped.
  useEffect(() => {
    if (status === 'active' && !view.clues && !view.words && serverMe == null) fetchView()
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  const broadcast = useCallback((event, payload) => channelRef.current?.send({ type: 'broadcast', event, payload }), [])

  // ── Actions lobby (Presence — instantané) ──
  const claimRole = useCallback((r) => {
    const taken = presenceRoster.some(p => p.role === r && p.user_id !== user?.id)
    if (!taken) setMyRole(r)
  }, [presenceRoster, user?.id])
  const releaseRole = useCallback(() => setMyRole(null), [])
  const setReady = useCallback((v) => setMyReady(!!v), [])

  // ── Lancement (Edge `start`) — n'importe quel joueur prêt peut déclencher. ──
  const startGame = useCallback(async () => {
    setBusy(true)
    const ros = presenceRoster.filter(p => p.role).map(p => ({ user_id: p.user_id, pseudo: p.pseudo, role: p.role }))
    const res = await call('start', { roster: ros })
    setBusy(false)
    if (res?.error) return res
    applyResult(res)
    if (res.session) broadcast('session', res.session)
    return res
  }, [presenceRoster, call, applyResult, broadcast])

  // ── Combat ──
  const moveBoard = useCallback((next) => { setBoard(next); broadcast('board', { board: next }) }, [broadcast])

  const validate = useCallback(async () => {
    setBusy(true)
    const res = await call('validate', { board })
    setBusy(false)
    if (res?.error) return res
    applyResult(res)
    if (res.session) broadcast('session', res.session)
    return res
  }, [call, board, applyResult, broadcast])

  const shareFeedback = useCallback((fb) => broadcast('feedback', { fb }), [broadcast])
  const sendChat = useCallback((text) => {
    const t = String(text || '').trim().slice(0, 240)
    if (!t) return
    const msg = { pseudo: user?.pseudo, text: t, ts: Date.now() }
    setChat(c => [...c.slice(-80), msg])
    broadcast('chat', msg)
  }, [broadcast, user?.pseudo])

  const signalTimeout = useCallback(async () => {
    const res = await call('timeout')
    if (res?.session) { applyResult(res); broadcast('session', res.session) }
  }, [call, applyResult, broadcast])

  const openTest = useCallback((adminSecret) => call('open-test', { admin_secret: adminSecret }), [call])

  return {
    loading, noArena, sessionId, busy,
    session: pub,
    roster, me, view, role,
    board, chat, sharedFeedback,
    actions: { claimRole, releaseRole, setReady, startGame, moveBoard, validate, shareFeedback, sendChat, signalTimeout, openTest },
  }
}
