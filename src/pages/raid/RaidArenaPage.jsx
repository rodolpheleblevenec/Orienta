import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../../components/ui/Header'
import { useAuthStore } from '../../stores/authStore'
import { useRaidArena } from '../../lib/useRaidArena'
import { getAdminSecret } from '../../lib/adminSecret'
import { ORGANS, getBossByKey, canPlace, canRotate, canValidate, canSeeFeedback, canSeeClues, canSeeWords, canSeeRaid, isRaidAdmin } from '../../lib/raid'
import RosterBoard from '../../components/raid/RosterBoard'
import RaidChat from '../../components/raid/RaidChat'
import RoleStrip from '../../components/raid/RoleStrip'
import RaidBoard from '../../components/raid/RaidBoard'

// Scène 3D lazy-loadée (n'alourdit pas le bundle hors /raid).
const RaidMonster3D = lazy(() => import('../../components/raid/RaidMonster3D'))
const hueOf = (s) => { let h = 0; for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h }

const SLOT_LABELS = { 0: 'Haut', 1: 'Droite', 2: 'Bas', 3: 'Gauche' }

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
  const { loading, noArena, session, roster, me, view, board, chat, sharedFeedback, role, actions, busy } = arena
  const canOpen = canSeeRaid(user?.pseudo)
  const [opening, setOpening] = useState(false)
  const [sonarResult, setSonarResult] = useState(null)
  // Le sonar se recharge à chaque assaut → on efface le résultat affiché.
  useEffect(() => { setSonarResult(null) }, [session?.assault_index, session?.status])

  // Signaux pour animer la méduse 3D : perte de PV (recul + flash) / essai raté ou bouée perdue (lunge).
  const [hitSignal, setHitSignal] = useState(0)
  const [attackSignal, setAttackSignal] = useState(0)
  const prevHpRef = useRef(null)
  const prevAtkRef = useRef(null)
  const prevLivesRef = useRef(null)
  useEffect(() => {
    const hp = session?.current_hp
    if (hp != null) { if (prevHpRef.current != null && hp < prevHpRef.current) setHitSignal(s => s + 1); prevHpRef.current = hp }
  }, [session?.current_hp])
  useEffect(() => {
    const a = session?.attempts_remaining, l = session?.lives
    const fail = (a != null && prevAtkRef.current != null && a < prevAtkRef.current) || (l != null && prevLivesRef.current != null && l < prevLivesRef.current)
    if (fail) setAttackSignal(s => s + 1)
    if (a != null) prevAtkRef.current = a
    if (l != null) prevLivesRef.current = l
  }, [session?.attempts_remaining, session?.lives])
  // À chaque issue de validation (réussite ou échec), tous les écrans remontent en haut
  // pour voir l'animation de combat de la méduse.
  useEffect(() => {
    if (hitSignal > 0 || attackSignal > 0) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [hitSignal, attackSignal])

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
          <div className="raid-lobby">
            <RosterBoard boss={boss} roster={roster} me={me} actions={actions} busy={busy} />
            <RaidChat chat={chat} onSend={actions.sendChat} me={me} />
          </div>
        </main>
      </>
    )
  }

  // ── Combat ─────────────────────────────────────────────────────────
  const interactive = !!role && (canPlace(role) || canRotate(role))
  const amCaptain = !!role && canValidate(role)
  const iSeeClues = canSeeClues(role)
  const iSeeWords = canSeeWords(role)
  const boardFeedbacks = sharedFeedback || (canSeeFeedback(role) ? view.feedback : null) || {}
  const boardFull = Object.keys(board).length === 4
  const myOrgan = role ? ORGANS[role] : null
  const crew = roster.map(p => ({ id: p.user_id, hue: hueOf(p.pseudo), role: p.role, pseudo: p.pseudo }))

  async function onValidate() {
    const res = await actions.validate()
    if (res?.error === 'incomplete') alert('Les 4 cartes doivent être posées avant de valider.')
  }

  async function onSonar(slot) {
    const res = await actions.sonar(slot)
    if (res?.error) { if (res.error === 'sonar_spent') alert('Sonar déjà utilisé cet assaut.'); return }
    setSonarResult({ slot, green: res.green })
  }

  return (
    <>
      <Header />
      <main className="raid-page raid-page--combat">
        {/* Bloc 3D plein écran : la méduse tente d'attraper l'équipage */}
        <div className="raid-monster">
          <Suspense fallback={<div className="raid-monster-loading">Invocation de {boss.name}…</div>}>
            <RaidMonster3D crew={crew} hp={session.current_hp} maxHp={session.max_hp} hitSignal={hitSignal} attackSignal={attackSignal} />
          </Suspense>
          <div className="raid-monster-overlay">
            <div className="raid-monster-topline">
              <div className="raid-monster-name"><span className="raid-monster-emoji">{boss.emoji}</span> {boss.name}</div>
              <div className="raid-monster-stats">
                <span className="rms-chip rms-chip--time"><Timer deadline={session.assault_deadline} onExpire={actions.signalTimeout} /></span>
                <span className="rms-chip">Assaut <b>{Math.min(session.assault_index + 1, session.assault_count)}/{session.assault_count}</b></span>
                <span className="rms-chip">Essais <b>{session.attempts_remaining}</b></span>
                <span className="rms-chip rms-chip--lives">{'🛟'.repeat(Math.max(0, session.lives)) || '—'}</span>
              </div>
            </div>
            <HpBar hp={session.current_hp} max={session.max_hp} />
          </div>
        </div>

        {/* Bandeau équipage */}
        <div className="raid-crewbar">
          <RoleStrip roster={roster} meId={user?.id} />
        </div>

        {/* Deux colonnes : grille + réserve | chat (large) */}
        <div className="raid-combat-cols">
          <div className="raid-col-board">
            <RaidBoard
              board={board}
              cardOrder={session.card_order || []}
              feedbacks={boardFeedbacks}
              interactive={interactive}
              onChange={actions.moveBoard}
              onPreview={actions.previewBoard}
              clues={view.clues || null}
              words={view.words || null}
              canSeeClues={iSeeClues}
              canSeeWords={iSeeWords}
            />
            {amCaptain && (
              <div className="raid-captain-bar">
                <button className="btn-primary" onClick={onValidate} disabled={!boardFull || busy}>
                  {busy ? 'Validation…' : boardFull ? 'Valider l’essai' : 'Place les 4 cartes…'}
                </button>
                {!session.sonar_used ? (
                  <div className="raid-sonar">
                    <span className="raid-sonar-label">🔍 Sonar (1×)</span>
                    {[0, 1, 2, 3].filter(s => board[s]).map(s => (
                      <button key={s} type="button" className="raid-sonar-btn" onClick={() => onSonar(s)} disabled={busy}>{SLOT_LABELS[s]}</button>
                    ))}
                    {[0, 1, 2, 3].filter(s => board[s]).length === 0 && <span className="raid-sonar-hint">pose une carte pour la sonder</span>}
                  </div>
                ) : sonarResult ? (
                  <span className="raid-sonar-result">Sonar {SLOT_LABELS[sonarResult.slot]} : {sonarResult.green ? '✓ carte parfaite' : '✗ pas encore'}</span>
                ) : (
                  <span className="raid-sonar-result raid-sonar-result--spent">Sonar utilisé cet assaut</span>
                )}
                {view.feedback && (
                  <button className="btn-secondary" onClick={() => actions.shareFeedback(view.feedback)}>
                    Partager les couleurs
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="raid-col-chat">
            <RaidChat chat={chat} onSend={actions.sendChat} me={me} />
          </div>
        </div>
      </main>
    </>
  )
}
