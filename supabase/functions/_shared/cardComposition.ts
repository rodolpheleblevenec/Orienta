// Composition / résolution des cartes d'une grille — partagé par create-grid et admin.
//
// Deux contrats supportés (une requête est ENTIÈREMENT dans un mode ou l'autre) :
//   • pool de mots : spec.words = {top,right,bottom,left}
//        → on INSÈRE une carte fraîche (playable=false) à partir de ces mots.
//   • legacy       : spec.card_id
//        → on réutilise une carte existante (compat. frontend en cache).
//
// Sécurité : en mode pool, chaque mot DOIT exister dans orienta_words avec
// playable=true (le client ne peut donc pas injecter de contenu arbitraire dans
// la table partagée — même esprit que la validation par card_id d'avant).
//
// Les cartes composées sont insérées playable=false : elles ne portent que la
// solution d'une grille et ne doivent jamais repolluer un tirage.

export type CardWords = { top: string; right: string; bottom: string; left: string }
export type CardSpec = { card_id?: string; words?: CardWords }

export type ResolveResult =
  | { ok: true; cardIds: string[]; words: Set<string>; created: boolean }
  | { ok: false; error: string; status: number }

const norm = (w: unknown) => String(w ?? '').toLowerCase().trim()

// deno-lint-ignore no-explicit-any
export async function resolveGridCards(supabase: any, specs: CardSpec[]): Promise<ResolveResult> {
  const usesWords = specs.some((s) => s.words)
  const usesIds = specs.some((s) => s.card_id)
  if (usesWords && usesIds) return { ok: false, error: 'mixed card specs', status: 400 }
  if (!usesWords && !usesIds) return { ok: false, error: 'no card specs', status: 400 }

  // ── Mode legacy : par card_id ──
  if (usesIds) {
    const ids = specs.map((s) => s.card_id)
    if (ids.some((id) => !id)) return { ok: false, error: 'invalid card spec', status: 400 }
    const { data: cards } = await supabase
      .from('orienta_word_cards')
      .select('id, word_top, word_right, word_bottom, word_left')
      .in('id', ids as string[])
    if (!cards || cards.length !== new Set(ids).size) return { ok: false, error: 'invalid cards', status: 400 }
    const words = new Set<string>()
    for (const c of cards) {
      for (const w of [c.word_top, c.word_right, c.word_bottom, c.word_left]) if (w) words.add(norm(w))
    }
    return { ok: true, cardIds: ids as string[], words, created: false }
  }

  // ── Mode pool : par mots ──
  // 1) Structure : 4 mots non vides par carte.
  const specWords: CardWords[] = []
  for (const s of specs) {
    if (!s.words) return { ok: false, error: 'invalid card spec', status: 400 }
    const w = { top: norm(s.words.top), right: norm(s.words.right), bottom: norm(s.words.bottom), left: norm(s.words.left) }
    if (!w.top || !w.right || !w.bottom || !w.left) return { ok: false, error: 'card needs 4 words', status: 400 }
    specWords.push(w)
  }

  // 2) Tous les mots de la grille doivent être distincts (pas deux fois le même
  //    mot dans le trèfle) — sert aussi de clé de mapping fiable plus bas.
  const flat = specWords.flatMap((w) => [w.top, w.right, w.bottom, w.left])
  const uniq = new Set(flat)
  if (uniq.size !== flat.length) return { ok: false, error: 'duplicate words in grid', status: 400 }

  // 3) Anti-injection : chaque mot vient du pool ET est playable.
  const wanted = [...uniq]
  const { data: poolRows } = await supabase
    .from('orienta_words')
    .select('text')
    .in('text', wanted)
    .eq('playable', true)
  const allowed = new Set((poolRows ?? []).map((r: { text: string }) => r.text))
  const missing = wanted.filter((w) => !allowed.has(w))
  if (missing.length) return { ok: false, error: 'word not in pool: ' + missing.slice(0, 5).join(', '), status: 400 }

  // 4) Insertion des cartes composées (playable=false) puis récupération des ids.
  const { data: inserted, error } = await supabase
    .from('orienta_word_cards')
    .insert(specWords.map((w) => ({
      word_top: w.top, word_right: w.right, word_bottom: w.bottom, word_left: w.left, playable: false,
    })))
    .select('id, word_top')
  if (error || !inserted || inserted.length !== specWords.length) {
    return { ok: false, error: 'could not create cards', status: 500 }
  }
  // word_top est unique dans ce batch (mots distincts garantis en 2) → mapping sûr.
  const idByTop = new Map(inserted.map((r: { id: string; word_top: string }) => [r.word_top, r.id]))
  const cardIds = specWords.map((w) => idByTop.get(w.top))
  if (cardIds.some((id) => !id)) return { ok: false, error: 'card id mapping failed', status: 500 }

  return { ok: true, cardIds: cardIds as string[], words: uniq, created: true }
}
