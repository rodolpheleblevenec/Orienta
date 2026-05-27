import { create } from 'zustand'
import { supabase } from '../lib/supabase'

const STORAGE_KEY = 'orienta_user_id'

export const useAuthStore = create((set, get) => ({
  user: null,      // row from orienta_users
  loading: true,
  tutorialOpen: false,

  // Called on app boot — rehydrate from localStorage
  init: async () => {
    const savedId = localStorage.getItem(STORAGE_KEY)
    if (!savedId) { set({ loading: false }); return }

    const { data } = await supabase
      .from('orienta_users')
      .select('*')
      .eq('id', savedId)
      .single()

    set({ user: data ?? null, loading: false })
  },

  // Login or create by pseudo
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
    set({ user: null })
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

  openTutorial: () => set({ tutorialOpen: true }),
  closeTutorial: () => set({ tutorialOpen: false }),
}))
