import { create } from 'zustand'
import { supabase } from '../lib/supabase'

const STORAGE_KEY = 'orienta_user_id'

export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,
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
    }
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
    return { user: data.user, isNew: data.isNew }
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

  markNotifsRead: async () => {
    const { user } = get()
    if (!user) return
    set({ notifCount: 0 })
    const { data, error } = await supabase.functions.invoke('account', {
      body: { action: 'notifs-read', user_id: user.id },
    })
    if (error || data?.error) get().fetchNotifCount(user.id) // resynchronise si échec
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
