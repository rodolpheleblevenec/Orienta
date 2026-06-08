import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { computeScore, computeXp, xpStreakBonus, xpAttemptBonus, evaluateAttempt } from '../_shared/scoring.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const MAX_ATTEMPTS = 3
const ROTATIONS = [0, 90, 180, 270]

// Niveaux individuels (noms) — utilisés pour la notification level_up.
// Miroir des noms de src/lib/levels.js (LEVELS).
const LEVEL_NAMES: Record<number, string> = {
  1: 'Naissance', 2: 'Alevin', 3: 'Banc', 4: 'Explorateur', 5: 'Voyageur',
  6: 'Chasseur', 7: 'Sage', 8: 'Légende', 9: 'Titan', 10: 'Immortel',
}

// Valide la forme d'une réponse : exactement 4 cartes, chacune bien typée.
function isValidAnswer(answer: unknown): answer is { card_id: string; position: number; rotation: number }[] {
  if (!Array.isArray(answer) || answer.length !== 4) return false
  return answer.every((a) =>
    a && typeof a === 'object' &&
    typeof (a as { card_id?: unknown }).card_id === 'string' &&
    [0, 1, 2, 3].includes((a as { position?: unknown }).position as number) &&
    ROTATIONS.includes((a as { rotation?: unknown }).rotation as number))
}

