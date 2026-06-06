import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '😮']
const COMMENT_MAX = 280

// Interactions sociales — écritures déplacées côté serveur :
//   - comment : ne peut commenter QUE sa propre partie terminée + notifie le créateur de la grille
//   - reply   : SEUL le créateur de la grille répond à un commentaire + notifie l'auteur
//   - react   : toggle d'une réaction emoji sur un message
//   - upvote  : toggle d'un upvote de grille (jamais sa propre grille)
// Les compteurs (upvotes_count) et les notifs upvote/suggestion sont gérés par des triggers DB.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let body: {
    action?: string; user_id?: string; play_id?: string; grid_id?: string; emoji?: string; comment?: string; reply?: string
  }
  try { body = await req.json() } catch { return json({ error: 'invalid body' }, 400) }
  const { action, user_id } = body
  if (!user_id) return json({ error: 'user_id required' }, 400)

  // ─── Commentaire sur SA partie ───
  if (action === 'comment') {
    const { play_id, comment } = body
    if (!play_id) return json({ error: 'play_id required' }, 400)
    const trimmed = (comment ?? '').trim().slice(0, COMMENT_MAX)
    if (!trimmed) return json({ error: 'empty comment' }, 400)

    const { data: play } = await supabase
      .from('orienta_plays').select('id, player_id, grid_id, completed_at').eq('id', play_id).single()
    if (!play) return json({ error: 'play not found' }, 404)
    if (play.player_id !== user_id) return json({ error: 'forbidden' }, 403)
    if (!play.completed_at) return json({ error: 'play not completed' }, 403)

    await supabase.from('orienta_plays').update({ comment: trimmed }).eq('id', play_id)

    // Notifie le créateur de la grille (sauf s'il commente sa propre grille)
    if (play.grid_id) {
      const { data: grid } = await supabase
        .from('orienta_grids').select('creator_id').eq('id', play.grid_id).single()
      if (grid?.creator_id && grid.creator_id !== user_id) {
        const { data: author } = await supabase
          .from('orienta_users').select('pseudo').eq('id', user_id).single()
        await supabase.from('orienta_notifications').insert({
          user_id: grid.creator_id,
          type: 'comment',
          payload: { player_pseudo: author?.pseudo, grid_id: play.grid_id, comment: trimmed },
        })
      }
    }

    return json({ ok: true, comment: trimmed })
  }

  // ─── Réponse du créateur à un commentaire ───
  if (action === 'reply') {
    const { play_id, reply } = body
    if (!play_id) return json({ error: 'play_id required' }, 400)
    const trimmed = (reply ?? '').trim().slice(0, COMMENT_MAX)
    if (!trimmed) return json({ error: 'empty reply' }, 400)

    const { data: play } = await supabase
      .from('orienta_plays').select('id, player_id, grid_id, comment').eq('id', play_id).single()
    if (!play) return json({ error: 'play not found' }, 404)
    if (!play.comment) return json({ error: 'no comment to reply to' }, 400)
    if (!play.grid_id) return json({ error: 'grid not found' }, 404)

    // Seul le créateur de la grille peut répondre.
    const { data: grid } = await supabase
      .from('orienta_grids').select('creator_id').eq('id', play.grid_id).single()
    if (!grid) return json({ error: 'grid not found' }, 404)
    if (grid.creator_id !== user_id) return json({ error: 'forbidden' }, 403)

    const reply_at = new Date().toISOString()
    await supabase.from('orienta_plays')
      .update({ creator_reply: trimmed, creator_reply_at: reply_at }).eq('id', play_id)

    // Notifie l'auteur du commentaire (sauf s'il est lui-même le créateur).
    if (play.player_id && play.player_id !== user_id) {
      const { data: author } = await supabase
        .from('orienta_users').select('pseudo').eq('id', user_id).single()
      await supabase.from('orienta_notifications').insert({
        user_id: play.player_id,
        type: 'comment_reply',
        payload: { creator_pseudo: author?.pseudo, grid_id: play.grid_id, reply: trimmed },
      })
    }

    return json({ ok: true, reply: trimmed, reply_at })
  }

  // ─── Réaction (toggle) ───
  if (action === 'react') {
    const { play_id, emoji } = body
    if (!play_id || !emoji) return json({ error: 'play_id and emoji required' }, 400)
    if (!REACTION_EMOJIS.includes(emoji)) return json({ error: 'invalid emoji' }, 400)

    const { data: play } = await supabase
      .from('orienta_plays').select('id').eq('id', play_id).single()
    if (!play) return json({ error: 'play not found' }, 404)

    const { data: existing } = await supabase
      .from('orienta_comment_reactions')
      .select('id').eq('play_id', play_id).eq('user_id', user_id).eq('emoji', emoji).maybeSingle()

    if (existing) {
      await supabase.from('orienta_comment_reactions').delete().eq('id', existing.id)
      return json({ reacted: false })
    }
    await supabase.from('orienta_comment_reactions').insert({ play_id, user_id, emoji })
    return json({ reacted: true })
  }

  // ─── Upvote (toggle) ───
  if (action === 'upvote') {
    const { grid_id } = body
    if (!grid_id) return json({ error: 'grid_id required' }, 400)

    const { data: grid } = await supabase
      .from('orienta_grids').select('id, creator_id').eq('id', grid_id).single()
    if (!grid) return json({ error: 'grid not found' }, 404)
    if (grid.creator_id === user_id) return json({ error: 'cannot upvote own grid' }, 403)

    const { data: existing } = await supabase
      .from('orienta_grid_upvotes')
      .select('id').eq('grid_id', grid_id).eq('user_id', user_id).maybeSingle()

    let upvoted: boolean
    if (existing) {
      await supabase.from('orienta_grid_upvotes').delete().eq('id', existing.id)
      upvoted = false
    } else {
      await supabase.from('orienta_grid_upvotes').insert({ grid_id, user_id })
      upvoted = true
    }
    // Compteur maintenu par trigger DB → on relit la valeur à jour.
    const { data: fresh } = await supabase
      .from('orienta_grids').select('upvotes_count').eq('id', grid_id).single()
    return json({ upvoted, count: fresh?.upvotes_count ?? 0 })
  }

  return json({ error: 'unknown action' }, 400)
})
