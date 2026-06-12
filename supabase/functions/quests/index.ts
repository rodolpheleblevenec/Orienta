import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// Clé de jour (heure de Paris) 'YYYY-MM-DD' — miroir de daily-rollover/index.ts.
function parisDateKey(): string {
  return new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' })
}

// Clé de semaine ISO 'YYYY-Www' dérivée du jour Paris (cf. check-attempt/index.ts).
function isoWeekKey(): string {
  const date = new Date(parisDateKey() + 'T00:00:00Z')
  const day = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - day + 3)
  const isoYear = date.getUTCFullYear()
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4))
  const fd = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fd + 3)
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86400000))
  return `${isoYear}-W${String(week).padStart(2, '0')}`
}

type QuestRow = {
  id: string
  scope: string
  progress: number
  target: number
  completed_at: string | null
  claimed_at: string | null
  orienta_quests: {
    code: string
    title: string
    description: string
    goal_type: string
    threshold_seconds: number | null
    reward_jetons: number
    sort_order: number
  } | null
}

// Quêtes quotidiennes/hebdo (récompense en jetons, claim manuel) :
//   - list  : garantit les lignes de la période courante (création paresseuse) puis
//             renvoie les quêtes daily + weekly avec progression/état.
//   - claim : crédite la récompense d'une quête accomplie (idempotent).
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let body: { action?: string; user_id?: string; progress_id?: string }
  try { body = await req.json() } catch { return json({ error: 'invalid body' }, 400) }
  const { action } = body

  const userId = body.user_id
  if (!userId) return json({ error: 'user_id required' }, 400)

  if (action === 'list') {
    const dailyKey = parisDateKey()
    const weekKey = isoWeekKey()

    // Création paresseuse des lignes de période (idempotent).
    await supabase.rpc('ensure_quest_period', { p_user_id: userId, p_scope: 'daily', p_period_key: dailyKey })
    await supabase.rpc('ensure_quest_period', { p_user_id: userId, p_scope: 'weekly', p_period_key: weekKey })

    const { data, error } = await supabase
      .from('orienta_quest_progress')
      .select('id, scope, progress, target, completed_at, claimed_at, orienta_quests(code, title, description, goal_type, threshold_seconds, reward_jetons, sort_order)')
      .eq('user_id', userId)
      .or(`and(scope.eq.daily,period_key.eq.${dailyKey}),and(scope.eq.weekly,period_key.eq.${weekKey})`)
    if (error) return json({ error: 'could not load quests' }, 500)

    const map = (row: QuestRow) => {
      const q = row.orienta_quests
      const completed = row.completed_at != null
      return {
        progress_id: row.id,
        scope: row.scope,
        code: q?.code ?? null,
        title: q?.title ?? '',
        description: q?.description ?? '',
        goal_type: q?.goal_type ?? null,
        progress: row.progress,
        target: row.target,
        reward_jetons: q?.reward_jetons ?? 0,
        sort_order: q?.sort_order ?? 0,
        completed,
        claimed: row.claimed_at != null,
        claimable: completed && row.claimed_at == null,
      }
    }

    const items = ((data ?? []) as unknown as QuestRow[])
      .map(map)
      .sort((a, b) => a.sort_order - b.sort_order)
    return json({
      quests: {
        daily: items.filter((i) => i.scope === 'daily'),
        weekly: items.filter((i) => i.scope === 'weekly'),
      },
    })
  }

  if (action === 'claim') {
    const progressId = body.progress_id
    if (!progressId) return json({ error: 'progress_id required' }, 400)
    const { data, error } = await supabase.rpc('claim_quest_reward', {
      p_user_id: userId, p_progress_id: progressId,
    })
    if (error) return json({ error: 'could not claim' }, 500)
    return json(data ?? { claimed: false })
  }

  return json({ error: 'unknown action' }, 400)
})
