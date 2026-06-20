// Détection appareil/navigateur pour l'aide « Ajouter à l'écran d'accueil ».
//
// Rappel iOS : Apple n'expose AUCun déclencheur d'installation programmatique
// (pas d'événement `beforeinstallprompt` comme sur Android/Chrome). Sur iPhone,
// l'ajout à l'écran d'accueil se fait UNIQUEMENT à la main, via le bouton
// « Partager » de Safari → « Sur l'écran d'accueil ». On se contente donc de
// repérer les bons visiteurs pour leur montrer la marche à suivre.

const ua = () => (typeof navigator !== 'undefined' ? navigator.userAgent || '' : '')

// iPhone / iPod / iPad — y compris l'iPad récent qui se déclare comme un Mac
// (iPadOS 13+ : platform « MacIntel » + écran tactile).
export function isIos() {
  const u = ua()
  if (/iPhone|iPod|iPad/i.test(u)) return true
  return (
    typeof navigator !== 'undefined' &&
    navigator.platform === 'MacIntel' &&
    navigator.maxTouchPoints > 1
  )
}

// iPhone uniquement (cible « mobile » au sens strict, hors iPad/tablette).
export function isIphone() {
  return /iPhone|iPod/i.test(ua())
}

// Vrai Safari sur iOS. On exclut les autres navigateurs iOS qui embarquent
// WebKit mais portent un marqueur dédié (Chrome=CriOS, Firefox=FxiOS,
// Edge=EdgiOS, Opera=OPiOS), et les webviews intégrées (pas de « Safari »).
export function isIosSafari() {
  if (!isIos()) return false
  const u = ua()
  if (/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|DuckDuckGo|GSA/i.test(u)) return false
  return /Safari/i.test(u)
}

// Le site tourne-t-il déjà en mode « app » (ajouté à l'écran d'accueil) ?
export function isStandalone() {
  if (typeof window === 'undefined') return false
  // iOS expose navigator.standalone ; les autres exposent display-mode.
  return (
    window.navigator.standalone === true ||
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches)
  )
}
