// Tirage aléatoire des cartes — source unique de vérité.
//
// `shuffle` applique un mélange de Fisher-Yates : chaque permutation est
// ÉQUIPROBABLE, donc le tirage est réellement uniforme.
//
// ⚠️ Ne JAMAIS remplacer ça par `[...arr].sort(() => Math.random() - 0.5)` :
// ce « tri à comparateur aléatoire » n'est pas uniforme. Le TimSort de V8 biaise
// fortement le résultat vers l'ordre d'origine du tableau, ce qui fait toujours
// remonter les mêmes cartes en tête — d'où l'impression que « ce sont souvent
// les mêmes mots qui reviennent ».

/** Renvoie une COPIE mélangée uniformément (Fisher-Yates). */
export function shuffle(array) {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Tire `count` éléments DISTINCTS au hasard (échantillonnage sans remise),
 * uniformément. Renvoie au plus min(count, array.length) éléments.
 */
export function sample(array, count) {
  return shuffle(array).slice(0, count)
}
