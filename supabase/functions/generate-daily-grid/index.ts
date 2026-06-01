import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!
const FUNCTION_SECRET = Deno.env.get('FUNCTION_SECRET')

const GENERATION_MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o'
const VALIDATION_MODEL = 'gpt-4o-mini'
const MAX_RETRIES = 3

const DIRS = ['top', 'right', 'bottom', 'left'] as const

function getWordFacing(card: Record<string, string>, rotation: number, direction: string): string {
  const steps = rotation / 90
  const origIdx = ((DIRS.indexOf(direction as typeof DIRS[number]) - steps) % 4 + 4) % 4
  return card[`word_${DIRS[origIdx]}`]
}

function capitalize(s: string): string {
  const w = s.trim()
  return w.charAt(0).toUpperCase() + w.slice(1)
}

interface SidePairs {
  top: [string, string]
  right: [string, string]
  bottom: [string, string]
  left: [string, string]
}
interface Clues { top: string; right: string; bottom: string; left: string }

const SYSTEM_GENERATION =
  `Tu crées des indices pour le jeu de mots Orienta.\n` +
  `MÉTHODE : pour chaque paire (A + B), liste mentalement 5 associations de A, puis 5 de B, puis trouve ce qui se croise.\n` +
  `L'indice doit être à l'INTERSECTION des deux mots — il évoque les deux simultanément, pas juste l'un d'eux.\n\n` +
  `INTERDIT : mots de catégorie génériques (animal, plante, nourriture, métier, couleur, objet…), répéter un mot cible.\n\n` +
  `BONS EXEMPLES :\n` +
  `- "pilote" + "oiseau" → "vol" (les deux volent)\n` +
  `- "dauphin" + "médecin" → "écho" (écholocation / échographie)\n` +
  `- "lune" + "pêcheur" → "marée" (la lune contrôle les marées, le pêcheur les suit)\n` +
  `- "forêt" + "poumon" → "oxygène" (la forêt produit l'oxygène que les poumons respirent)\n` +
  `- "requin" + "avocat" → "mâchoire" (les deux attaquent avec leurs mâchoires, au propre et au figuré)\n` +
  `- "lapin" + "chapeau" → "magie" (le lapin sort du chapeau)\n` +
  `- "arc-en-ciel" + "peintre" → "palette" (les deux ont une palette de couleurs)\n` +
  `- "escalier" + "montagne" → "ascension" (les deux impliquent de monter)\n` +
  `- "neige" + "mouton" → "flocon" (la neige tombe en flocons, la laine ressemble à des flocons)\n` +
  `- "facteur" + "pigeon" → "message" (les deux transportent des messages)\n\n` +
  `Tu réponds UNIQUEMENT avec ce JSON : {"top":"mot","right":"mot","bottom":"mot","left":"mot"}.`

async function openai(model: string, system: string, user: string, maxTokens = 80): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      response_format: { type: 'json_object' },
      max_tokens: maxTokens,
      temperature: 0.8,
    }),
  })
  if (!res.ok) { console.error('OpenAI error:', await res.text()); return '{}' }
  const json = await res.json()
  return json.choices?.[0]?.message?.content ?? '{}'
}

async function generateClues(pairs: SidePairs, allWords: string[]): Promise<Clues | null> {
  const user =
    `Paires à relier :\n` +
    `- Haut : "${pairs.top[0]}" + "${pairs.top[1]}"\n` +
    `- Droite : "${pairs.right[0]}" + "${pairs.right[1]}"\n` +
    `- Bas : "${pairs.bottom[0]}" + "${pairs.bottom[1]}"\n` +
    `- Gauche : "${pairs.left[0]}" + "${pairs.left[1]}"\n\n` +
    `Autres mots de la grille (pour que tes indices soient discriminants) : ${allWords.join(', ')}\n\n` +
    `JSON uniquement.`

  try {
    const raw = await openai(GENERATION_MODEL, SYSTEM_GENERATION, user)
    const p = JSON.parse(raw)
    return {
      top:    capitalize(p.top    ?? ''),
      right:  capitalize(p.right  ?? ''),
      bottom: capitalize(p.bottom ?? ''),
      left:   capitalize(p.left   ?? ''),
    }
  } catch (e) {
    console.error('generateClues parse error:', e)
    return null
  }
}

async function validateClues(clues: Clues, pairs: SidePairs): Promise<boolean> {
  const system =
    `Tu évalues des indices pour le jeu Orienta. ` +
    `Un bon indice est à l'INTERSECTION des deux mots cibles : il les évoque TOUS LES DEUX logiquement. ` +
    `Un mauvais indice n'évoque qu'UN SEUL des deux mots. Sois sévère. ` +
    `Réponds en JSON : {"top":bool,"right":bool,"bottom":bool,"left":bool} (true = bonne intersection).`

  const user =
    `Évalue ces indices :\n` +
    `- Haut : "${clues.top}" pour "${pairs.top[0]}" + "${pairs.top[1]}"\n` +
    `- Droite : "${clues.right}" pour "${pairs.right[0]}" + "${pairs.right[1]}"\n` +
    `- Bas : "${clues.bottom}" pour "${pairs.bottom[0]}" + "${pairs.bottom[1]}"\n` +
    `- Gauche : "${clues.left}" pour "${pairs.left[0]}" + "${pairs.left[1]}"\n\nJSON uniquement.`

  try {
    const raw = await openai(VALIDATION_MODEL, system, user, 60)
    const p = JSON.parse(raw)
    const allValid = p.top === true && p.right === true && p.bottom === true && p.left === true
    if (!allValid) console.log('Validation failed:', p, '| clues:', clues, '| pairs:', pairs)
    return allValid
  } catch (e) {
    console.error('validateClues error:', e)
    return true // en cas d'erreur de parsing, on accepte pour ne pas boucler
  }
}

