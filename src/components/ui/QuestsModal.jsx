import { useEffect, useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useBodyScrollLock } from '../../lib/useBodyScrollLock'

// Une ligne de quête : progression + récompense en jetons + action (récupérer).
function QuestRow({ q, onClaim, busy }) {
  const pct = q.target > 0 ? Math.min(100, Math.round((q.progress / q.target) * 100)) : 0
  return (
    <li className={`quest-row${q.completed ? ' quest-row--done' : ''}`}>
      <div className="quest-row-main">
        <div className="quest-row-head">
          <span className="quest-row-title">{q.title}</span>
          <span className="quest-reward">🪙 {q.reward_jetons}</span>
        </div>
        <p className="quest-row-desc">{q.description}</p>
        <div className="quest-bar" role="progressbar" aria-valuenow={q.progress} aria-valuemax={q.target}>
          <div className="quest-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="quest-progress-txt">{Math.min(q.progress, q.target)} / {q.target}</span>
      </div>
      <div className="quest-row-action">
        {q.claimed ? (
          <span className="quest-claimed">✓ Récupéré</span>
        ) : q.claimable ? (
          <button className="quest-claim-btn" type="button" disabled={busy} onClick={() => onClaim(q.progress_id)}>
            {busy ? '…' : <>Récupérer 🪙{q.reward_jetons}</>}
          </button>
        ) : (
          <span className="quest-pending">{pct}%</span>
        )}
      </div>
    </li>
  )
}

// Modale des quêtes du jour / de la semaine (récompense en jetons, claim manuel).
// Ouverte depuis la pastille jetons du header. Rafraîchit les quêtes à l'ouverture.
export default function QuestsModal({ onClose }) {
  useBodyScrollLock()
  const { user, quests, fetchQuests, claimQuest } = useAuthStore()
  const [busyId, setBusyId] = useState(null)
  const jetons = user?.jetons ?? 0
  const daily = quests?.daily ?? []
  const weekly = quests?.weekly ?? []

  useEffect(() => { fetchQuests() }, []) // recharge à l'ouverture

  async function handleClaim(progressId) {
    setBusyId(progressId)
    await claimQuest(progressId)
    setBusyId(null)
  }

  return (
    <div className="streak-modal-backdrop" onClick={onClose}>
      <div className="streak-modal quests-modal" onClick={e => e.stopPropagation()}>
        <div className="streak-modal-header">
          <h2 className="streak-modal-title">🪙 Tes quêtes</h2>
          <button className="streak-modal-close" onClick={onClose} type="button">✕</button>
        </div>

        <div className="quests-modal-balance">
          Solde&nbsp;: <strong>🪙 {jetons} jeton{jetons !== 1 ? 's' : ''}</strong>
        </div>

        {daily.length === 0 && weekly.length === 0 ? (
          <p className="quests-modal-empty">Chargement de tes quêtes…</p>
        ) : (
          <>
            {daily.length > 0 && (
              <>
                <h3 className="quest-group-title">Aujourd'hui</h3>
                <ul className="quest-list">
                  {daily.map(q => (
                    <QuestRow key={q.progress_id} q={q} onClaim={handleClaim} busy={busyId === q.progress_id} />
                  ))}
                </ul>
              </>
            )}
            {weekly.length > 0 && (
              <>
                <h3 className="quest-group-title">Cette semaine</h3>
                <ul className="quest-list">
                  {weekly.map(q => (
                    <QuestRow key={q.progress_id} q={q} onClaim={handleClaim} busy={busyId === q.progress_id} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
