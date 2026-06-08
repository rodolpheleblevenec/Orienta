import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// Met en pause / reprend le chrono d'une partie en cours.
// Les transitions sont horodatées par l'HORLOGE SERVEUR (le client ne fournit
// jamais de durée) → le temps de pause n'est pas falsifiable.
//   • pause  : pose paused_at = now() (no-op si déjà en pause)
//   • resume : cumule (now - paused_at) dans paused_seconds, puis paused_at = NULL
// Idempotent dans les deux sens. Aucun effet sur une partie déjà terminée.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let body: { play_id?: string; action?: string }
  try { body = await req.json() } catch { return json({ error: 'invalid body' }, 400) }
  const { play_id, action } = body
  if (!play_id) return json({ error: 'play_id required' }, 400)
  if (action !== 'pause' && action !== 'resume') return json({ error: 'invalid action' }, 400)

  const { data: play } = await supabase
    .from('orienta_plays')
    .select('id, paused_at, paused_seconds, completed_at')
    .eq('id', play_id)
    .single()
  if (!play) return json({ error: 'play not found' }, 404)

  // Partie terminée → plus de chrono à manipuler.
  if (play.completed_at) return json({ ok: true, paused_seconds: play.paused_seconds ?? 0 })

  if (action === 'pause') {
    // Idempotent : ne réécrit pas paused_at si une pause est déjà en cours.
    if (!play.paused_at) {
      await supabase.from('orienta_plays')
        .update({ paused_at: new Date().toISOString() })
        .eq('id', play_id).is('paused_at', null)
    }
    return json({ ok: true, paused_seconds: play.paused_seconds ?? 0 })
  }

  // resume
  if (!play.paused_at) return json({ ok: true, paused_seconds: play.paused_seconds ?? 0 })
  const pausedFor = Math.max(0, Math.floor((Date.now() - new Date(play.paused_at).getTime()) / 1000))
  const newPaused = (play.paused_seconds ?? 0) + pausedFor
  await supabase.from('orienta_plays')
    .update({ paused_seconds: newPaused, paused_at: null })
    .eq('id', play_id)
  return json({ ok: true, paused_seconds: newPaused })
})