function shuffleDeck(deck: unknown[]): unknown[] {
  const arr = [...deck]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Calcule la date cible : aujourd'hui + offsetDays, heure de Paris. */
function computeTargetDate(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' })
}

Deno.serve(async (req: Request) => {
  if (FUNCTION_SECRET) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${FUNCTION_SECRET}`) return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const url = new URL(req.url)

  // Par défaut : génère pour dans 7 jours (roulement hebdomadaire)
  const offsetDays = parseInt(url.searchParams.get('offset') ?? '7')
  const targetDate = url.searchParams.get('date') ?? computeTargetDate(offsetDays)
  const force = url.searchParams.get('force') === 'true'

  const { data: existing } = await supabase
    .from('orienta_grids').select('id').eq('daily_date', targetDate).maybeSingle()

  if (existing) {
    if (!force) {
      return new Response(
        JSON.stringify({ message: 'Daily grid already exists', id: existing.id, date: targetDate }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }
    await supabase.from('orienta_grids').delete().eq('id', existing.id)
  }

  const { data: allCards, error: cardsError } = await supabase
    .from('orienta_word_cards').select('id, word_top, word_right, word_bottom, word_left')

  if (cardsError || !allCards?.length) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch word cards', detail: cardsError?.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Boucle de génération avec validation (max MAX_RETRIES tentatives)
  let clues: Clues | null = null
  let bestCards: typeof allCards = []
  let bestRotations: number[] = []
  let bestPairs: SidePairs | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const deck = shuffleDeck(allCards) as typeof allCards
    const cards = deck.slice(0, 4)
    const rotations = cards.map(() => ([0, 90, 180, 270] as const)[Math.floor(Math.random() * 4)])

    const pairs: SidePairs = {
      top:    [getWordFacing(cards[0], rotations[0], 'top'),    getWordFacing(cards[1], rotations[1], 'top')],
      right:  [getWordFacing(cards[1], rotations[1], 'right'),  getWordFacing(cards[3], rotations[3], 'right')],
      bottom: [getWordFacing(cards[2], rotations[2], 'bottom'), getWordFacing(cards[3], rotations[3], 'bottom')],
      left:   [getWordFacing(cards[0], rotations[0], 'left'),   getWordFacing(cards[2], rotations[2], 'left')],
    }

    const allWords = cards.flatMap(c => [c.word_top, c.word_right, c.word_bottom, c.word_left])
    console.log(`Attempt ${attempt} | pairs:`, pairs)

    const generated = await generateClues(pairs, allWords)
    if (!generated) continue

    console.log(`Attempt ${attempt} | clues:`, generated)

    const valid = await validateClues(generated, pairs)
    if (valid) {
      clues = generated
      bestCards = cards
      bestRotations = rotations
      bestPairs = pairs
      console.log(`Attempt ${attempt} passed validation ✅`)
      break
    }

    // Conserver la dernière tentative comme fallback
    if (attempt === MAX_RETRIES) {
      console.log('Max retries reached — using last attempt as fallback')
      clues = generated
      bestCards = cards
      bestRotations = rotations
      bestPairs = pairs
    }
  }

  if (!clues || !bestPairs) {
    return new Response(
      JSON.stringify({ error: 'Failed to generate clues after retries' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const { data: grid, error: gridError } = await supabase
    .from('orienta_grids')
    .insert({
      daily_date: targetDate,
      status: 'published',
      difficulty: 'moyen',
      creator_id: null,
      clue_top: clues.top,
      clue_right: clues.right,
      clue_bottom: clues.bottom,
      clue_left: clues.left,
    })
    .select('id')
    .single()

  if (gridError || !grid) {
    return new Response(
      JSON.stringify({ error: 'Failed to insert grid', detail: gridError?.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const { error: cardsInsertError } = await supabase
    .from('orienta_grid_cards')
    .insert(bestCards.map((card, i) => ({
      grid_id: grid.id,
      card_id: card.id,
      position: i,
      rotation: bestRotations[i],
    })))

  if (cardsInsertError) {
    await supabase.from('orienta_grids').delete().eq('id', grid.id)
    return new Response(
      JSON.stringify({ error: 'Failed to insert card placements', detail: cardsInsertError.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  return new Response(
    JSON.stringify({ success: true, date: targetDate, grid_id: grid.id, clues, word_pairs: bestPairs }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
