import { useState, useEffect, useRef, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import confetti from 'canvas-confetti'
import Header from '../../components/ui/Header'
import { useAuthStore } from '../../stores/authStore'
import { useRaidArena } from '../../lib/useRaidArena'
import { useGeneralChat } from '../../lib/useGeneralChat'
import { getAdminSecret } from '../../lib/adminSecret'
import { ORGANS, organPowers, getBossByKey, BOSSES, canPlace, canRotate, canValidate, canSeeFeedback, canSeeClues, canSeeWords, canSeeRaid, isRaidAdmin, isRaidLaunched, currentRaidLevel, difficultyForLevel } from '../../lib/raid'
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
const POWER_KEY = { see: '👁 Voit', do: '✋ Fait', blind: '🚫 Aveugle' }
const fmtClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

// Rend « **gras** » → <b>gras</b> dans les libellés de pouvoirs (lentille de rôle).
function richText(s) {
  return String(s).split(/\*\*(.+?)\*\*/g).map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p))
}

// Bandeau d'identité du mode RAID (sous le header global) : badge + semaine +
// nombre de joueurs « en mer » + sortie rapide. Donne au mode son identité propre
// (« mode séparé ») sans remplacer la navigation globale.
function RaidStrip({ level, online, onLeave }) {
  return (
    <div className="raid-strip">
      <span className="raid-strip-badge">⚔️ Raid</span>
      {level != null && <span className="raid-strip-week">Semaine {level}</span>}
      <span className="raid-strip-spacer" />
      {online != null && <span className="raid-strip-online"><i />{online} en mer</span>}
      {onLeave && (
        <button type="button" className="raid-strip-leave" onClick={onLeave}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
          Quitter
        </button>
      )}
    </div>
  )
}

