import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const MAX_TITLE_LENGTH = 60

// Définit (ou efface) le titre d'une grille communautaire. Appelé depuis la
// modale de fin de création : seul le créateur de la grille peut la titrer.
// Titre vide → remise à NULL. Réservé aux grilles communautaires (pas la
// grille du jour, qui a sa propre identité).
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let body: { grid_id?: string; user_id?: string; title?: string | null }
  try { body = await req.json() } catch { return json({ error: 'invalid body' }, 400) }
  const { grid_id, user_id, title } = body
  if (!grid_id) return json({ error: 'grid_id required' }, 400)
  if (!user_id) return json({ error: 'user_id required' }, 400)

  const { data: grid } = await supabase
    .from('orienta_grids')
    .select('id, creator_id, daily_date')
    .eq('id', grid_id)
    .single()
  if (!grid) return json({ error: 'grid not found' }, 404)
  if (grid.creator_id !== user_id) return json({ error: 'not your grid' }, 403)
  // La grille du jour garde son identité propre — pas de titre personnalisé.
  if (grid.daily_date) return json({ error: 'cannot title a daily grid' }, 409)

  const clean = (title ?? '').trim().slice(0, MAX_TITLE_LENGTH)
  const { error } = await supabase
    .from('orienta_grids')
    .update({ title: clean || null })
    .eq('id', grid_id)
  if (error) return json({ error: 'could not save title' }, 500)

  return json({ ok: true, title: clean || null })
})
