import { ORGANS } from '../../lib/raid'

// Traductions joueur des capacités (codes internes → libellés lisibles).
const SEES_LABEL = {
  clues: 'les indices',
  words: 'les mots des cartes',
  feedback: 'les couleurs de validation',
  mapping: 'la vraie correspondance des slots',
  decoy: 'la carte-leurre',
}
const DOES_LABEL = {
  place: 'poser les cartes',
  rotate: 'tourner les cartes',
  validate: 'valider l’essai',
  sonar: 'sonder une carte (sonar)',
  'peril:boussole': 'corriger la boussole',
  'peril:brouillard': 'percer le brouillard',
  'peril:derive': 're-stabiliser les cartes',
}
const fmtList = (arr, map) => arr.map(k => map[k] || k).join(', ')

// Bandeau « qui a quel organe » affiché en combat, au-dessus du chat, pour que
// personne ne se trompe de rôle. Au survol d'un rôle (le sien ou celui d'un
// coéquipier) : rappel des pouvoirs et capacités de ce rôle.
export default function RoleStrip({ roster, meId }) {
  const withRole = roster.filter(p => p.role)
  if (withRole.length === 0) return null
  return (
    <div className="raid-rolestrip">
      <div className="raid-rolestrip-title">L’équipage</div>
      <div className="raid-rolestrip-list">
        {withRole.map(p => {
          const o = ORGANS[p.role]
          const mine = p.user_id === meId
          const sees = o?.sees?.length ? fmtList(o.sees, SEES_LABEL) : null
          const does = o?.does?.length ? fmtList(o.does, DOES_LABEL) : null
          return (
            <div key={p.user_id} className={`raid-rolechip${mine ? ' raid-rolechip--me' : ''}`} tabIndex={0}>
              <span className="raid-rolechip-emoji">{o?.emoji}</span>
              <span className="raid-rolechip-text">
                <span className="raid-rolechip-role">{o?.label}{mine ? ' (toi)' : ''}</span>
                <span className="raid-rolechip-who">{p.pseudo}</span>
              </span>
              {o && (
                <div className="raid-rolechip-pop" role="tooltip">
                  <div className="raid-rolechip-pop-title">{o.emoji} {o.label}</div>
                  <p className="raid-rolechip-pop-blurb">{o.blurb}</p>
                  <p className="raid-rolechip-pop-cap"><b>👁 Voit :</b> {sees || 'rien de spécial'}</p>
                  <p className="raid-rolechip-pop-cap"><b>✋ Fait :</b> {does || 'communiquer & coordonner'}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