// Autorité unique du jeu : évalue la tentative, l'enregistre, finalise la
// partie et attribue l'XP. Le client n'écrit plus aucun résultat lui-même
// et ne décide plus du numéro d'essai (calculé côté serveur).
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let body: { play_id?: string; grid_id?: string; answer?: unknown[]; replay?: boolean }
  try { body = await req.json() } catch { return json({ error: 'invalid body' }, 400) }
  const { play_id, grid_id, answer, replay } = body

  if (!isValidAnswer(answer)) return json({ error: 'invalid answer' }, 400)

  // ─── Mode rejeu : évaluation pure, aucun effet de bord ───
  if (replay) {
    if (!grid_id) return json({ error: 'grid_id required for replay' }, 400)
    const { data: solution } = await supabase
      .from('orienta_grid_cards').select('card_id, position, rotation').eq('grid_id', grid_id)
    if (!solution) return json({ error: 'solution not found' }, 404)
    const { correctFull, correctRotation, neither, cardFeedbacks } = evaluateAttempt(answer, solution as never)
    return json({ success: correctFull === 4, correctFull, correctRotation, neither, card_feedbacks: cardFeedbacks })
  }

  if (!play_id) return json({ error: 'play_id required' }, 400)

  // ─── Partie réelle ───
  const { data: play } = await supabase
    .from('orienta_plays')
    .select('id, player_id, started_at, completed_at, paused_at, paused_seconds, orienta_grids(id, creator_id, daily_date)')
    .eq('id', play_id)
    .single()
  if (!play) return json({ error: 'play not found' }, 404)

  const gridIdResolved = (play.orienta_grids as { id: string }).id
  const creatorId = (play.orienta_grids as { creator_id?: string }).creator_id
  // Grille du jour = grille "maison" (créateur = compte système) : pas de notif de jeu.
  const isDailyGrid = !!(play.orienta_grids as { daily_date?: string }).daily_date

  const { data: solution } = await supabase
    .from('orienta_grid_cards').select('card_id, position, rotation').eq('grid_id', gridIdResolved)
  if (!solution) return json({ error: 'solution not found' }, 404)

  const { correctFull, correctRotation, neither, cardFeedbacks } = evaluateAttempt(answer, solution as never)
  const success = correctFull === 4

  // Idempotence : partie déjà finalisée → on renvoie le feedback sans rien réécrire.
  if (play.completed_at) {
    return json({ success, correctFull, correctRotation, neither, card_feedbacks: cardFeedbacks, alreadyCompleted: true })
  }

  // Numéro d'essai DÉCIDÉ PAR LE SERVEUR (le client ne peut plus le forger
  // pour sauter des essais, rejouer, ou minimiser la pénalité de score).
  const { count: priorCount } = await supabase
    .from('orienta_play_attempts').select('id', { count: 'exact', head: true }).eq('play_id', play_id)
  const attemptNo = (priorCount ?? 0) + 1
  if (attemptNo > MAX_ATTEMPTS) return json({ error: 'no attempts remaining' }, 409)

  // Enregistre la tentative
  const { error: attErr } = await supabase.from('orienta_play_attempts').insert({
    play_id, attempt_number: attemptNo, answer,
    correct_full: correctFull, correct_rotation: correctRotation, neither,
  })
  if (attErr) return json({ error: 'could not record attempt' }, 500)

  const isLastAttempt = attemptNo >= MAX_ATTEMPTS

  // Pas encore fini : on note juste le nb d'essais en cours.
  if (!success && !isLastAttempt) {
    await supabase.from('orienta_plays').update({ attempts_count: attemptNo }).eq('id', play_id)
    return json({ success, correctFull, correctRotation, neither, card_feedbacks: cardFeedbacks, finalized: false, attemptNumber: attemptNo })
  }

  // ─── Finalisation (réussite OU dernier essai) ───
  // Temps de jeu effectif = temps écoulé depuis started_at MOINS le temps passé
  // en pause (joueur absent). paused_at est normalement NULL ici (le joueur est
  // actif pour soumettre), mais on inclut une pause en cours par sécurité.
  const now = Date.now()
  const startedAt = play.started_at ? new Date(play.started_at).getTime() : now
  const ongoingPauseMs = play.paused_at ? Math.max(0, now - new Date(play.paused_at).getTime()) : 0
  const pausedMs = (play.paused_seconds ?? 0) * 1000 + ongoingPauseMs
  const elapsed = Math.max(0, Math.floor((now - startedAt - pausedMs) / 1000))
  const attemptsFailed = attemptNo - 1
  const isSelfPlay = !!creatorId && creatorId === play.player_id

  const { data: user } = await supabase
    .from('orienta_users')
    .select('pseudo, level, streak_current, streak_best, last_played_at, xp_contributed')
    .eq('id', play.player_id)
    .single()

  const streakBonus = (success && !isSelfPlay) ? xpStreakBonus(user?.streak_current ?? 0) : 0
  // Bonus de rapidité : +6 si résolu au 1er essai, +3 au 2e (0 sinon).
  const attemptBonus = (success && !isSelfPlay) ? xpAttemptBonus(attemptNo, success) : 0
  const score = success ? computeScore(elapsed, attemptsFailed) : 0
  // Jouer sa propre grille ne rapporte aucune XP (cohérent avec award_xp_on_play).
  const playerXp = isSelfPlay ? 0 : (computeXp(score, success) + streakBonus + attemptBonus)
  const oldLevel = user?.level ?? 1

  // Finalisation ATOMIQUE : seul le 1er appel qui bascule completed_at (encore
  // NULL) attribue l'XP → pas de double attribution sur double-soumission.
  const { data: claimed } = await supabase.from('orienta_plays')
    .update({
      completed_at: new Date().toISOString(),
      time_seconds: elapsed, attempts_count: attemptNo,
      success, score, xp_earned: playerXp,
      paused_at: null,
    })
    .eq('id', play_id).is('completed_at', null).select('id')

  if (!claimed || claimed.length === 0) {
    // Course perdue : une autre requête a déjà finalisé → pas de ré-attribution.
    return json({ success, correctFull, correctRotation, neither, card_feedbacks: cardFeedbacks, alreadyCompleted: true })
  }

  // Streak + dernière activité + contribution (alignée sur l'XP réellement gagnée)
  if (user) {
    const today = new Date().toDateString()
    const lastPlayed = user.last_played_at ? new Date(user.last_played_at).toDateString() : null
    const yesterday = new Date(Date.now() - 86400000).toDateString()
    let newStreak = user.streak_current ?? 0
    if (lastPlayed !== today) newStreak = (lastPlayed === yesterday) ? newStreak + 1 : 1
    await supabase.from('orienta_users').update({
      streak_current: newStreak,
      streak_best: Math.max(user.streak_best ?? 0, newStreak),
      last_played_at: new Date().toISOString(),
      xp_contributed: (user.xp_contributed ?? 0) + playerXp,
    }).eq('id', play.player_id)
  }

  // Attribution XP individuelle (joueur + créateur) + collective + recalcul des
  // niveaux — source unique (corrige l'ancien double-comptage collectif).
  // (self-play est déjà neutralisé dans award_xp_on_play : créateur == joueur → 0)
  if (!isSelfPlay) {
    await supabase.rpc('award_xp_on_play', {
      p_grid_id: gridIdResolved,
      p_player_id: play.player_id,
      p_success: success,
      p_streak_bonus: streakBonus,
      p_attempt_bonus: attemptBonus,
    })
  }

  // Notification au créateur (sauf sur sa propre grille et sauf grille du jour)
  if (creatorId && !isSelfPlay && !isDailyGrid) {
    await supabase.from('orienta_notifications').insert({
      user_id: creatorId,
      type: 'play',
      payload: { player_pseudo: user?.pseudo, grid_id: gridIdResolved, success },
    })
  }

  // Détection de montée de niveau (après recalcul DB) + notification
  let leveledUp: { level: number; name: string } | null = null
  if (!isSelfPlay) {
    const { data: freshUser } = await supabase
      .from('orienta_users').select('level').eq('id', play.player_id).single()
    const newLevel = freshUser?.level ?? oldLevel
    if (newLevel > oldLevel) {
      const name = LEVEL_NAMES[newLevel] ?? `Niveau ${newLevel}`
      leveledUp = { level: newLevel, name }
      await supabase.from('orienta_notifications').insert({
        user_id: play.player_id,
        type: 'level_up',
        payload: { level: newLevel, level_name: name },
      })
    }
  }

  return json({
    success, correctFull, correctRotation, neither, card_feedbacks: cardFeedbacks,
    finalized: true,
    result: {
      score,
      xp: playerXp,
      baseXp: (success && !isSelfPlay) ? computeXp(score, true) : 0,
      bonusXp: streakBonus,
      attemptBonus,
      timeSeconds: elapsed,
      attemptCount: attemptNo,
      success,
      leveledUp,
    },
  })
})
