import { useState, useEffect, useRef, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import confetti from 'canvas-confetti'
import Header from '../../components/ui/Header'
import { useAuthStore } from '../../stores/authStore'
import { useRaidArena } from '../../lib/useRaidArena'
import { getAdminSecret } from '../../lib/adminSecret'
import { ORGANS, getBossByKey, BOSSES, canPlace, canRotate, canValidate, canSeeFeedback, canSeeClues, canSeeWords, canSeeRaid, isRaidAdmin, isRaidLaunched, currentRaidLevel, difficultyForLevel } from '../../lib/raid'
import RosterBoard from '../../components/raid/RosterBoard'
import RaidChat from '../../components/raid/RaidChat'
import RoleStrip from '../../components/raid/RoleStrip'
import RaidBoard from '../../components/raid/RaidBoard'
import HallOfFame from '../../components/raid/HallOfFame'
import RaidIntroBanner from '../../components/raid/RaidIntroBanner'

// Boss RAID : 3D (modèle .glb) si dispo, sinon scène 2D vectorielle (aiguilleur).
import RaidMonster from '../../components/raid/RaidMonster'
const hueOf = (s) => { let h = 0; for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h }

// Le plateau est une grille 2×2 (slots 0=haut-gauche, 1=haut-droite, 2=bas-gauche,
// 3=bas-droite). On nomme les cartes par leur coin en langage marin (boussole) :
// nord-ouest / nord-est / sud-ouest / sud-est → plus cohérent que haut/bas/gauche/droite.
const SLOT_LABELS = { 0: '↖ N-O', 1: '↗ N-E', 2: '↙ S-O', 3: '↘ S-E' }

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

// Bouquet de confettis sur la victoire (cinématique de fin de combat). Monté
// uniquement quand l'équipage gagne → les tirs accompagnent la baleine qui coule.
function VictoryFX() {
  useEffect(() => {
    const colors = ['#ffd166', '#06d6a0', '#4cc9f0', '#ffffff', '#f4a261']
    const burst = (x, n = 60) => confetti({ particleCount: n, spread: 82, startVelocity: 44, ticks: 150, gravity: 0.9, scalar: 1.05, origin: { x, y: 0.34 }, colors })
    burst(0.5)
    const timers = [
      setTimeout(() => burst(0.22), 280),
      setTimeout(() => burst(0.78), 480),
      setTimeout(() => burst(0.5, 110), 1200), // gros bouquet au moment où la baleine s'enfonce
    ]
    return () => timers.forEach(clearTimeout)
  }, [])
  return null
}

export default function RaidArenaPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const arena = useRaidArena(user)
  const { loading, noArena, session, roster, me, view, board, chat, sharedFeedback, role, actions, busy } = arena
  const canOpen = canSeeRaid(user?.pseudo)
  const isAdmin = isRaidAdmin(user?.pseudo)
  const [opening, setOpening] = useState(false)
  const [sonarResult, setSonarResult] = useState(null)
  // Prévisualisation admin de l'UI des différents boss (affichage local uniquement).
  const [bossPreview, setBossPreview] = useState(null)
  // Le sonar se recharge à chaque assaut → on efface le résultat affiché.
  useEffect(() => { setSonarResult(null) }, [session?.assault_index, session?.status])

  // Combat lancé sans moi : il est déjà en cours et je n'en fais pas partie (sessions
  // parallèles → je pourrai ouvrir une nouvelle arène). Délai de ~2,5 s pour ne pas
  // afficher cet écran à un participant dont la vue n'est pas encore chargée.
  const [spectator, setSpectator] = useState(false)
  useEffect(() => {
    if (session?.status !== 'active' || role) { setSpectator(false); return }
    const t = setTimeout(() => setSpectator(true), 2500)
    return () => clearTimeout(t)
  }, [session?.status, role])

  // Fin de combat → cinématique (~3,8 s : le boss coule et disparaît, l'équipage saute)
  // puis bascule automatique vers la page résultat dédiée (récap, temps, rang, record).
  useEffect(() => {
    if (session?.status !== 'won' && session?.status !== 'lost') return
    const id = session.id
    const t = setTimeout(() => navigate(`/raid/resultat/${id}`, { replace: true }), 3800)
    return () => clearTimeout(t)
  }, [session?.status, session?.id, navigate])

  // Signaux pour animer la scène : perte de PV → assaut réussi (cascade d'effets + flash clair),
  // essai raté ou bouée perdue → contre-attaque du boss (flash rouge + secousse).
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
  // pour voir l'animation de combat du boss.
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

  // Aucune arène (le raid est disponible à toute heure : il suffit d'être à plusieurs).
  if (noArena || !session) {
    const launched = isRaidLaunched()
    return (
      <>
        <Header />
        <main className="raid-page raid-page--nowindow">
          <div className="raid-empty">
            <div className="raid-empty-emoji">🌊</div>
            <h1 className="raid-h1">{launched ? 'Aucun équipage en mer pour l’instant' : 'Le raid n’est pas encore ouvert'}</h1>
            <p className="raid-sub">
              {launched
                ? <>Le raid se joue <b>à toute heure</b> : reviens dans un instant, ou invite d’autres joueurs à rejoindre l’arène pour former un équipage.</>
                : <>Le mode RAID ouvre le <b>15 juin à 8h</b>. Reviens à l’ouverture pour affronter le boss en équipe.</>}
            </p>
            {canOpen && (
              <button className="btn-primary" onClick={openTestArena} disabled={opening}>
                {opening ? 'Ouverture…' : '🔧 Ouvrir une arène de test'}
              </button>
            )}
          </div>
          {launched && <HallOfFame level={currentRaidLevel()} fetchHof={actions.fetchHof} />}
        </main>
      </>
    )
  }

  const boss = getBossByKey(session.boss_key)

  // ── Fin de combat : cinématique (le boss coule et disparaît, l'équipage saute de
  //    joie), puis bascule auto (effet ci-dessus) vers /raid/resultat/:id. ──
  if (session.status === 'won' || session.status === 'lost') {
    const won = session.status === 'won'
    const endCrew = roster.map(p => ({ id: p.user_id, hue: hueOf(p.pseudo), role: p.role, pseudo: p.pseudo }))
    return (
      <>
        <Header />
        <main className="raid-page raid-page--combat">
          {won && <VictoryFX />}
          <div className="raid-monster raid-monster--end">
            <Suspense fallback={<div className="raid-monster-loading">Débrief en préparation…</div>}>
              <RaidMonster boss={boss.key} crew={endCrew} hp={won ? 0 : session.current_hp} maxHp={session.max_hp}
                assaultIndex={session.assault_index} assaultCount={session.assault_count} outcome={session.status} />
            </Suspense>
            <div className={`raid-endbanner raid-endbanner--${session.status}`}>
              <div className="raid-endbanner-emoji">{won ? '🏆' : '🌑'}</div>
              <h2 className="raid-endbanner-title">{won ? `${boss.name} est vaincu !` : `${boss.name} a replongé…`}</h2>
              <p className="raid-endbanner-sub">
                {won ? 'Victoire de l’équipage !' : 'L’équipage est tombé…'} Débrief en préparation…
              </p>
              <button className="btn-primary" onClick={() => navigate(`/raid/resultat/${session.id}`, { replace: true })}>
                Voir le résultat →
              </button>
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
          <RaidIntroBanner />
          <div className="raid-lobby">
            <RosterBoard boss={boss} roster={roster} me={me} actions={actions} busy={busy} minPlayers={difficultyForLevel(session.boss_level ?? currentRaidLevel()).min_players} />
            <RaidChat chat={chat} onSend={actions.sendChat} me={me} />
          </div>
          {/* Le record de la semaine à battre — visible pendant qu'on s'organise. */}
          <HallOfFame compact level={session.boss_level ?? currentRaidLevel()} fetchHof={actions.fetchHof} />
        </main>
      </>
    )
  }

  // ── Combat déjà lancé sans moi : je peux ouvrir une arène EN PARALLÈLE. ──
  if (!role && spectator) {
    return (
      <>
        <Header />
        <main className="raid-page">
          <div className="raid-empty">
            <div className="raid-empty-emoji">{boss.emoji}</div>
            <h1 className="raid-h1">Ce combat a démarré sans toi</h1>
            <p className="raid-sub">L’équipage est déjà aux prises avec {boss.name}. Tu peux lancer une <b>nouvelle arène en parallèle</b> avec d’autres joueurs connectés.</p>
            <button className="btn-primary" onClick={() => window.location.reload()}>Ouvrir une nouvelle arène</button>
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

  // Boss affiché : le vrai, sauf prévisualisation admin (flèches) pour évaluer chaque UI.
  const bossIdx = bossPreview != null ? bossPreview : Math.max(0, BOSSES.findIndex(b => b.key === boss.key))
  const displayBoss = BOSSES[bossIdx] || boss
  const cycleBoss = (d) => setBossPreview((bossIdx + d + BOSSES.length) % BOSSES.length)
  // Prévisualisation admin : on affiche la VRAIE difficulté du boss survolé (semaine = index+1).
  const previewing = bossPreview != null
  const pcfg = previewing ? difficultyForLevel(bossIdx + 1) : null
  const fmtMS = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

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
        {/* Scène de combat 2.5D : boss (3D/2D) sur décor illustré + effets d'équipage */}
        <div className="raid-monster">
          <Suspense fallback={<div className="raid-monster-loading">Invocation de {displayBoss.name}…</div>}>
            <RaidMonster boss={displayBoss.key} crew={crew} hp={session.current_hp} maxHp={session.max_hp} assaultIndex={session.assault_index} assaultCount={session.assault_count} hitSignal={hitSignal} attackSignal={attackSignal} />
          </Suspense>
          {/* Équipage en colonne verticale, superposé à droite (gagne de la hauteur). */}
          <div className="raid-crew-overlay"><RoleStrip roster={roster} meId={user?.id} vertical /></div>
          <div className="raid-monster-overlay">
            <div className="raid-monster-topline">
              <div className="raid-monster-name">
                <span className="raid-monster-emoji">{displayBoss.emoji}</span> {displayBoss.name}
                {isAdmin && BOSSES.length > 1 && (
                  <span className="raid-boss-nav">
                    <button type="button" className="raid-boss-navbtn" onClick={() => cycleBoss(-1)} aria-label="Boss précédent">‹</button>
                    <span className="raid-boss-navidx">{bossIdx + 1}/{BOSSES.length}</span>
                    <button type="button" className="raid-boss-navbtn" onClick={() => cycleBoss(1)} aria-label="Boss suivant">›</button>
                  </span>
                )}
              </div>
              <div className="raid-monster-stats">
                {previewing ? (
                  <>
                    <span className="rms-chip rms-chip--preview">aperçu</span>
                    <span className="rms-chip rms-chip--week">Sem.&nbsp;<b>{bossIdx + 1}</b></span>
                    <span className="rms-chip">Assauts&nbsp;<b>{pcfg.assault_count}</b></span>
                    <span className="rms-chip">PV&nbsp;<b>{pcfg.assault_count * 100}</b></span>
                    <span className="rms-chip rms-chip--lives">{'🛟'.repeat(pcfg.lives)}</span>
                    <span className="rms-chip">👥&nbsp;min&nbsp;<b>{pcfg.min_players}</b></span>
                    <span className="rms-chip">⏱&nbsp;<b>{fmtMS(pcfg.timer_seconds)}</b></span>
                    <span className="rms-chip">Grilles&nbsp;<b>{Math.round(pcfg.grid_band[0] * 100)}–{Math.round(pcfg.grid_band[1] * 100)}%</b></span>
                  </>
                ) : (
                  <>
                    <span className="rms-chip rms-chip--week">Sem.&nbsp;<b>{session.boss_level ?? currentRaidLevel()}</b></span>
                    <span className="rms-chip rms-chip--time"><Timer deadline={session.assault_deadline} onExpire={actions.signalTimeout} /></span>
                    <span className="rms-chip">Assaut <b>{Math.min(session.assault_index + 1, session.assault_count)}/{session.assault_count}</b></span>
                    <span className="rms-chip rms-chip--lives" title="Bouées (vies de l’équipage)">{'🛟'.repeat(Math.max(0, session.lives)) || '—'}</span>
                  </>
                )}
              </div>
            </div>
            {previewing
              ? <HpBar hp={pcfg.assault_count * 100} max={pcfg.assault_count * 100} />
              : <HpBar hp={session.current_hp} max={session.max_hp} />}
          </div>
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
                  <span className={`raid-sonar-result ${sonarResult.green ? 'raid-sonar-result--ok' : 'raid-sonar-result--ko'}`}>
                    {sonarResult.green
                      ? <>✓ {SLOT_LABELS[sonarResult.slot]} — carte bien placée</>
                      : <>✗ {SLOT_LABELS[sonarResult.slot]} — pas à sa place</>}
                  </span>
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
