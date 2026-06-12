import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

type ShopItem = {
  code: string
  family: string
  kind: string
  cost_jetons: number
  payload: Record<string, unknown>
  title: string
  description: string
  sort_order: number
}

// Boutique jetons (Phase 1) :
//   - list  : catalogue actif + possessions du joueur + solde/équipés/compteurs
//   - buy   : achat (unlock OU consommable) via purchase_item (débit atomique)
//   - equip : équipe/retire un cosmétique possédé via equip_unlock
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let body: {
    action?: string; user_id?: string; item_code?: string; equip?: boolean
    grid_id?: string; amount?: number; recipient_id?: string; recipient_pseudo?: string
    new_pseudo?: string; status?: string | null
  }
  try { body = await req.json() } catch { return json({ error: 'invalid body' }, 400) }
  const { action } = body

  const userId = body.user_id
  if (!userId) return json({ error: 'user_id required' }, 400)

  if (action === 'list') {
    const [{ data: items }, { data: unlocks }, { data: user }] = await Promise.all([
      supabase.from('orienta_shop_items')
        .select('code, family, kind, cost_jetons, payload, title, description, sort_order')
        .eq('active', true)
        .order('sort_order', { ascending: true }),
      supabase.from('orienta_user_unlocks')
        .select('item_code, equipped')
        .eq('user_id', userId),
      supabase.from('orienta_users')
        .select('jetons, equipped_frame, equipped_color, equipped_title, equipped_victory, equipped_theme, status_text, streak_freeze_tokens, extra_create_slots, rename_tokens')
        .eq('id', userId)
        .single(),
    ])

    const ownedMap = new Map((unlocks ?? []).map((u) => [u.item_code as string, u.equipped as boolean]))
    const all = (items ?? []) as ShopItem[]
    // Les "actions" (reroll/boost/gift) ne sont pas achetables depuis la liste boutique
    // (elles ont leur propre point d'entrée) → on les sépare et on n'expose que leur coût.
    const mapped = all.filter((it) => it.kind !== 'action').map((it) => ({
      ...it,
      owned: ownedMap.has(it.code),
      equipped: ownedMap.get(it.code) === true,
    }))
    const actionCosts: Record<string, number> = {}
    for (const it of all) if (it.kind === 'action') actionCosts[it.code] = it.cost_jetons

    return json({
      jetons: user?.jetons ?? 0,
      items: mapped,
      actionCosts,
      counters: {
        streak_freeze_tokens: user?.streak_freeze_tokens ?? 0,
        extra_create_slots: user?.extra_create_slots ?? 0,
        rename_tokens: user?.rename_tokens ?? 0,
      },
      status: user?.status_text ?? null,
      equipped: {
        frame: user?.equipped_frame ?? null,
        color: user?.equipped_color ?? null,
        title: user?.equipped_title ?? null,
        victory: user?.equipped_victory ?? null,
        theme: user?.equipped_theme ?? null,
      },
    })
  }

  if (action === 'buy') {
    const itemCode = body.item_code
    if (!itemCode) return json({ error: 'item_code required' }, 400)
    const { data, error } = await supabase.rpc('purchase_item', {
      p_user_id: userId, p_item_code: itemCode,
    })
    if (error) return json({ error: 'could not buy' }, 500)
    return json(data ?? { ok: false })
  }

  if (action === 'equip') {
    const itemCode = body.item_code
    if (!itemCode) return json({ error: 'item_code required' }, 400)
    const { data, error } = await supabase.rpc('equip_unlock', {
      p_user_id: userId, p_item_code: itemCode, p_equip: body.equip !== false,
    })
    if (error) return json({ error: 'could not equip' }, 500)
    return json(data ?? { ok: false })
  }

  // Reroll des cartes en création : débit du coût catalogue (reroll_cards) ; le
  // client re-tire les mots côté CreatePage. Aucun effet de jeu (pas de triche).
  if (action === 'reroll') {
    const { data: item } = await supabase.from('orienta_shop_items')
      .select('cost_jetons, active').eq('code', 'reroll_cards').maybeSingle()
    if (!item || item.active === false) return json({ error: 'reroll_unavailable' }, 400)
    const { data, error } = await supabase.rpc('spend_jetons', {
      p_user_id: userId, p_cost: item.cost_jetons,
    })
    if (error) return json({ error: 'could not reroll' }, 500)
    return json(data ?? { ok: false })
  }

  // Offrir des jetons : résolution du destinataire par pseudo côté serveur.
  if (action === 'gift') {
    const amount = Math.floor(Number(body.amount))
    if (!Number.isFinite(amount) || amount <= 0) return json({ error: 'bad_amount' }, 400)
    let recipientId = body.recipient_id
    if (!recipientId && body.recipient_pseudo) {
      const { data: r } = await supabase.from('orienta_users')
        .select('id').eq('pseudo', body.recipient_pseudo.trim()).maybeSingle()
      if (!r) return json({ ok: false, error: 'recipient_not_found' })
      recipientId = r.id as string
    }
    if (!recipientId) return json({ error: 'recipient required' }, 400)
    const { data, error } = await supabase.rpc('gift_jetons', {
      p_sender: userId, p_recipient: recipientId, p_amount: amount,
    })
    if (error) return json({ error: 'could not gift' }, 500)
    return json(data ?? { ok: false })
  }

  // Configuration de la roue : segments (pour le rendu) + coût d'un tour.
  if (action === 'wheel') {
    const [{ data: segments }, { data: item }] = await Promise.all([
      supabase.from('orienta_wheel_segments')
        .select('idx, label, reward_type, reward_value, color')
        .eq('active', true).order('idx', { ascending: true }),
      supabase.from('orienta_shop_items').select('cost_jetons').eq('code', 'wheel_spin').maybeSingle(),
    ])
    return json({ segments: segments ?? [], cost: item?.cost_jetons ?? null })
  }

  // Un tour de roue : débit + tirage serveur + lot, renvoie le segment gagné.
  if (action === 'spin') {
    const { data, error } = await supabase.rpc('spin_wheel', { p_user_id: userId })
    if (error) return json({ error: 'could not spin' }, 500)
    return json(data ?? { ok: false })
  }

  // Renommage : consomme un jeton de renommage (validations + unicité côté RPC).
  if (action === 'rename') {
    const np = (body.new_pseudo ?? '').toString()
    const { data, error } = await supabase.rpc('rename_user', { p_user_id: userId, p_new_pseudo: np })
    if (error) return json({ error: 'could not rename' }, 500)
    return json(data ?? { ok: false })
  }

  // Statut perso : exige l'unlock status_custom (vérifié côté RPC). status=null → efface.
  if (action === 'set_status') {
    const st = body.status == null ? '' : String(body.status)
    const { data, error } = await supabase.rpc('set_user_status', { p_user_id: userId, p_status: st })
    if (error) return json({ error: 'could not set status' }, 500)
    return json(data ?? { ok: false })
  }

  return json({ error: 'unknown action' }, 400)
})
