import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../../components/ui/Header'
import { useAuthStore } from '../../stores/authStore'
import { useRaidArena } from '../../lib/useRaidArena'
import { getAdminSecret } from '../../lib/adminSecret'
import { ORGANS, getBossByKey, canPlace, canRotate, canValidate, canSeeFeedback, canSeeRaid, isRaidAdmin } from '../../lib/raid'
import RosterBoard from '../../components/raid/RosterBoard'
import RaidChat from '../../components/raid/RaidChat'
import OeilPanel from '../../components/raid/OeilPanel'
import RaidBoard from '../../components/raid/RaidBoard'

function HpBar({ hp, max }) {
  const pct = max > 0 ? Math.max(0, Math.round((hp / max) * 100)) : 0
  return (
    <div className="raid-hp">
      <div className="raid-hp-fill" style={{ width: `${pct}%` }} />
      <span className="raid-hp-txt">{hp} / {max} PV</span>
    </div>
  )
}

function Timer({ deadline, onExpire }) {
  const [left, setLeft] = useState(0)
  const firedRef = useRef(false)
  useEffect(() => {
    firedRef.current = false
    const tick = () => {
      const ms = deadline ? new Date(deadline).getTime() - Date.now() : 0
      const s = Math.max(0, Math.floor(ms / 1000))
      setLeft(s)
      if (s <= 0 && !firedRef.current) { firedRef.current = true; onExpire?.() }
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [deadline, onExpire])
  const mm = String(Math.floor(left / 60)).padStart(1, '0')
  const ss = String(left % 60).padStart(2, '0')
  return <span className={`raid-timer${left <= 30 ? ' raid-timer--low' : ''}`}>⏱ {mm}:{ss}</span>
}

export default function RaidArenaPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const arena = useRaidArena(user)
  const { loading, noArena, session, roster, me, view, board, chat, sharedFeedback, role, actions } = arena
  const canOpen = canSeeRaid(user?.pseudo)
  const [opening, setOpening] = useState(false)

  async function openTestArena() {
    setOpening(true)
    // Admin → mot de passe serveur ; testeur → pas de secret (autorisé par pseudo côté serveur).
    const secret = isRaidAdmin(user?.pseudo) ? getAdminSecret() : ''
    if (isRaidAdmin(user?.pseudo) && !secret) { setOpening(false); return }
    const res = await actions.openTest(secret)
    if (res?.error) { alert('Échec ouverture arène : ' + res.error); setOpening(false); return }
    // L'arène existe maintenant — on recharge pour la rejoindre proprement.
    window.location.reload()
  }

  if (loading) {
    return (<><Header /><main className="raid-page"><div className="raid-loading">Connexion à l’arène…</div></main></>)
  }

  // Aucune arène ouverte
  if (noArena || !session) {
    return (
      <>
        <Header />
        <main className="raid-page">
          <div className="raid-empty">
            <div className="raid-empty-emoji">🌊</div>
            <h1 className="raid-h1">Aucune arène ouverte</h1>
            <p className="raid-sub">Les raids s’ouvriront chaque jour entre 12:00 et 15:00. Reviens à l’heure du déjeuner !</p>
            {canOpen &&(
              <button className="btn-primary" onClick={openTestArena} disabled={opening}>
                {opening ? 'Ouverture…' : '🔧 Ouvrir une arène de test'}
              </button>
            )}
          </div>
        </main>
      </>
    )
  }

  const boss = getBossByKey(session.boss_key)

  // ── Victoire / défaite ─────────────────────────────────────────────
  if (session.status === 'won' || session.status === 'lost') {
    const won = session.status === 'won'
    return (
      <>
        <Header />
        <main className="raid-page">
          <div className={`raid-end ${won ? 'raid-end--won' : 'raid-end--lost'}`}>
            <div className="raid-end-emoji">{won ? '🏆' : '🌑'}</div>
            <h1 className="raid-h1">{won ? `${boss.name} est vaincu !` : `${boss.name} a replongé…`}</h1>
            <p className="raid-sub">
              {won ? 'Votre équipage a terrassé le boss. XP collectif accordé à toute la communauté.'
                   : 'L’équipage est tombé. Reformez un groupe et retentez votre chance.'}
            </p>
            <div className="raid-end-actions">
              <button className="btn-secondary" onClick={() => navigate('/hub')}>Retour au hub</button>
              {canOpen &&<button className="btn-primary" onClick={openTestArena} disabled={opening}>Nouvelle arène de test</button>}
            </div>
          </div>
        </main>
      </>
    )
  }

  // ── Salle d'attente ────────────────────────────────────────────────
  if (session.status === 'waiting') {
    return (
      <>
        <Header />
        <main className="raid-page raid-page--waiting">
          <div className="raid-boss-head">
            <span className="raid-boss-emoji">{boss.emoji}</span>
            <div>
              <h1 className="raid-h1">{boss.name}</h1>
              <p className="raid-sub">Répartissez les organes — le boss est imbattable s’il en manque un.</p>
            </div>
          </div>
          <div className="raid-waiting-grid">
            <RosterBoard roster={roster} me={me} actions={actions} />
            <RaidChat chat={chat} onSend={actions.sendChat} me={me} />
          </div>
        </main>
      </>
    )
  }

  // ── Combat ─────────────────────────────────────────────────────────
  const interactive = !!role && (canPlace(role) || canRotate(role))
  const amCaptain = !!role && canValidate(role)
  const boardFeedbacks = sharedFeedback || (canSeeFeedback(role) ? view.feedback : null) || {}
  const boardFull = Object.keys(board).length === 4
  const myOrgan = role ? ORGANS[role] : null

  async function onValidate() {
    const res = await actions.validate()
    if (res?.error === 'incomplete') alert('Les 4 cartes doivent être posées avant de valider.')
  }

  return (
    <>
      <Header />
      <main className="raid-page raid-page--combat">
        <div className="raid-combat-top">
          <div className="raid-boss-head raid-boss-head--sm">
            <span className="raid-boss-emoji">{boss.emoji}</span>
            <div className="raid-boss-meta">
              <h1 className="raid-h1">{boss.name}</h1>
              <HpBar hp={session.current_hp} max={session.max_hp} />
            </div>
          </div>
          <div className="raid-combat-stats">
            <span className="raid-assault">Assaut {Math.min(session.assault_index + 1, session.assault_count)}/{session.assault_count}</span>
            <span className="raid-lives">{'🛟'.repeat(Math.max(0, session.lives))}</span>
            <span className="raid-tries">Essais : {session.attempts_remaining}</span>
            <Timer deadline={session.assault_deadline} onExpire={actions.signalTimeout} />
          </div>
        </div>

        {myOrgan && (
          <div className="raid-myrole">
            Tu es <b>{myOrgan.emoji} {myOrgan.label}</b> — {myOrgan.blurb}
          </div>
        )}

        <div className="raid-combat-grid">
          <div className="raid-combat-board">
            <RaidBoard
              board={board}
              cardOrder={session.card_order || []}
              feedbacks={boardFeedbacks}
              interactive={interactive}
              onChange={actions.moveBoard}
              clues={null}
            />
            {amCaptain && (
              <div className="raid-captain-bar">
                <button className="btn-primary" onClick={onValidate} disabled={!boardFull}>
                  {boardFull ? 'Valider l’essai' : 'Place les 4 cartes…'}
                </button>
                {view.feedback && (
                  <button className="btn-secondary" onClick={() => actions.shareFeedback(view.feedback)}>
                    Partager les couleurs
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="raid-combat-side">
            <OeilPanel view={view} />
            <RaidChat chat={chat} onSend={actions.sendChat} me={me} />
          </div>
        </div>
      </main>
    </>
  )
}
