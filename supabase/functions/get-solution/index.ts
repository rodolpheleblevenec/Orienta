import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// Révèle la solution d'une grille (positions + rotations des cartes), réservée
// aux joueurs autorisés (anti-triche). Une grille révélée à un joueur qui n'a
// pas encore terminé sa partie permettrait de copier la réponse.
// Accès accordé si :
//   - le demandeur est le créateur de la grille, OU
//   - le demandeur a une partie TERMINÉE (completed_at non nul) sur cette grille.
// Sinon → 403. La solution ne sort jamais du serveur autrement.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let body: { grid_id?: string; player_id?: string }
  try { body = await req.json() } catch { return json({ error: 'invalid body' }, 400) }
  const { grid_id, player_id } = body
  if (!grid_id) return json({ error: 'grid_id required' }, 400)
  if (!player_id) return json({ error: 'player_id required' }, 400)

  // Grille (existence + créateur + indices)
  const { data: grid } = await supabase
    .from('orienta_grids')
    .select('id, creator_id, clue_top, clue_right, clue_bottom, clue_left')
    .eq('id', grid_id)
    .single()
  if (!grid) return json({ error: 'grid not found' }, 404)

  // Gate d'accès : créateur OU partie terminée.
  let allowed = grid.creator_id === player_id
  if (!allowed) {
    const { data: play } = await supabase
      .from('orienta_plays')
      .select('id')
      .eq('grid_id', grid_id)
      .eq('player_id', player_id)
      .not('completed_at', 'is', null)
      .limit(1)
      .maybeSingle()
    allowed = !!play
  }
  if (!allowed) return json({ error: 'forbidden' }, 403)

  // Toutes les cartes de la grille (positions 0–3 + éventuel leurre en -1) avec
  // le contenu complet. Le leurre est nécessaire pour reconstruire les essais
  // d'un joueur côté client ; les consommateurs filtrent 0–3 pour l'affichage
  // de la solution. (Réservé aux finishers/créateur → pas de fuite.)
  const { data: gridCards } = await supabase
    .from('orienta_grid_cards')
    .select('position, rotation, card_id, orienta_word_cards(*)')
    .eq('grid_id', grid_id)

  return json({
    cards: gridCards ?? [],
    clues: {
      top: grid.clue_top,
      right: grid.clue_right,
      bottom: grid.clue_bottom,
      left: grid.clue_left,
    },
  })
})
