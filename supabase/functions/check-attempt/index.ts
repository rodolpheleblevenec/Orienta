import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LEVEL_THRESHOLDS = [
  { level: 1, xp: 0,     name: 'Naissance' },
  { level: 2, xp: 500,   name: 'Alevin' },
  { level: 3, xp: 1500,  name: 'Banc' },
  { level: 4, xp: 3500,  name: 'Explorateur' },
  { level: 5, xp: 7000,  name: 'Voyageur' },
  { level: 6, xp: 12000, name: 'Chasseur' },
  { level: 7, xp: 20000, name: 'Sage' },
  { level: 8, xp: 35000, name: 'Légende' },
  { level: 9, xp: 55000, name: 'Titan' },
  { level: 10, xp: 80000, name: 'Immortel' },
]

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { play_id, grid_id, attempt_number, answer, replay } = await req.json()

  // Mode rejeu : on évalue juste la tentative pour le fun, sans aucun
  // effet de bord (pas de play, pas d'XP, pas de streak, pas de notif).
  let play: { player_id?: string; xp_earned?: number; orienta_grids: { id: string; creator_id?: string } } | null = null
  let gridId: string

  if (replay) {
    if (!grid_id) {
      return new Response(JSON.stringify({ error: 'grid_id required for replay' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    gridId = grid_id
  } else {
    // Load play and grid
    const { data } = await supabase
      .from('orienta_plays')
      .select('*, orienta_grids(id, creator_id)')
      .eq('id', play_id)
      .single()

    if (!data) {
      return new Response(JSON.stringify({ error: 'Play not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    play = data
    gridId = data.orienta_grids.id
  }

  // Load the official solution (server-side only)
  const { data: solution } = await supabase
    .from('orienta_grid_cards')
    .select('card_id, position, rotation')
    .eq('grid_id', gridId)

  if (!solution) {
    return new Response(JSON.stringify({ error: 'Solution not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Evaluate attempt
  const solutionMap: Record<string, { position: number; rotation: number }> = {}
  for (const s of solution) {
    solutionMap[s.card_id] = { position: s.position, rotation: s.rotation }
  }

  let correctFull = 0
  let correctRotation = 0
  let neither = 0
  const cardFeedbacks: Record<string, string> = {}

  for (const a of answer) {
    const s = solutionMap[a.card_id]
    if (!s) { neither++; cardFeedbacks[a.card_id] = 'wrong'; continue }

    const posMatch = a.position === s.position
    const rotMatch = a.rotation === s.rotation

    if (posMatch && rotMatch) {
      correctFull++
      cardFeedbacks[a.card_id] = 'correct'
    } else if ((posMatch && !rotMatch) || (!posMatch && rotMatch)) {
      correctRotation++
      cardFeedbacks[a.card_id] = 'rotation'
    } else {
      neither++
      cardFeedbacks[a.card_id] = 'wrong'
    }
  }

  const success = correctFull === 4

  // If last attempt or success: update collective XP
  // (jamais en mode rejeu — aucun gain ni effet de bord)
  const isLastAttempt = attempt_number >= 3
  if (!replay && play && (success || isLastAttempt)) {
    const xpGained = success ? Math.max(10, Math.round(play.xp_earned ?? 50)) : 5

    const { data: collective } = await supabase
      .from('orienta_collective_progress')
      .select('total_xp')
      .eq('id', 1)
      .single()

    if (collective) {
      const newXp = collective.total_xp + xpGained
      const newLevelData = [...LEVEL_THRESHOLDS].reverse().find(l => newXp >= l.xp) ?? LEVEL_THRESHOLDS[0]

      await supabase
        .from('orienta_collective_progress')
        .update({ total_xp: newXp, level: newLevelData.level, level_name: newLevelData.name, updated_at: new Date().toISOString() })
        .eq('id', 1)
    }

    // Update user streak
    const today = new Date().toDateString()
    const { data: user } = await supabase
      .from('orienta_users')
      .select('streak_current, streak_best, last_played_at, pseudo')
      .eq('id', play.player_id)
      .single()

    if (user) {
      const lastPlayed = user.last_played_at ? new Date(user.last_played_at).toDateString() : null
      const yesterday = new Date(Date.now() - 86400000).toDateString()

      let newStreak = user.streak_current
      if (lastPlayed !== today) {
        newStreak = (lastPlayed === yesterday) ? newStreak + 1 : 1
      }

      await supabase
        .from('orienta_users')
        .update({
          streak_current: newStreak,
          streak_best: Math.max(user.streak_best, newStreak),
          last_played_at: new Date().toISOString(),
          xp_contributed: (user.xp_contributed ?? 0) + xpGained,
        })
        .eq('id', play.player_id)

      // Notify creator (skip if playing own grid)
      const creatorId = play.orienta_grids?.creator_id
      if (creatorId && creatorId !== play.player_id) {
        await supabase.from('orienta_notifications').insert({
          user_id: creatorId,
          type: 'play',
          payload: { player_pseudo: user.pseudo, grid_id: play.orienta_grids.id, success },
        })
      }
    }
  }

  return new Response(
    JSON.stringify({ success, correctFull, correctRotation, neither, card_feedbacks: cardFeedbacks }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
