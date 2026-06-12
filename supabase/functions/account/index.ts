import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// Flags de tutoriel autorisés (whitelist anti-écriture de colonne arbitraire).
const ALLOWED_FLAGS = new Set([
  'tutorial_modal_done', 'tour_play_done', 'tour_create_placement_done',
  'tour_create_clues_done', 'community_unlocked_seen', 'new_wojo_seen',
])
const SUGGESTION_MAX = 1000

// Pseudos réservés : comptes système non accessibles aux joueurs (ni création,
// ni connexion). Comparaison insensible à la casse et aux espaces.
const RESERVED_PSEUDOS = new Set(['orienta'])

// Écritures liées au COMPTE déplacées côté serveur :
//   - login   : get-or-create d'un utilisateur par pseudo (atomique)
//   - flag    : marquer un flag de tutoriel (whitelist)
//   - skin    : changer le skin sélectionné (1..15)
//   - notifs-read : marquer ses notifications comme lues
//   - suggestion  : envoyer une idée (pseudo relu côté serveur, jamais le client)
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let body: { action?: string; pseudo?: string; user_id?: string; flag?: string; skin?: number; content?: string; grant_id?: string }
  // (ci-dessous) action `seen` : trace la connexion du joueur du jour (stats admin)
  try { body = await req.json() } catch { return json({ error: 'invalid body' }, 400) }
  const { action } = body

  // ─── Connexion / inscription (get-or-create) ───
  if (action === 'login') {
    const pseudo = (body.pseudo ?? '').trim()
    if (!pseudo) return json({ error: 'pseudo required' }, 400)
    if (pseudo.length > 40) return json({ error: 'pseudo too long' }, 400)
    // Pseudo réservé (compte système) : blocage AVANT le get-or-create, pour
    // empêcher à la fois la création et la connexion sur ce compte.
    if (RESERVED_PSEUDOS.has(pseudo.toLowerCase())) return json({ error: 'pseudo reserved' }, 403)

    const { data: existing } = await supabase
      .from('orienta_users').select('*').eq('pseudo', pseudo).maybeSingle()
    if (existing) return json({ user: existing, isNew: false })

    const { data: created, error } = await supabase
      .from('orienta_users').insert({ pseudo }).select().single()
    if (error || !created) {
      // Course possible sur la contrainte unique → on relit.
      const { data: again } = await supabase
        .from('orienta_users').select('*').eq('pseudo', pseudo).maybeSingle()
      if (again) return json({ user: again, isNew: false })
      return json({ error: 'could not create user' }, 400)
    }
    return json({ user: created, isNew: true })
  }

  // Toutes les autres actions exigent un user_id.
  const userId = body.user_id
  if (!userId) return json({ error: 'user_id required' }, 400)

  if (action === 'flag') {
    const { flag } = body
    if (!flag || !ALLOWED_FLAGS.has(flag)) return json({ error: 'invalid flag' }, 400)
    await supabase.from('orienta_users').update({ [flag]: true }).eq('id', userId)
    return json({ ok: true })
  }

  if (action === 'skin') {
    const skin = body.skin
    if (typeof skin !== 'number' || !Number.isInteger(skin) || skin < 1 || skin > 15) {
      return json({ error: 'invalid skin' }, 400)
    }
    await supabase.from('orienta_users').update({ selected_skin: skin }).eq('id', userId)
    return json({ ok: true })
  }

  // ─── Trace la connexion du jour (1 ligne par joueur/jour) pour les stats admin ───
  if (action === 'seen') {
    const today = new Date().toISOString().slice(0, 10)
    await supabase
      .from('orienta_daily_active')
      .upsert({ user_id: userId, active_date: today }, { onConflict: 'user_id,active_date', ignoreDuplicates: true })
    return json({ ok: true })
  }

  if (action === 'notifs-read') {
    await supabase.from('orienta_notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
    return json({ ok: true })
  }

  // ─── Marque la modale d'accompagnement « tu as gagné » comme vue (1 seule fois) ───
  if (action === 'grant-seen') {
    const grantId = body.grant_id
    if (!grantId) return json({ error: 'grant_id required' }, 400)
    await supabase.from('orienta_grid_grants')
      .update({ onboarding_seen_at: new Date().toISOString() })
      .eq('id', grantId).eq('winner_user_id', userId).is('onboarding_seen_at', null)
    return json({ ok: true })
  }

  if (action === 'suggestion') {
    const content = (body.content ?? '').trim().slice(0, SUGGESTION_MAX)
    if (!content) return json({ error: 'empty content' }, 400)
    // Pseudo relu en base (on ne fait pas confiance au client).
    const { data: user } = await supabase.from('orienta_users').select('pseudo').eq('id', userId).single()
    if (!user) return json({ error: 'user not found' }, 404)
    await supabase.from('orienta_suggestions').insert({
      user_id: userId, pseudo: user.pseudo, content, status: 'nouveau',
    })
    return json({ ok: true })
  }

  return json({ error: 'unknown action' }, 400)
})