// Lentille de rôle (combat) : rappelle en permanence le rôle du joueur et ses pouvoirs.
function RoleLens({ organ, role }) {
  if (!organ) return null
  return (
    <div className="raid-lens">
      <span className="raid-lens-emoji">{organ.emoji}</span>
      <div className="raid-lens-txt">
        <span className="raid-lens-role">Tu joues : <span>{organ.label}</span></span>
        {organ.tagline && <span className="raid-lens-desc">{organ.tagline}</span>}
      </div>
      <div className="raid-lens-tags">
        {organPowers(role).map((p, i) => (
          <span key={i} className={`raid-power-key raid-power-key--${p.kind}`}>{POWER_KEY[p.kind]}</span>
        ))}
      </div>
    </div>
  )
}

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
  // Le SAS (salle d'attente) discute sur le canal GÉNÉRAL d'organisation (le même
  // que la bulle flottante de l'app), éphémère 10 min. Le chat de COMBAT reste
  // tactique et séparé (par session) → on garde `chat`/`actions.sendChat` pour lui.
  const general = useGeneralChat(user)
  const canOpen = canSeeRaid(user?.pseudo)
  const isAdmin = isRaidAdmin(user?.pseudo)
  const [opening, setOpening] = useState(false)
  const [sonarResult, setSonarResult] = useState(null)
  // Onglets mobile (le plateau et le chat ne tiennent pas côte à côte) : 'board' | 'chat'.
  // Sur desktop le contrôle segmenté est masqué et les 2 colonnes s'affichent toujours.
  const [combatTab, setCombatTab] = useState('board')
  // Onglets mobile du lobby : 'roles' | 'chat'.
  const [lobbyTab, setLobbyTab] = useState('roles')
  // Compteur de messages non lus quand on n'est pas sur l'onglet Chat (badge mobile).
  const [unread, setUnread] = useState(0)
  const chatLenRef = useRef(0)
  // Prévisualisation admin de l'UI des différents boss (affichage local uniquement).
  const [bossPreview, setBossPreview] = useState(null)
  // Le sonar se recharge à chaque assaut → on efface le résultat affiché.
  useEffect(() => { setSonarResult(null) }, [session?.assault_index, session?.status])

  // Badge « messages non lus » sur l'onglet Chat (mobile) : incrémente tant qu'on
  // regarde le plateau, se remet à zéro quand on ouvre le chat.
  const chatLen = chat?.length ?? 0
  useEffect(() => {
    if (combatTab !== 'chat' && chatLen > chatLenRef.current) setUnread(u => u + (chatLen - chatLenRef.current))
    chatLenRef.current = chatLen
  }, [chatLen, combatTab])
  useEffect(() => { if (combatTab === 'chat') setUnread(0) }, [combatTab])

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
          <RaidStrip level={currentRaidLevel()} online={null} onLeave={() => navigate('/hub')} />
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
              {won && <span className="raid-endbanner-badge">⚔️ Victoire d’équipage</span>}
              <div className="raid-endbanner-emoji">{won ? '🏆' : '🌑'}</div>
              <h2 className="raid-endbanner-title">{won ? `${boss.name} est vaincu !` : `${boss.name} a replongé…`}</h2>
              <p className="raid-endbanner-sub">
                {won ? 'L’équipage a tenu bon. La bête replonge dans les abysses…' : 'L’équipage est tombé… Débrief en préparation…'}
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
    const lvl = session.boss_level ?? currentRaidLevel()
    const cfg = difficultyForLevel(lvl)
    const lobbyCrew = roster.map(p => ({ id: p.user_id, hue: hueOf(p.pseudo), role: p.role, pseudo: p.pseudo }))
    return (
      <>
        <Header />
        <main className="raid-page raid-page--waiting">
          <RaidStrip level={lvl} online={roster.length} onLeave={() => navigate('/hub')} />
          <RaidIntroBanner />

          {/* Scène : le boss en approche, calme avant le combat (même décor que le combat). */}
          <div className="raid-monster raid-monster--lobby">
            <Suspense fallback={<div className="raid-monster-loading">Le boss approche…</div>}>
              <RaidMonster boss={boss.key} crew={lobbyCrew} hp={cfg.assault_count * 100} maxHp={cfg.assault_count * 100} assaultIndex={0} assaultCount={cfg.assault_count} />
            </Suspense>
            <div className="raid-crew-overlay"><RoleStrip roster={roster} meId={user?.id} vertical /></div>
            <div className="raid-monster-overlay">
              <div className="raid-monster-topline">
                <div className="raid-monster-name"><span className="raid-monster-emoji">{boss.emoji}</span> {boss.name}</div>
                <div className="raid-monster-stats">
                  <span className="rms-chip rms-chip--week">Sem.&nbsp;<b>{lvl}</b></span>
                  <span className="rms-chip">{cfg.assault_count}&nbsp;assauts</span>
                  <span className="rms-chip">PV&nbsp;<b>{cfg.assault_count * 100}</b></span>
                  <span className="rms-chip rms-chip--lives">{'🛟'.repeat(Math.max(0, cfg.lives)) || '—'}</span>
                  <span className="rms-chip">⏱&nbsp;<b>{fmtClock(cfg.timer_seconds)}</b></span>
                  <span className="rms-chip">👥&nbsp;min&nbsp;<b>{cfg.min_players}</b></span>
                </div>
              </div>
            </div>
          </div>

          {/* Contrôle segmenté (mobile) : Rôles / Chat — masqué sur desktop. */}
          <div className="raid-seg raid-seg--lobby" role="tablist">
            <button type="button" role="tab" aria-selected={lobbyTab === 'roles'} className={`raid-seg-btn${lobbyTab === 'roles' ? ' is-on' : ''}`} onClick={() => setLobbyTab('roles')}>🎭 Rôles</button>
            <button type="button" role="tab" aria-selected={lobbyTab === 'chat'} className={`raid-seg-btn${lobbyTab === 'chat' ? ' is-on' : ''}`} onClick={() => setLobbyTab('chat')}>
              💬 Chat{lobbyTab !== 'chat' && general.chat.length > 0 && <span className="raid-seg-badge">{general.chat.length}</span>}
            </button>
          </div>

          {/* Section 01 — Formez l'équipage : rôles + bouton « Prêt » (RosterBoard) + chat. */}
          <div className="raid-lobby" data-tab={lobbyTab}>
            <RosterBoard boss={boss} roster={roster} me={me} actions={actions} busy={busy} minPlayers={cfg.min_players} />
            <div className="raid-lobby-side">
              <div className="raid-lobby-chatpanel">
                <RaidChat
                  chat={general.chat}
                  onSend={general.sendChat}
                  me={general.me}
                  title="Discussion générale"
                  placeholder="Votre message…"
                  emptyHint="Organisez-vous ici — c'est le canal général de l'app. Les messages s'effacent au bout de 10 min."
                />
              </div>
            </div>
          </div>

          {/* Section 02 — Le classement du raid : vainqueurs de la semaine + trinômes défaits. */}
          <div className="raid-classement">
            <div className="raid-lobby-kicker">
              <span className="raid-lobby-kicker-label">
                <span className="raid-lobby-kicker-num">02</span>
                <span className="raid-lobby-kicker-txt">Le classement du raid</span>
              </span>
              <span className="raid-lobby-kicker-rule" />
            </div>
            <HallOfFame compact level={lvl} fetchHof={actions.fetchHof} />
          </div>
        </main>
      </>
    )
  }

  // ── Combat déjà lancé sans moi (surplus) : le hook me bascule automatiquement vers
  //    une nouvelle arène (rappel de find/ensure-public) ; bouton de secours au cas où. ──
  if (!role && spectator) {
    return (
      <>
        <Header />
        <main className="raid-page">
          <RaidStrip level={session.boss_level ?? currentRaidLevel()} online={roster.length} onLeave={() => navigate('/hub')} />
          <div className="raid-empty">
            <div className="raid-empty-emoji">{boss.emoji}</div>
            <h1 className="raid-h1">Ce combat a démarré sans toi</h1>
            <p className="raid-sub">L’équipage est déjà aux prises avec {boss.name}. On te place dans une <b>nouvelle arène</b> pour former un nouvel équipage…</p>
            <button className="btn-primary" onClick={() => window.location.reload()}>Rejoindre une nouvelle arène</button>
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
        <RaidStrip level={session.boss_level ?? currentRaidLevel()} online={roster.length} onLeave={() => navigate('/hub')} />
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

        {/* Lentille de rôle : rappelle en permanence ton rôle et tes pouvoirs. */}
        <RoleLens organ={myOrgan} role={role} />

        {/* Contrôle segmenté (mobile) : Plateau / Chat — masqué sur desktop (2 colonnes). */}
        <div className="raid-seg" role="tablist">
          <button type="button" role="tab" aria-selected={combatTab === 'board'} className={`raid-seg-btn${combatTab === 'board' ? ' is-on' : ''}`} onClick={() => setCombatTab('board')}>🧩 Plateau</button>
          <button type="button" role="tab" aria-selected={combatTab === 'chat'} className={`raid-seg-btn${combatTab === 'chat' ? ' is-on' : ''}`} onClick={() => setCombatTab('chat')}>
            💬 Chat{unread > 0 && <span className="raid-seg-badge">{unread}</span>}
          </button>
        </div>

        {/* Deux colonnes : grille + réserve | chat (large) */}
        <div className="raid-combat-cols" data-tab={combatTab}>
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
