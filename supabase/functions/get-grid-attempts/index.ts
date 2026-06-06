import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// Renvoie le détail des tentatives de TOUS les joueurs d'une grille (la
// disposition exacte tentée + le feedback de chaque essai), pour alimenter le
// parcours des joueurs dans le dashboard. Réservé au CRÉATEUR de la grille :
// voir le jeu des autres révèle des fausses pistes vers la solution, donc on
// ne l'expose pas aux simples finishers (eux gardent l'accès à la solution via
// get-solution). Sinon → 403.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let body: { grid_id?: string; user_id?: string }
  try { body = await req.json() } catch { return json({ error: 'invalid body' }, 400) }
  const { grid_id, user_id } = body
  if (!grid_id) return json({ error: 'grid_id required' }, 400)
  if (!user_id) return json({ error: 'user_id required' }, 400)

  // Gate d'accès : créateur de la grille uniquement.
  const { data: grid } = await supabase
    .from('orienta_grids')
    .select('id, creator_id')
    .eq('id', grid_id)
    .single()
  if (!grid) return json({ error: 'grid not found' }, 404)
  if (grid.creator_id !== user_id) return json({ error: 'forbidden' }, 403)

  // Parties terminées de la grille → leurs id servent à récupérer les essais.
  const { data: plays } = await supabase
    .from('orienta_plays')
    .select('id')
    .eq('grid_id', grid_id)
  const playIds = (plays ?? []).map((p) => p.id)
  if (playIds.length === 0) return json({ attempts: [] })

  const { data: attempts } = await supabase
    .from('orienta_play_attempts')
    .select('play_id, attempt_number, answer, correct_full, correct_rotation, neither')
    .in('play_id', playIds)
    .order('attempt_number', { ascending: true })

  return json({ attempts: attempts ?? [] })
})
