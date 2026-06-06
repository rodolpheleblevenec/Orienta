import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FUNCTION_SECRET = Deno.env.get('FUNCTION_SECRET')

// Pseudo de l'admin (miroir de ADMIN_PSEUDO dans src/pages/admin/DailyAdminPage.jsx) :
// destinataire des alertes (stock de réserve bas, gagnant qui n'a pas créé sa grille).
const ADMIN_PSEUDO = 'Rodolphe LE BLEVENEC'
const RESERVE_LOW_THRESHOLD = 3

/** Date du jour en heure de Paris, format 'YYYY-MM-DD'. */
function parisToday(): string {
  return new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' })
}

/** Arithmétique de dates sûre (on traite la date comme minuit UTC). */
function addDays(dateStr: string, n: number): string {
  return new Date(Date.parse(dateStr + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
}

type SupabaseClient = ReturnType<typeof createClient>

/** Prochain numéro d'édition (séquence globale, attribuée à la PUBLICATION). */
async function nextEdition(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase
    .from('orienta_grids')
    .select('edition_number')
    .not('edition_number', 'is', null)
    .order('edition_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  return ((data?.edition_number as number | undefined) ?? 0) + 1
}

async function getSystemUserId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from('orienta_users').select('id').eq('is_system', true).order('created_at').limit(1).maybeSingle()
  return (data?.id as string | undefined) ?? null
}

async function getAdminUserId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from('orienta_users').select('id').eq('pseudo', ADMIN_PSEUDO).limit(1).maybeSingle()
  return (data?.id as string | undefined) ?? null
}

async function notifyAdmin(supabase: SupabaseClient, type: string, payload: Record<string, unknown>) {
  const adminId = await getAdminUserId(supabase)
  if (!adminId) return
  await supabase.from('orienta_notifications').insert({ user_id: adminId, type, payload })
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Désigne le gagnant de `sourceDate` et lui accorde le droit de créer la grille de J+3.
// ─────────────────────────────────────────────────────────────────────────────
async function finalizeWinner(supabase: SupabaseClient, sourceDate: string) {
  const { data: grid } = await supabase
    .from('orienta_grids')
    .select('id, creator_id')
    .eq('daily_date', sourceDate)
    .not('daily_status', 'is', null)
    .maybeSingle()
  if (!grid) return { sourceDate, winner: null, reason: 'no grid for source date' }

  // #1 dérivé côté serveur depuis des scores fiables (calculés serveur dans check-attempt).
  // On exclut l'auto-jeu du créateur (cohérent avec l'XP) et on départage par temps puis ancienneté.
  let q = supabase
    .from('orienta_plays')
    .select('player_id, score, time_seconds, completed_at')
    .eq('grid_id', grid.id)
    .eq('success', true)
    .not('completed_at', 'is', null)
    .order('score', { ascending: false })
    .order('time_seconds', { ascending: true })
    .order('completed_at', { ascending: true })
    .limit(1)
  if (grid.creator_id) q = q.neq('player_id', grid.creator_id)
  const { data: top } = await q.maybeSingle()
  if (!top?.player_id) return { sourceDate, winner: null, reason: 'no successful play' }

  const targetDate = addDays(sourceDate, 3)
  const deadline = new Date(targetDate + 'T00:00:00Z').toISOString() // ≈ J+3 00:00 (gate réel = date, ci-dessous)

  // Idempotent : un seul grant par grille gagnée (re-run du cron sans doublon).
  const { data: inserted, error } = await supabase
    .from('orienta_grid_grants')
    .upsert({
      winner_user_id: top.player_id,
      source_grid_id: grid.id,
      source_date: sourceDate,
      target_date: targetDate,
      status: 'pending',
      deadline,
    }, { onConflict: 'source_grid_id', ignoreDuplicates: true })
    .select('id, winner_user_id, target_date')

  if (error) return { sourceDate, winner: top.player_id, reason: 'grant insert error: ' + error.message }
  if (!inserted || inserted.length === 0) {
    return { sourceDate, winner: top.player_id, targetDate, grant: 'already existed' }
  }

  const grant = inserted[0]
  await supabase.from('orienta_notifications').insert({
    user_id: grant.winner_user_id,
    type: 'grid_grant',
    payload: { grant_id: grant.id, source_date: sourceDate, target_date: targetDate },
  })
  return { sourceDate, winner: top.player_id, targetDate, grant: 'created', grant_id: grant.id }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Garantit qu'il existe une grille du jour pour `today`.
//    Priorité : grille déjà datée (gagnant) → réserve (priorité) → clone d'archive (dernier recours).
// ─────────────────────────────────────────────────────────────────────────────
async function ensureTodayGrid(supabase: SupabaseClient, today: string) {
  const { data: existing } = await supabase
    .from('orienta_grids')
    .select('id, daily_status, edition_number')
    .eq('daily_date', today)
    .maybeSingle()

  if (existing) {
    // Grille du gagnant (ou déjà publiée) : on s'assure du statut + numéro d'édition.
    if (existing.daily_status !== 'published') {
      const edition = existing.edition_number ?? (await nextEdition(supabase))
      await supabase.from('orienta_grids')
        .update({ daily_status: 'published', edition_number: edition, status: 'published' })
        .eq('id', existing.id)
    }
    return { today, source: 'winner_or_existing', grid_id: existing.id }
  }

  // Pas de grille → on pioche la réserve (priorité la plus basse = la première).
  const { data: reserve } = await supabase
    .from('orienta_grids')
    .select('id')
    .eq('daily_status', 'reserve')
    .order('reserve_priority', { ascending: true })
    .limit(1)
    .maybeSingle()

  const edition = await nextEdition(supabase)

  if (reserve) {
    await supabase.from('orienta_grids')
      .update({ daily_date: today, daily_status: 'published', status: 'published', reserve_priority: null, edition_number: edition })
      .eq('id', reserve.id)
    return { today, source: 'reserve', grid_id: reserve.id }
  }

  // Réserve vide → repli ultime : on rejoue (clone) une grille d'archive populaire.
  const cloned = await cloneArchiveGrid(supabase, today, edition)
  await notifyAdmin(supabase, 'reserve_low', { reason: 'empty', filled_with: 'archive', date: today, count: 0 })
  return { today, source: cloned ? 'archive_clone' : 'none', grid_id: cloned }
}

/** Clone une grille du jour passée (la plus populaire) vers une nouvelle grille datée `today`. */
async function cloneArchiveGrid(supabase: SupabaseClient, today: string, edition: number): Promise<string | null> {
  const systemId = await getSystemUserId(supabase)
  const { data: src } = await supabase
    .from('orienta_grids')
    .select('id, clue_top, clue_right, clue_bottom, clue_left, difficulty')
    .eq('daily_status', 'published')
    .not('daily_date', 'is', null)
    .lt('daily_date', today)
    .order('upvotes_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!src) return null

  const { data: newGrid, error } = await supabase.from('orienta_grids').insert({
    creator_id: systemId,
    status: 'published',
    daily_status: 'published',
    daily_date: today,
    difficulty: src.difficulty ?? 'facile',
    edition_number: edition,
    clue_top: src.clue_top, clue_right: src.clue_right, clue_bottom: src.clue_bottom, clue_left: src.clue_left,
  }).select('id').single()
  if (error || !newGrid) return null

  const { data: cards } = await supabase
    .from('orienta_grid_cards').select('card_id, position, rotation').eq('grid_id', src.id)
  if (cards?.length) {
    await supabase.from('orienta_grid_cards').insert(
      cards.map(c => ({ grid_id: newGrid.id, card_id: c.card_id, position: c.position, rotation: c.rotation })),
    )
  }
  return newGrid.id
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Alerte si le stock de réserve est bas.
// ─────────────────────────────────────────────────────────────────────────────
async function checkReserveStock(supabase: SupabaseClient) {
  const { count } = await supabase
    .from('orienta_grids')
    .select('id', { count: 'exact', head: true })
    .eq('daily_status', 'reserve')
  const n = count ?? 0
  if (n < RESERVE_LOW_THRESHOLD) {
    await notifyAdmin(supabase, 'reserve_low', { count: n, threshold: RESERVE_LOW_THRESHOLD })
  }
  return { reserve_count: n, low: n < RESERVE_LOW_THRESHOLD }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Expire les grants non honorés (le gagnant n'a pas créé sa grille à temps).
//    Gate AUTORITAIRE basé sur la DATE (target_date <= today, heure de Paris) → pas de souci DST.
// ─────────────────────────────────────────────────────────────────────────────
async function expireStaleGrants(supabase: SupabaseClient, today: string) {
  const { data: stale } = await supabase
    .from('orienta_grid_grants')
    .select('id, winner_user_id, target_date')
    .eq('status', 'pending')
    .lte('target_date', today)
  if (!stale?.length) return { expired: 0 }

  await supabase.from('orienta_grid_grants')
    .update({ status: 'expired' })
    .in('id', stale.map(g => g.id))

  for (const g of stale) {
    await notifyAdmin(supabase, 'grant_expired', { target_date: g.target_date, winner_user_id: g.winner_user_id })
  }
  return { expired: stale.length, dates: stale.map(g => g.target_date) }
}

// ─────────────────────────────────────────────────────────────────────────────
// Point d'entrée — exécuté chaque nuit (GitHub Actions) après minuit Paris.
//   ?date=YYYY-MM-DD  → force la date à finaliser (sinon : hier, heure de Paris)
// ─────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (FUNCTION_SECRET) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${FUNCTION_SECRET}`) return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const url = new URL(req.url)

  const today = parisToday()
  // Le jour qui vient de se terminer (gagnant à désigner). Override possible pour les tests.
  const sourceDate = url.searchParams.get('date') ?? addDays(today, -1)

  const summary: Record<string, unknown> = { today, sourceDate }
  try {
    summary.winner = await finalizeWinner(supabase, sourceDate)
    summary.ensure = await ensureTodayGrid(supabase, today)
    summary.grants = await expireStaleGrants(supabase, today)
    summary.reserve = await checkReserveStock(supabase)
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'rollover failed', detail: String(e), summary }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  return new Response(
    JSON.stringify({ success: true, ...summary }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
