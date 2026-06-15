// raid-screens.jsx — les écrans du redesign RAID.
// Lit les composants partagés (window.*) et les composants du design system
// Orienta (window.OrientaDesignSystem_50c4c1) au moment du rendu.

const DS = window.OrientaDesignSystem_50c4c1;

// ── Données d'exemple ────────────────────────────────────────────────
const CREW = [
  { pseudo: 'Maya',     role: 'oeil',      me: false },
  { pseudo: 'Tu',       role: 'capitaine', me: true,  speaking: false },
  { pseudo: 'Sofiane',  role: 'main',      me: false, speaking: true },
];

const LOBBY_ROSTER = {
  oeil:      { pseudo: 'Maya',    ready: true },
  capitaine: { pseudo: 'Tu',      ready: true, me: true },
  main:      null, // libre
};

const LOBBY_CHAT = [
  { sys: 'Maya a rejoint l’équipage' },
  { pseudo: 'Maya', role: 'oeil', text: 'Salut ! Je prends l’Œil, je vous guiderai.' },
  { pseudo: 'Tu', role: 'capitaine', me: true, text: 'Parfait, je suis Capitaine. Il nous manque la Main.' },
  { pseudo: 'Maya', role: 'oeil', text: 'Dès qu’on est 3 prêts, ça lance tout seul 💪' },
];

const COMBAT_CHAT = [
  { sys: 'Assaut 2 sur 3 — 4:21 restantes' },
  { pseudo: 'Maya', role: 'oeil', text: 'La carte CORAIL va en haut-gauche. Tourne-la 2 fois.' },
  { pseudo: 'Sofiane', role: 'main', text: 'Posée et tournée ✋ La suivante ?' },
  { pseudo: 'Maya', role: 'oeil', text: 'Bleue en bas-droite, sans rotation.' },
  { pseudo: 'Tu', role: 'capitaine', me: true, text: 'Je sonde le haut-gauche avant de valider 🔍' },
  { pseudo: 'Maya', role: 'oeil', text: 'Vas-y ! L’indice du bas, c’est « tempête ».' },
];

// Grille d'exemple (vocabulaire marin). placements: TL, TR, BL, BR.
const BOARD = {
  clues: { top: 'EN MER', right: 'AU PORT', bottom: 'TEMPÊTE', left: 'À BORD' },
  placements: [
    { words: { top: 'VAGUE', right: 'QUAI', bottom: 'GRAIN', left: 'PONT' }, rotation: 0,   colorIndex: 1, feedback: 'correct' },
    { words: { top: 'HOULE', right: 'DIGUE', bottom: 'BOURRASQUE', left: 'CALE' }, rotation: 90, colorIndex: 3, feedback: 'rotation' },
    { words: { top: 'LARGE', right: 'AMARRE', bottom: 'RAFALE', left: 'CABINE' }, rotation: 0, colorIndex: 2, feedback: 'correct' },
    { words: { top: 'COURANT', right: 'JETÉE', bottom: 'ORAGE', left: 'HUBLOT' }, rotation: 180, colorIndex: 0, feedback: 'wrong' },
  ],
};

