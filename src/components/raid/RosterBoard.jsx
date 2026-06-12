import { ORGANS, getOrgansForTier, MIN_PLAYERS } from '../../lib/raid'

// Salle d'attente : tableau des organes du palier (= effectif). Chacun réclame
// le sien ; tout le monde doit être prêt pour lancer.
export default function RosterBoard({ roster, me, actions, busy }) {
  const count = roster.length
  const organs = getOrgansForTier(count)
  const byRole = {}
  for (const p of roster) if (p.role) byRole[p.role] = p

  const myRole = me?.role ?? null
  const allClaimed = organs.every(r => byRole[r])
  const allReady = roster.length > 0 && roster.every(p => p.is_ready)
  const enoughPlayers = count >= MIN_PLAYERS
  const canLaunch = enoughPlayers && allClaimed && allReady

  return (
    <div className="raid-roster">
      <div className="raid-roster-head">
        <h2 className="raid-h2">Salle d’attente</h2>
        <span className="raid-count">{count} joueur{count > 1 ? 's' : ''} · palier {Math.max(MIN_PLAYERS, count)}</span>
      </div>

      {!enoughPlayers && (
        <p className="raid-hint">Il faut au moins {MIN_PLAYERS} joueurs pour lancer le boss. En attente…</p>
      )}

      <div className="raid-organ-grid">
        {organs.map(key => {
          const o = ORGANS[key]
          const holder = byRole[key]
          const mine = myRole === key
          const free = !holder
          return (
            <button
              key={key}
              type="button"
              className={`raid-organ${mine ? ' raid-organ--mine' : ''}${holder && !mine ? ' raid-organ--taken' : ''}`}
              onClick={() => { if (mine) actions.releaseRole(); else if (free) actions.claimRole(key) }}
              disabled={!free && !mine}
              title={o.blurb}
            >
              <span className="raid-organ-emoji">{o.emoji}</span>
              <span className="raid-organ-label">{o.label}</span>
              <span className="raid-organ-blurb">{o.blurb}</span>
              <span className="raid-organ-holder">
                {holder ? (holder.is_ready ? '✓ ' : '') + (holder.pseudo || 'joueur') : 'Libre — clique pour prendre'}
              </span>
            </button>
          )
        })}
      </div>

      <div className="raid-roster-actions">
        <button
          type="button"
          className={`btn-secondary raid-ready-btn${me?.is_ready ? ' raid-ready-btn--on' : ''}`}
          disabled={!myRole}
          onClick={() => actions.setReady(!me?.is_ready)}
        >
          {!myRole ? 'Choisis un organe d’abord' : me?.is_ready ? '✓ Prêt — annuler' : 'Je suis prêt'}
        </button>
        {canLaunch ? (
          <button type="button" className="btn-primary raid-launch-btn" disabled={busy} onClick={() => actions.startGame()}>
            {busy ? 'Lancement…' : '⚔️ Lancer le raid'}
          </button>
        ) : (
          <p className="raid-launch-hint">
            En attente : {!enoughPlayers ? `${MIN_PLAYERS - count} joueur(s) de plus` : !allClaimed ? 'organes à couvrir' : 'que tout le monde soit prêt'}
          </p>
        )}
      </div>
    </div>
  )
}
