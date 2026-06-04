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

export function clearAdminSecret() {
  sessionStorage.removeItem(KEY)
}
