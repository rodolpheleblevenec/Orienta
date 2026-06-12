import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'

// Hook du mode RAID — temps réel via Supabase Realtime :
//   • PRESENCE  → SEULEMENT « qui est connecté » (id + pseudo, statique). Presence
//     ne propage pas fiablement les MISES À JOUR (re-track) → on ne s'en sert pas
//     pour l'état mutable.
//   • BROADCAST → tout l'état mutable, instantané (~16 ms) : rôle + prêt (lobby),
//     cartes, chat, partage des couleurs, et sync de la session.
//   • Edge Function `raid` UNIQUEMENT pour le rare/autoritaire : find / open-test /
//     start / view (vue scoped) / validate / timeout.
export function useRaidArena(user) {
  const [sessionId, setSessionId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [noArena, setNoArena] = useState(false)
  const [pub, setPub] = useState(null)
  const [presenceUsers, setPresenceUsers] = useState([])   // [{user_id, pseudo}] (Presence = connectés)
  const [lobbyState, setLobbyState] = useState({})          // { user_id: {role, ready} } (Broadcast)
  const [serverRoster, setServerRoster] = useState([])      // combat (persisté au start)
  const [serverMe, setServerMe] = useState(null)
  const [view, setView] = useState({})
  const [board, setBoard] = useState({})
  const [chat, setChat] = useState([])
  const [sharedFeedback, setSharedFeedback] = useState(null)
  const [busy, setBusy] = useState(false)

  const [myRole, setMyRole] = useState(null)
  const [myReady, setMyReady] = useState(false)

  const channelRef = useRef(null)
  const subscribedRef = useRef(false)
  const pubRef = useRef(null)
  const fetchViewRef = useRef(() => {})
  const myRoleRef = useRef(null); myRoleRef.current = myRole
  const myReadyRef = useRef(false); myReadyRef.current = myReady
  const roleRef = useRef(null)

  const status = pub?.status ?? null
  const inLobby = status === 'waiting' || status == null

  // Roster du lobby = connectés (Presence) enrichis de leur rôle/prêt (Broadcast).
  // Pour MOI, on prend l'état local (instantané) plutôt que d'attendre l'écho.
  const presenceRoster = presenceUsers.map(u => {
    if (u.user_id === user?.id) return { user_id: u.user_id, pseudo: u.pseudo, role: myRole, is_ready: myReady }
    const st = lobbyState[u.user_id] || {}
    return { user_id: u.user_id, pseudo: u.pseudo, role: st.role ?? null, is_ready: !!st.ready }
  })

  const roster = inLobby ? presenceRoster : serverRoster
  const role = inLobby ? myRole : (serverMe?.role ?? null)
  roleRef.current = role
  const me = inLobby ? { user_id: user?.id, pseudo: user?.pseudo, role: myRole, is_ready: myReady } : serverMe

  const call = useCallback(async (action, extra = {}) => {
    const { data, error } = await supabase.functions.invoke('raid', {
      body: { action, player_id: user?.id, pseudo: user?.pseudo, session_id: sessionId, ...extra },
    })
    if (error) return { error: error.message || 'error' }
    return data
  }, [user?.id, user?.pseudo, sessionId])

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

  const fetchView = useCallback(async () => {
    const res = await call('view')
    if (res?.session) applyResult(res)
  }, [call, applyResult])
  fetchViewRef.current = fetchView

  // ── Trouver l'arène ouverte. ──
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

  // ── Canal Realtime. Presence = connectés ; Broadcast = tout l'état mutable. ──
  useEffect(() => {
    if (!sessionId || !user?.id) return
    subscribedRef.current = false
    const channel = supabase.channel(`raid-${sessionId}`, {
      config: { presence: { key: user.id }, broadcast: { self: false } },
    })

    // Presence : uniquement qui est connecté (id + pseudo, statique).
    const syncUsers = () => {
      const state = channel.presenceState()
      const seen = new Set(); const list = []
      for (const metas of Object.values(state)) {
        const m = metas[0]; if (!m || seen.has(m.id)) continue
        seen.add(m.id); list.push({ user_id: m.id, pseudo: m.pseudo })
      }
      list.sort((a, b) => String(a.user_id).localeCompare(String(b.user_id)))
      setPresenceUsers(list)
    }
    channel.on('presence', { event: 'sync' }, syncUsers)
    // Un nouveau venu → je ré-annonce mon rôle/prêt pour qu'il le reçoive (rattrapage).
    channel.on('presence', { event: 'join' }, () => {
      syncUsers()
      channel.send({ type: 'broadcast', event: 'lobby', payload: { user_id: user.id, pseudo: user.pseudo, role: myRoleRef.current, ready: myReadyRef.current } })
    })
    channel.on('presence', { event: 'leave' }, syncUsers)

    // Broadcast : rôle/prêt des autres.
    channel.on('broadcast', { event: 'lobby' }, ({ payload }) => {
      if (!payload?.user_id) return
      setLobbyState(prev => ({ ...prev, [payload.user_id]: { role: payload.role ?? null, ready: !!payload.ready } }))
    })
    // Broadcast : sync de session (après start/validate/timeout).
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
      channel.track({ id: user.id, pseudo: user.pseudo })
      // J'annonce mon état lobby courant (au cas où je rejoins une arène déjà peuplée).
      channel.send({ type: 'broadcast', event: 'lobby', payload: { user_id: user.id, pseudo: user.pseudo, role: myRoleRef.current, ready: myReadyRef.current } })
    })
    channelRef.current = channel
    return () => { subscribedRef.current = false; supabase.removeChannel(channel); channelRef.current = null }
  }, [sessionId, user?.id, user?.pseudo])

  // Résolution de conflit d'organe : si un user_id « plus petit » tient le même → je lâche.
  useEffect(() => {
    if (!inLobby || !myRole) return
    const conflict = presenceRoster.find(p => p.role === myRole && p.user_id !== user?.id && String(p.user_id) < String(user?.id))
    if (conflict) {
      setMyRole(null)
      channelRef.current?.send({ type: 'broadcast', event: 'lobby', payload: { user_id: user?.id, pseudo: user?.pseudo, role: null, ready: myReadyRef.current } })
    }
  }, [presenceRoster, myRole, inLobby, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Récupère la vue scoped quand le combat démarre.
  useEffect(() => {
    if (status === 'active' && !view.clues && !view.words && serverMe == null) fetchView()
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  const broadcast = useCallback((event, payload) => channelRef.current?.send({ type: 'broadcast', event, payload }), [])
  const broadcastLobby = useCallback((r, rdy) => {
    channelRef.current?.send({ type: 'broadcast', event: 'lobby', payload: { user_id: user?.id, pseudo: user?.pseudo, role: r, ready: rdy } })
  }, [user?.id, user?.pseudo])

  // ── Actions lobby (état local instantané + diffusion Broadcast) ──
  const claimRole = useCallback((r) => {
    const taken = presenceRoster.some(p => p.role === r && p.user_id !== user?.id)
    if (taken) return
    setMyRole(r); broadcastLobby(r, myReadyRef.current)
  }, [presenceRoster, user?.id, broadcastLobby])
  const releaseRole = useCallback(() => { setMyRole(null); broadcastLobby(null, myReadyRef.current) }, [broadcastLobby])
  const setReady = useCallback((v) => { setMyReady(!!v); broadcastLobby(myRoleRef.current, !!v) }, [broadcastLobby])

  // ── Lancement ──
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
  const previewBoard = useCallback((next) => broadcast('board', { board: next }), [broadcast])

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
    const msg = { pseudo: user?.pseudo, text: t, ts: Date.now(), role: roleRef.current }
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
    actions: { claimRole, releaseRole, setReady, startGame, moveBoard, previewBoard, validate, shareFeedback, sendChat, signalTimeout, openTest },
  }
}
