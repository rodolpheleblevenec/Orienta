// Secret admin : saisi une fois par l'admin, conservé en sessionStorage (jamais
// dans le bundle JS). Envoyé à l'Edge Function `admin` qui le compare à la
// variable d'environnement ADMIN_SECRET côté serveur.
const KEY = 'orienta_admin_secret'

export function getAdminSecret() {
  let s = sessionStorage.getItem(KEY)
  if (!s) {
    s = window.prompt('Mot de passe administrateur :') || ''
    if (s) sessionStorage.setItem(KEY, s)
  }
  return s
}

// Enregistre un secret déjà validé (ex. après le contrôle à l'entrée de l'admin),
// pour que les pages admin ne le redemandent pas dans la session.
export function setAdminSecret(value) {
  if (value) sessionStorage.setItem(KEY, value)
}

export function clearAdminSecret() {
  sessionStorage.removeItem(KEY)
}
