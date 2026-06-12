import { create } from 'zustand'
import { supabase } from '../lib/supabase'

const STORAGE_KEY = 'orienta_user_id'

export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,
  notifCount: 0,
  quests: { daily: [], weekly: [] },
  shop: { items: [], counters: {}, equipped: {}, actionCosts: {} },

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
      get().fetchShop(data.id)
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
    get().fetchShop(data.user.id)
    get().pingSeen(data.user.id)
    return { user: data.user, isNew: data.isNew }
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ user: null, notifCount: 0, quests: { daily: [], weekly: [] }, shop: { items: [], counters: {}, equipped: {}, actionCosts: {} } })
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

  // Boutique : catalogue + possessions + solde/équipés/compteurs.
  fetchShop: async (userId) => {
    const id = userId ?? get().user?.id
    if (!id) return
    const { data, error } = await supabase.functions.invoke('shop', {
      body: { action: 'list', user_id: id },
    })
    if (!error && data && !data.error) {
      set({ shop: { items: data.items ?? [], counters: data.counters ?? {}, equipped: data.equipped ?? {}, actionCosts: data.actionCosts ?? {} } })
    }
  },

  // Achète un article (unlock ou consommable). Débit serveur atomique.
  buyItem: async (itemCode) => {
    const { user } = get()
    if (!user || !itemCode) return { error: 'no user' }
    const { data, error } = await supabase.functions.invoke('shop', {
      body: { action: 'buy', user_id: user.id, item_code: itemCode },
    })
    if (error || !data || data.error || data.ok === false) {
      get().fetchShop(user.id)
      return { error: data?.error ?? 'buy_failed' }
    }
    // Débit optimiste du solde renvoyé par le serveur.
    if (typeof data.jetons === 'number') set({ user: { ...get().user, jetons: data.jetons } })
    // Resynchronise le user complet : les compteurs consommables (extra_create_slots,
    // streak_freeze_tokens) vivent sur la row user et doivent être à jour tout de suite.
    await get().refreshUser()
    get().fetchShop(user.id)
    return { ok: true, jetons: data.jetons, already_owned: data.already_owned === true }
  },

  // Équipe / retire un cosmétique possédé, puis resynchronise (rendu cadre/flair).
  equipItem: async (itemCode, equip) => {
    const { user } = get()
    if (!user || !itemCode) return { error: 'no user' }
    const { data, error } = await supabase.functions.invoke('shop', {
      body: { action: 'equip', user_id: user.id, item_code: itemCode, equip },
    })
    if (error || data?.error || data?.ok === false) {
      get().fetchShop(user.id)
      return { error: 'equip_failed' }
    }
    await get().refreshUser()   // recharge les colonnes equipped_* sur le user
    get().fetchShop(user.id)
    return { ok: true }
  },

  // Relance le tirage des cartes en création (débit serveur ; le client re-tire).
  rerollCards: async () => {
    const { user } = get()
    if (!user) return { error: 'no user' }
    const { data, error } = await supabase.functions.invoke('shop', {
      body: { action: 'reroll', user_id: user.id },
    })
    if (error || !data || data.error || data.ok === false) {
      return { error: data?.error ?? 'reroll_failed' }
    }
    if (typeof data.jetons === 'number') set({ user: { ...get().user, jetons: data.jetons } })
    return { ok: true, jetons: data.jetons }
  },

  // Coup de projecteur : met une grille de la communauté en avant (1/joueur/grille).
  boostGrid: async (gridId) => {
    const { user } = get()
    if (!user || !gridId) return { error: 'no user' }
    const { data, error } = await supabase.functions.invoke('shop', {
      body: { action: 'boost', user_id: user.id, grid_id: gridId },
    })
    if (error || !data || data.error || data.ok === false) return { error: data?.error ?? 'boost_failed' }
    if (typeof data.jetons === 'number') set({ user: { ...get().user, jetons: data.jetons } })
    return { ok: true, jetons: data.jetons, boost_count: data.boost_count, already_boosted: data.already_boosted === true }
  },

  // Offrir des jetons à un autre joueur (par pseudo).
  giftJetons: async (recipientPseudo, amount) => {
    const { user } = get()
    if (!user) return { error: 'no user' }
    const { data, error } = await supabase.functions.invoke('shop', {
      body: { action: 'gift', user_id: user.id, recipient_pseudo: recipientPseudo, amount },
    })
    if (error || !data || data.error || data.ok === false) return { error: data?.error ?? 'gift_failed' }
    if (typeof data.jetons === 'number') set({ user: { ...get().user, jetons: data.jetons } })
    return { ok: true, jetons: data.jetons, amount: data.amount }
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
