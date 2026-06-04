import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// Démarre (ou reprend) une partie côté serveur.
// - crée la ligne orienta_plays (le client ne l'insère plus directement)
// - renvoie la liste des cartes SANS leur position/rotation (la solution
//   ne sort jamais du serveur → anti-triche)
// - en cas de reprise, renvoie les tentatives déjà jouées par CE joueur
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let body: { grid_id?: string; player_id?: string; replay?: boolean }
  try { body = await req.json() } catch { return json({ error: 'invalid body' }, 400) }
  const { grid_id, player_id, replay } = body
  if (!grid_id) return json({ error: 'grid_id required' }, 400)
  if (!replay && !player_id) return json({ error: 'player_id required' }, 400)

  // Grille (vérifie l'existence ; les indices restent lisibles côté client)
  const { data: grid } = await supabase
    .from('orienta_grids')
    .select('id, status')
    .eq('id', grid_id)
    .single()
  if (!grid) return json({ error: 'grid not found' }, 404)

  // Cartes de la grille — on ne renvoie QUE le contenu des cartes (mots),
  // jamais position ni rotation.
  const { data: gridCards } = await supabase
    .from('orienta_grid_cards')
    .select('card_id, orienta_word_cards(id, word_top, word_right, word_bottom, word_left, difficulty, tags)')
    .eq('grid_id', grid_id)

  const cards = (gridCards ?? []).map((gc: { orienta_word_cards: unknown }) => gc.orienta_word_cards)

  // Mode rejeu : aucune partie, aucune écriture.
  if (replay) return json({ replay: true, cards })

  // Partie existante ? L'unicité (grid_id, player_id) est garantie en base,
  // mais on garde order+limit(1) par défense (ne lève jamais sur d'éventuels
  // doublons résiduels, contrairement à un maybeSingle nu).
  const { data: existingPlay } = await supabase
    .from('orienta_plays')
    .select('id, completed_at, score, xp_earned, success, time_seconds, attempts_count')
    .eq('grid_id', grid_id)
    .eq('player_id', player_id)
    .order('completed_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (existingPlay?.completed_at) {
    return json({
      completed: true,
      play: {
        score: existingPlay.score ?? 0,
        xp_earned: existingPlay.xp_earned ?? 0,
        success: existingPlay.success ?? false,
        time_seconds: existingPlay.time_seconds ?? 0,
        attempts_count: existingPlay.attempts_count ?? 1,
      },
    })
  }

  if (existingPlay) {
    const { data: attempts } = await supabase
      .from('orienta_play_attempts')
      .select('attempt_number, answer, correct_full, correct_rotation, neither')
      .eq('play_id', existingPlay.id)
      .order('attempt_number', { ascending: true })
    return json({ play_id: existingPlay.id, cards, attempts: attempts ?? [] })
  }

  // Nouvelle partie. La contrainte UNIQUE(grid_id, player_id) empêche tout
  // doublon : si une autre requête a créé la ligne en parallèle (double-clic),
  // l'insert échoue sur conflit → on récupère la partie existante au lieu
  // d'échouer (et surtout sans créer un doublon, l'ancien bug).
  const { data: play } = await supabase
    .from('orienta_plays')
    .insert({ grid_id, player_id })
    .select('id')
    .single()
  if (play) return json({ play_id: play.id, cards, attempts: [] })

  const { data: raced } = await supabase
    .from('orienta_plays')
    .select('id')
    .eq('grid_id', grid_id)
    .eq('player_id', player_id)
    .limit(1)
    .maybeSingle()
  if (!raced) return json({ error: 'could not start play' }, 500)

  const { data: attempts } = await supabase
    .from('orienta_play_attempts')
    .select('attempt_number, answer, correct_full, correct_rotation, neither')
    .eq('play_id', raced.id)
    .order('attempt_number', { ascending: true })
  return json({ play_id: raced.id, cards, attempts: attempts ?? [] })
})
