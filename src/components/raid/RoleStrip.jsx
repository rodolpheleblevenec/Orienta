import { ORGANS } from '../../lib/raid'

// Bandeau « qui a quel organe » affiché en combat, au-dessus du chat, pour que
// personne ne se trompe de rôle.
export default function RoleStrip({ roster, meId }) {
  const withRole = roster.filter(p => p.role)
  if (withRole.length === 0) return null
  return (
    <div className="raid-rolestrip">
      <div className="raid-rolestrip-title">L’équipage</div>
      <div className="raid-rolestrip-list">
        {withRole.map(p => {
          const o = ORGANS[p.role]
          return (
            <div key={p.user_id} className={`raid-rolechip${p.user_id === meId ? ' raid-rolechip--me' : ''}`} title={o?.blurb}>
              <span className="raid-rolechip-emoji">{o?.emoji}</span>
              <span className="raid-rolechip-text">
                <span className="raid-rolechip-role">{o?.label}{p.user_id === meId ? ' (toi)' : ''}</span>
                <span className="raid-rolechip-who">{p.pseudo}</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
