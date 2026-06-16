import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const TEXT_MAX = 240
const WINDOW_MIN = 10 // fenêtre éphémère (minutes) — au-delà, les messages disparaissent

// Chat général d'organisation — canal global stable et ÉPHÉMÈRE (10 min).
//   - history : renvoie les messages des 10 dernières minutes
//   - post    : enregistre un message (pseudo résolu côté serveur), puis purge les > 10 min
// Le live est assuré par broadcast client→client sur le canal 'orienta-general'
// (non géré ici). C'est le même canal que le SAS du RAID.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let body: { action?: string; user_id?: string; text?: string }
  try { body = await req.json() } catch { return json({ error: 'invalid body' }, 400) }
  const { action, user_id } = body
  if (!user_id) return json({ error: 'user_id required' }, 400)

  const cutoff = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString()

  // ─── Historique : 10 dernières minutes ───
  if (action === 'history') {
    const { data } = await supabase
      .from('orienta_chat')
      .select('user_id, pseudo, text, created_at')
      .gt('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(120)
    const chat = (data ?? []).map((m) => ({
      user_id: m.user_id,
      pseudo: m.pseudo ?? 'joueur',
      role: null,
      text: m.text,
      ts: new Date(m.created_at).getTime(),
    }))
    return json({ chat })
  }

  // ─── Envoi : enregistre + purge l'éphémère ───
  if (action === 'post') {
    const text = (body.text ?? '').trim().slice(0, TEXT_MAX)
    if (!text) return json({ error: 'empty' }, 400)

    // Pseudo résolu côté serveur (anti-usurpation).
    const { data: u } = await supabase
      .from('orienta_users').select('pseudo').eq('id', user_id).single()

    await supabase.from('orienta_chat').insert({ user_id, pseudo: u?.pseudo ?? 'joueur', text })

    // Éphémère : on supprime les messages de plus de 10 min (best-effort).
    await supabase.from('orienta_chat').delete().lt('created_at', cutoff)

    return json({ ok: true })
  }

  return json({ error: 'unknown action' }, 400)
})
