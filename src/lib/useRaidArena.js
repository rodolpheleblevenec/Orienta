import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import { canPlace, canRotate } from './raid'

// Hook du mode RAID : pilote une session d'arène coopérative.
// - rejoint l'arène ouverte (join) et récupère l'état + la vue SCOPED de l'organe
// - s'abonne aux postgres_changes (état autoritaire : statut, roster, PV, board…)
// - s'abonne au canal broadcast (chat, board live, partage des couleurs)
// L'autorité reste l'Edge Function `raid` — ce hook ne fait qu'orchestrer.
export function useRaidArena(user) {
  const [sessionId, setSessionId] = useState(null)
  const [data, setData] = useState(null)          // { session, roster, me, view }
  const [board, setBoard] = useState({})          // { slot: {handle, rotation} } (live)
  const [chat, setChat] = useState([])
  const [sharedFeedback, setSharedFeedback] = useState(null)
  const [loading, setLoading] = useState(true)
  const [noArena, setNoArena] = useState(false)
  const channelRef = useRef(null)
  const lastAssaultRef = useRef(-1)
  const lastStatusRef = useRef(null)

  const role = data?.me?.role ?? null
  const iControlBoard = !!role && (canPlace(role) || canRotate(role))
  const iControlRef = useRef(false)
  iControlRef.current = iControlBoard

  const call = useCallback(async (action, extra = {}) => {
    const { data: res, error } = await supabase.functions.invoke('raid', {
      body: { action, player_id: user?.id, pseudo: user?.pseudo, session_id: sessionId, ...extra },
    })
    if (error) return { error: error.message || 'error' }
    return res
  }, [user?.id, user?.pseudo, sessionId])

  // Applique une réponse d'état du serveur + réconcilie le board local.
  const applyState = useCallback((res) => {
    if (!res || res.error) return
    setData(res)
    const s = res.session
    if (!s) return
    const assaultChanged = s.assault_index !== lastAssaultRef.current
    const statusChanged = s.status !== lastStatusRef.current
    lastAssaultRef.current = s.assault_index
    lastStatusRef.current = s.status
    if (s.status !== 'active') { setBoard({}); setSharedFeedback(null); return }
    // En combat : on accepte le board serveur sauf si JE contrôle le board et
    // qu'on est dans le même assaut (sinon je clobbe mes mouvements en cours).
    if (assaultChanged || statusChanged) { setBoard(s.board || {}); setSharedFeedback(null) }
    else if (!iControlRef.current) setBoard(s.board || {})
  }, [])

  // Rejoint l'arène ouverte au montage.
  useEffect(() => {
    if (!user?.id) return
    let alive = true
    ;(async () => {
      const { data: res, error } = await supabase.functions.invoke('raid', {
        body: { action: 'join', player_id: user.id, pseudo: user.pseudo },
      })
      if (!alive) return
      if (error || res?.error) { setNoArena(true); setLoading(false); return }
      setSessionId(res.session.id)
      applyState(res)
      setLoading(false)
    })()
    return () => { alive = false }
  }, [user?.id, user?.pseudo, applyState])

  // Abonnements realtime (pg changes + broadcast) une fois la session connue.
  useEffect(() => {
    if (!sessionId || !user?.id) return
    const refresh = async () => {
      const res = await supabase.functions.invoke('raid', {
        body: { action: 'state', player_id: user.id, session_id: sessionId },
      })
      if (res.data) applyState(res.data)
    }
    const channel = supabase.channel(`raid-${sessionId}`, { config: { broadcast: { self: false } } })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orienta_raid_sessions', filter: `id=eq.${sessionId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orienta_raid_participants', filter: `session_id=eq.${sessionId}` }, refresh)
      .on('broadcast', { event: 'chat' }, ({ payload }) => setChat(c => [...c.slice(-80), payload]))
      .on('broadcast', { event: 'board' }, ({ payload }) => { if (!iControlRef.current) setBoard(payload.board || {}) })
      .on('broadcast', { event: 'feedback' }, ({ payload }) => setSharedFeedback(payload.fb || null))
      .subscribe()
    channelRef.current = channel
    return () => { supabase.removeChannel(channel); channelRef.current = null }
  }, [sessionId, user?.id, applyState])

  const broadcast = useCallback((event, payload) => {
    channelRef.current?.send({ type: 'broadcast', event, payload })
  }, [])

  // ── Actions ────────────────────────────────────────────────────────
  const claimRole   = useCallback((r) => call('claim-role', { role: r }).then(applyState), [call, applyState])
  const releaseRole = useCallback(()  => call('release-role').then(applyState), [call, applyState])
  const setReady    = useCallback((ready) => call('ready', { ready }).then(applyState), [call, applyState])

  // La Main pose/tourne : optimiste local + persistance + broadcast.
  const moveBoard = useCallback((next) => {
    if (!iControlRef.current) return
    setBoard(next)
    broadcast('board', { board: next })
    call('move', { board: next })
  }, [broadcast, call])

  const validate = useCallback(async () => {
    const res = await call('validate')
    if (res?.state) applyState(res.state)
    return res
  }, [call, applyState])

  const shareFeedback = useCallback((fb) => broadcast('feedback', { fb }), [broadcast])
  const sendChat = useCallback((text) => {
    const t = String(text || '').trim().slice(0, 240)
    if (!t) return
    const msg = { pseudo: user?.pseudo, text: t, ts: Date.now() }
    setChat(c => [...c.slice(-80), msg])
    broadcast('chat', msg)
  }, [broadcast, user?.pseudo])

  const signalTimeout = useCallback(() => call('timeout').then(r => { if (r?.state) applyState(r.state) }), [call, applyState])
  const openTest = useCallback((adminSecret) => call('open-test', { admin_secret: adminSecret }), [call])

  // Quitte proprement à la fermeture.
  useEffect(() => {
    if (!sessionId || !user?.id) return
    const onUnload = () => { supabase.functions.invoke('raid', { body: { action: 'leave', player_id: user.id, session_id: sessionId } }) }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [sessionId, user?.id])

  return {
    loading, noArena, sessionId,
    session: data?.session ?? null,
    roster: data?.roster ?? [],
    me: data?.me ?? null,
    view: data?.view ?? {},
    board, chat, sharedFeedback,
    role,
    actions: { claimRole, releaseRole, setReady, moveBoard, validate, shareFeedback, sendChat, signalTimeout, openTest },
  }
}
