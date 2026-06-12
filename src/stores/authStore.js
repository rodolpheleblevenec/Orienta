import { create } from 'zustand'
import { supabase } from '../lib/supabase'

const STORAGE_KEY = 'orienta_user_id'

export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,
  notifCount: 0,
  quests: { daily: [], weekly: [] },

  init: async () => {
    const savedId = localStorage.getItem(STORAGE_KEY)
    if (!savedId) { set({ loading: false }); return }

    const { data } = await supabase
      .from('orienta_users')
      .select('*')
      .eq('id', savedId)
      .single()

    set({ user: data ?? null, loading: false })
    if (data) {
      get().fetchNotifCount(data.id)
      get().fetchQuests(data.id)
      get().pingSeen(data.id)
    }
  },

  // Trace la connexion du jour (stats admin) — fire-and-forget, ne bloque jamais l'UI.
  pingSeen: (userId) => {
    const id = userId ?? get().user?.id
    if (!id) return
    supabase.functions.invoke('account', { body: { action: 'seen', user_id: id } }).catch(() => {})
  },

  loginWithPseudo: async (pseudo) => {
    const trimmed = pseudo.trim()
    if (!trimmed) return { error: 'Pseudo vide' }

    // Get-or-create côté serveur (atomique) — le client n'écrit plus en base.
    const { data, error } = await supabase.functions.invoke('account', {
      body: { action: 'login', pseudo: trimmed },
    })
    if (error || !data || data.error || !data.user) {
      return { error: 'Ce pseudo est déjà pris ou invalide.' }
    }

    localStorage.setItem(STORAGE_KEY, data.user.id)
    set({ user: data.user })
    get().fetchNotifCount(data.user.id)
    get().fetchQuests(data.user.id)
    get().pingSeen(data.user.id)
    return { user: data.user, isNew: data.isNew }
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ user: null, notifCount: 0, quests: { daily: [], weekly: [] } })
  },

  refreshUser: async () => {
    const { user } = get()
    if (!user) return
    const { data } = await supabase
      .from('orienta_users')
      .select('*')
      .eq('id', user.id)
      .single()
    if (data) set({ user: data })
  },

  fetchNotifCount: async (userId) => {
    const id = userId ?? get().user?.id
    if (!id) return
    const { count } = await supabase
      .from('orienta_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', id)
      .eq('read', false)
    set({ notifCount: count ?? 0 })
  },

  markNotifsRead: async () => {
    const { user } = get()
    if (!user) return
    set({ notifCount: 0 })
    const { data, error } = await supabase.functions.invoke('account', {
      body: { action: 'notifs-read', user_id: user.id },
    })
    if (error || data?.error) get().fetchNotifCount(user.id) // resynchronise si échec
  },

  // Quêtes du jour / de la semaine (création paresseuse + lecture côté serveur).
  fetchQuests: async (userId) => {
    const id = userId ?? get().user?.id
    if (!id) return
    const { data, error } = await supabase.functions.invoke('quests', {
      body: { action: 'list', user_id: id },
    })
    if (!error && data?.quests) set({ quests: data.quests })
  },

  // Réclame la récompense (jetons) d'une quête accomplie, puis resynchronise.
  claimQuest: async (progressId) => {
    const { user } = get()
    if (!user || !progressId) return { error: 'no user' }
    const { data, error } = await supabase.functions.invoke('quests', {
      body: { action: 'claim', user_id: user.id, progress_id: progressId },
    })
    if (error || data?.error || !data?.claimed) {
      get().fetchQuests(user.id)
      return { error: 'claim failed' }
    }
    // Crédit optimiste du solde de jetons renvoyé par le serveur.
    if (typeof data.jetons === 'number') set({ user: { ...user, jetons: data.jetons } })
    get().fetchQuests(user.id)
    return { reward_jetons: data.reward_jetons ?? 0, jetons: data.jetons }
  },

  markTourDone: async (flag) => {
    const { user } = get()
    if (!user) return
    set({ user: { ...user, [flag]: true } })
    const { data, error } = await supabase.functions.invoke('account', {
      body: { action: 'flag', user_id: user.id, flag },
    })
    if (error || data?.error) get().refreshUser() // resynchronise si échec
  },
}))
