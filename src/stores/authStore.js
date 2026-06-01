import { create } from 'zustand'
import { supabase } from '../lib/supabase'

const STORAGE_KEY = 'orienta_user_id'

export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,
  tutorialOpen: false,
  notifCount: 0,

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
      get().checkStreakDanger()
      if (!data.tutorial_modal_done) set({ tutorialOpen: true })
    }
  },

  loginWithPseudo: async (pseudo) => {
    const trimmed = pseudo.trim()
    if (!trimmed) return { error: 'Pseudo vide' }

    const { data: existing } = await supabase
      .from('orienta_users')
      .select('*')
      .eq('pseudo', trimmed)
      .single()

    if (existing) {
      localStorage.setItem(STORAGE_KEY, existing.id)
      set({ user: existing })
      get().fetchNotifCount(existing.id)
      get().checkStreakDanger()
      if (!existing.tutorial_modal_done) set({ tutorialOpen: true })
      return { user: existing, isNew: false }
    }

    const { data: created, error } = await supabase
      .from('orienta_users')
      .insert({ pseudo: trimmed })
      .select()
      .single()

    if (error) return { error: 'Ce pseudo est déjà pris ou invalide.' }

    localStorage.setItem(STORAGE_KEY, created.id)
    set({ user: created, tutorialOpen: true })
    return { user: created, isNew: true }
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ user: null, notifCount: 0 })
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

  checkStreakDanger: async () => {
    const { user } = get()
    if (!user?.last_played_at || !user?.streak_current) return

    const yesterday = new Date(Date.now() - 86400000).toDateString()
    const lastPlayed = new Date(user.last_played_at).toDateString()
    if (lastPlayed !== yesterday) return

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const { count } = await supabase
      .from('orienta_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .contains('payload', { type: 'streak_danger' })
      .gte('created_at', todayStart.toISOString())
    if ((count ?? 0) > 0) return

    await supabase.from('orienta_notifications').insert({
      user_id: user.id,
      type: 'streak_danger',
      payload: { streak_current: user.streak_current },
    })
    get().fetchNotifCount()
  },

  markNotifsRead: async () => {
    const { user } = get()
    if (!user) return
    await supabase
      .from('orienta_notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)
    set({ notifCount: 0 })
  },

  openTutorial: () => set({ tutorialOpen: true }),
  closeTutorial: () => set({ tutorialOpen: false }),

  markTourDone: async (flag) => {
    const { user } = get()
    if (!user) return
    await supabase.from('orienta_users').update({ [flag]: true }).eq('id', user.id)
    set({ user: { ...user, [flag]: true } })
  },
}))