// ════════════════════════════════════════════════════════════════════
// 01 · LOBBY — formation de l'équipage
// ════════════════════════════════════════════════════════════════════
function LobbyScreen() {
  const { SectionKicker, Button } = DS;
  const readyCount = Object.values(LOBBY_ROSTER).filter((p) => p && p.ready).length;

  return (
    <div className="rd">
      <Topbar online={6} />

      {/* Scène : le boss en approche, calme avant le combat */}
      <div className="rd-stage rd-stage--lobby" style={{ '--fx': 0.5 }}>
        <StageBg />
        <div className="rd-stage-inner">
          <Boss emoji="🐋" />
          <div className="rd-boss-head">
            <div className="rd-boss-name">
              <span className="rd-boss-eyebrow">Semaine 1 · Boss coopératif</span>
              <h1 className="rd-boss-title">Le Rorqual colossal</h1>
            </div>
            <div className="rd-boss-chips">
              <span className="rd-chip rd-chip--week">3 assauts</span>
              <span className="rd-chip">PV <b>300</b></span>
              <span className="rd-chip rd-chip--lives"><Lives n={3} /></span>
              <span className="rd-chip">⏱ <b>5:00</b>/assaut</span>
              <span className="rd-chip">👥 min <b>3</b></span>
            </div>
          </div>
        </div>
      </div>

      <div className="rd-work">
        <div className="rd-work-cols">
          {/* Gauche : rôles + préparation */}
          <div>
            <SectionKicker num="01">Formez l’équipage</SectionKicker>
            <p style={{ color: 'var(--ink-2)', fontSize: 14.5, lineHeight: 1.5, margin: '12px 0 18px', maxWidth: '60ch' }}>
              Chacun choisit un <b>rôle secret</b> aux pouvoirs uniques. Personne ne voit tout :
              il faudra <b>se parler</b> pour vaincre le boss. Couvrez les 3 rôles, puis « Prêt ».
            </p>

            <div className="rd-rolecards">
              {['oeil', 'main', 'capitaine'].map((key) => {
                const r = RAID_ROLES[key];
                const holder = LOBBY_ROSTER[key];
                const mine = holder && holder.me;
                const free = !holder;
                const cls = 'rd-rolecard' + (mine ? ' rd-rolecard--mine' : free ? ' rd-rolecard--free' : ' rd-rolecard--taken');
                return (
                  <div key={key} className={cls}>
                    {mine && <span className="rd-mine-flag">Ton rôle</span>}
                    <div className="rd-rolecard-top">
                      <span className="rd-rolecard-emoji">{r.emoji}</span>
                      <span>
                        <span className="rd-rolecard-name" style={{ display: 'block' }}>{r.label}</span>
                        <span className="rd-rolecard-tagline">{r.tagline}</span>
                      </span>
                    </div>
                    <div className="rd-powers">
                      {r.powers.map((p, i) => (
                        <div key={i} className={`rd-power rd-power--${p.kind}`}>
                          <span className="rd-power-key">{p.kind === 'see' ? '👁 Voit' : p.kind === 'do' ? '✋ Fait' : '🚫 Aveugle'}</span>
                          <span className="rd-power-txt">{richText(p.text)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="rd-rolecard-holder">
                      {holder ? (
                        <>
                          <span className="rd-holder-av" style={{ background: mine ? 'var(--teal)' : hueColor(holder.pseudo) }}>
                            {holder.pseudo[0].toUpperCase()}
                          </span>
                          <span className="rd-holder-name">{mine ? 'Toi' : holder.pseudo}</span>
                          {holder.ready && <span className="rd-holder-ready">✓ prêt</span>}
                        </>
                      ) : (
                        <span className="rd-holder-take">＋ Prendre ce rôle</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rd-ready-bar">
              <Button variant="primary">✓ Je suis prêt</Button>
              <span className="rd-ready-status">
                Il reste <b>1 rôle</b> à couvrir — la Main.
              </span>
              <span className="rd-spacer" />
              <span className="rd-ready-status" style={{ fontSize: 13 }}>{readyCount}/3 prêts</span>
              <span className="rd-ready-dots">
                <i className="on" /><i className="on" /><i />
              </span>
            </div>
          </div>

          {/* Droite : chat + record */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="rd-panel" style={{ height: 360, display: 'flex' }}>
              <Chat messages={LOBBY_CHAT} />
            </div>
            <HallOfFame />
          </div>
        </div>
      </div>
    </div>
  );
}

// Petit tableau du record de la semaine (réutilisé).
function HallOfFame() {
  const rows = [
    { rank: 1, time: '3:48', crew: ['Léa', 'Tom', 'Inès'] },
    { rank: 2, time: '4:05', crew: ['Hugo', 'Zoé', 'Sami'] },
    { rank: 3, time: '4:31', crew: ['Anna', 'Eli', 'Noé'] },
  ];
  return (
    <div className="rd-panel rd-hof">
      <div className="rd-panel-head">
        <span style={{ fontSize: 18 }}>🏆</span>
        <span className="rd-panel-title">Record de la semaine</span>
      </div>
      {rows.map((r) => (
        <div key={r.rank} className="rd-hof-row">
          <span className={`rd-hof-rank${r.rank === 1 ? ' is-gold' : ''}`}>{r.rank === 1 ? '🥇' : r.rank}</span>
          <span className="rd-hof-crew">
            {r.crew.map((c, i) => (
              <span key={c} className="rd-holder-av" style={{ background: hueColor(c, i) }}>{c[0]}</span>
            ))}
          </span>
          <span className="rd-hof-time">{r.time}</span>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// 02 · COMBAT — le cœur du mode
// ════════════════════════════════════════════════════════════════════
function CombatScreen({ fx = 0.6, shards = true, vignette = true }) {
  const { PuzzleBoard, Button } = DS;
  return (
    <div className="rd">
      <Topbar online={6} />

      <div className="rd-stage rd-stage--combat" data-vignette={vignette ? 'true' : 'false'} style={{ '--fx': fx }}>
        <StageBg />
        <div className="rd-stage-inner">
          <Boss emoji="🐋" combat impact={shards} />
          <div className="rd-boss-head">
            <div className="rd-boss-name">
              <span className="rd-boss-eyebrow">Semaine 1 · Combat en cours</span>
              <h1 className="rd-boss-title">Le Rorqual colossal</h1>
            </div>
            <div className="rd-boss-chips">
              <span className="rd-chip rd-chip--week">Assaut <b>2/3</b></span>
              <span className="rd-chip rd-chip--timer is-low">⏱ <b>0:24</b></span>
              <span className="rd-chip rd-chip--lives"><Lives n={2} /></span>
            </div>
          </div>
          <HpBar hp={130} max={300} />
        </div>
        {/* Équipage superposé à droite */}
        <div style={{ position: 'absolute', top: 22, right: 28, width: 196, zIndex: 3 }}>
          <CrewRail members={CREW} />
        </div>
      </div>

      <div className="rd-work">
        <RoleLens role="capitaine" />
        <div className="rd-work-cols">
          {/* Gauche : le plateau + barre capitaine */}
          <div className="rd-boardwrap">
            <PuzzleBoard size={128} clues={BOARD.clues} placements={BOARD.placements} />
            <div className="rd-actionbar">
              <Button variant="primary">✓ Valider l’essai</Button>
              <span className="rd-sonar">
                <span className="rd-sonar-label">🔍 Sonar (1×)</span>
                <button className="rd-sonar-btn" type="button">↖ N-O</button>
                <button className="rd-sonar-btn" type="button">↗ N-E</button>
                <button className="rd-sonar-btn" type="button">↙ S-O</button>
                <button className="rd-sonar-btn" type="button">↘ S-E</button>
              </span>
              <Button variant="secondary">Partager les couleurs</Button>
            </div>
          </div>

          {/* Droite : coordination */}
          <div className="rd-panel" style={{ height: 470, display: 'flex' }}>
            <Chat messages={COMBAT_CHAT} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// 03 · CINÉMATIQUE DE FIN — victoire
// ════════════════════════════════════════════════════════════════════
function CinematicScreen({ fx = 0.6 }) {
  const { Button } = DS;
  return (
    <div className="rd">
      <Topbar online={6} right={<span className="rd-onlinepill" style={{ background: 'transparent', color: 'var(--ink-3)' }}>Débrief en préparation…</span>} />
      <div className="rd-stage rd-stage--end rd-end--won" data-vignette="true" style={{ '--fx': fx }}>
        <StageBg />
        <div className="rd-end">
          <Boss emoji="🐋" combat impact />
          <span className="rd-end-badge">⚔️ Victoire d’équipage</span>
          <h1 className="rd-end-title">Le Rorqual colossal est vaincu !</h1>
          <p className="rd-end-sub">L’équipage a tenu bon. La bête replonge dans les abysses…</p>
          <div className="rd-end-crew">
            {CREW.map((m, i) => (
              <span key={m.pseudo} className="rd-crew-av" style={{ background: m.me ? 'var(--teal)' : hueColor(m.pseudo, i) }}>
                {m.pseudo[0].toUpperCase()}
                <span className="rd-crew-role-emoji">{RAID_ROLES[m.role].emoji}</span>
              </span>
            ))}
          </div>
          <Button variant="primary" size="lg">Voir le résultat →</Button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// 04 · RÉSULTAT — victoire / défaite
// ════════════════════════════════════════════════════════════════════
function ResultScreen({ won = true }) {
  const { Button, XPGauge } = DS;
  return (
    <div className="rd">
      <Topbar online={6} />
      <div className="rd-result-wrap">
        <div className={`rd-result ${won ? 'rd-result--won' : 'rd-result--lost'}`}>
          <div className="rd-result-top">
            {won && <span className="rd-result-badge">⚔️ Victoire d’équipage</span>}
            <span className="rd-result-emoji">{won ? '🏆' : '🌑'}</span>
            <h1 className="rd-result-title">
              {won ? 'Le Rorqual colossal est terrassé !' : 'Le Rorqual colossal a replongé…'}
            </h1>
            <p className="rd-result-sub">
              {won
                ? 'Votre équipage a terrassé le boss de la semaine. L’abysse vous doit une fière chandelle.'
                : 'L’équipage est tombé. Mais la mer offre toujours une seconde chance.'}
            </p>

            <div className="rd-result-stats">
              {won ? (
                <>
                  <div className="rd-stat">
                    <span className="rd-stat-label">Temps de clear</span>
                    <span className="rd-stat-val">4:12</span>
                  </div>
                  <div className="rd-stat rd-stat--gold">
                    <span className="rd-stat-label">Classement semaine</span>
                    <span className="rd-stat-val">🥇 1ᵉʳ</span>
                    <span className="rd-stat-hint">meilleur temps · sur 7 équipages</span>
                  </div>
                  <div className="rd-stat">
                    <span className="rd-stat-label">XP collectif</span>
                    <span className="rd-stat-val">+2 400</span>
                    <span className="rd-stat-hint">offert à la communauté</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="rd-stat">
                    <span className="rd-stat-label">Assauts franchis</span>
                    <span className="rd-stat-val">2 / 3</span>
                  </div>
                  <div className="rd-stat rd-stat--record">
                    <span className="rd-stat-label">Record à battre</span>
                    <span className="rd-stat-val">3:48</span>
                    <span className="rd-stat-hint">la gloire est à votre portée</span>
                  </div>
                  <div className="rd-stat">
                    <span className="rd-stat-label">Boss restant</span>
                    <span className="rd-stat-val">130 PV</span>
                    <span className="rd-stat-hint">si proche du but…</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {won && (
            <div className="rd-panel" style={{ width: '100%' }}>
              <XPGauge mascot={<span>🦈</span>} eyebrow="Communauté" level="Niveau 7 — Chasseur"
                xp="9 240 XP collectifs" pct={68} nextLabel="Léviathan dans 3 760 XP" />
            </div>
          )}

          <div className="rd-result-crew">
            <div className="rd-result-crewtitle">L’équipage</div>
            <div className="rd-result-crewlist">
              {CREW.map((m, i) => (
                <span key={m.pseudo} className="rd-res-member">
                  <span className="rd-holder-av" style={{ background: m.me ? 'var(--teal)' : hueColor(m.pseudo, i) }}>
                    {m.pseudo[0].toUpperCase()}
                    <span className="rd-res-mrole">{RAID_ROLES[m.role].emoji}</span>
                  </span>
                  <span className="rd-res-mname">{m.me ? 'Toi' : m.pseudo}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="rd-result-actions">
            {won ? (
              <>
                <Button variant="primary">Rejouer</Button>
                <Button variant="secondary">Partager le résultat</Button>
                <Button variant="ghost">Retour au hub</Button>
              </>
            ) : (
              <>
                <Button variant="primary">⚔️ La revanche</Button>
                <Button variant="secondary">Partager</Button>
                <Button variant="ghost">Retour au hub</Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Panneau « Direction & système » (intro du canvas) ────────────────
function DirectionDoc() {
  return (
    <div className="rd-doc" style={{ background: 'var(--card)' }}>
      <h1>RAID — refonte « Les abysses chaleureux »</h1>
      <p className="rd-doc-lede">
        Une <b>scène en teal profond</b> porte le boss et le combat (ambiance forte, dramatique),
        mais toute l’UI de contrôle reste sur la <b>surface claire pointillée d’Orienta</b>,
        cartes blanches arrondies. L’intensité du mode en haut, l’ADN Orienta partout ailleurs.
      </p>
      <div className="rd-doc-grid">
        <div className="rd-doc-card">
          <h3>🎭 Lisibilité de l’info cachée</h3>
          <p>Chaque rôle contraste clairement ce qu’il <b>voit</b> et ce qu’il <b>fait</b>. Une « lentille de rôle » rappelle en combat tes pouvoirs. Fini le doute sur « qui peut quoi ».</p>
        </div>
        <div className="rd-doc-card">
          <h3>🗣️ Le chat au centre</h3>
          <p>La coordination devient une vraie colonne, messages <b>tagués par rôle</b> et couleur. C’est là que se gagne le raid — on l’élève au rang d’outil principal.</p>
        </div>
        <div className="rd-doc-card">
          <h3>🎨 Palette &amp; effets</h3>
          <p>Teal profond pour l’abysse, corail pour les PV/dangers, identités des cartes inchangées. Les effets de combat sont <b>réglables</b> (panneau Tweaks).</p>
          <div className="rd-doc-swatches">
            <span className="rd-sw"><i style={{ background: '#062a25' }} />abysse</span>
            <span className="rd-sw"><i style={{ background: 'var(--teal)' }} />teal</span>
            <span className="rd-sw"><i style={{ background: 'var(--coral)' }} />PV</span>
            <span className="rd-sw"><i style={{ background: 'var(--amber)' }} />record</span>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LobbyScreen, CombatScreen, CinematicScreen, ResultScreen, DirectionDoc });
