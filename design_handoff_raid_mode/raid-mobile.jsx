// raid-mobile.jsx — écrans RAID pour mobile (cadre iPhone).
// Réutilise les atomes de raid-parts (Boss, StageBg, HpBar, Lives, Chat,
// RAID_ROLES, hueColor) et les composants DS (PuzzleBoard, Button, XPGauge).

const MDS = window.OrientaDesignSystem_50c4c1;

// ── Données ──────────────────────────────────────────────────────────
const M_CREW = [
  { pseudo: 'Maya', role: 'oeil', me: false },
  { pseudo: 'Tu', role: 'capitaine', me: true },
  { pseudo: 'Sofiane', role: 'main', me: false, speaking: true },
];

// Pouvoirs compacts par rôle (libellés courts pour mobile).
const M_PILLS = {
  oeil:      [{ k: 'see', t: '👁 indices + mots' }, { k: 'do', t: '🗣 dicte à la Main' }],
  main:      [{ k: 'blind', t: '🚫 ne voit rien' }, { k: 'do', t: '✋ pose & tourne' }],
  capitaine: [{ k: 'see', t: '👁 couleurs' }, { k: 'do', t: '✓ valide · 🔍 sonar' }],
};

const M_LOBBY_ROSTER = { oeil: { pseudo: 'Maya', ready: true }, capitaine: { pseudo: 'Tu', ready: true, me: true }, main: null };

const M_BOARD = {
  clues: { top: 'EN MER', right: 'AU PORT', bottom: 'TEMPÊTE', left: 'À BORD' },
  placements: [
    { words: { top: 'VAGUE', right: 'QUAI', bottom: 'GRAIN', left: 'PONT' }, rotation: 0, colorIndex: 1, feedback: 'correct' },
    { words: { top: 'HOULE', right: 'DIGUE', bottom: 'RAFALE', left: 'CALE' }, rotation: 90, colorIndex: 3, feedback: 'rotation' },
    { words: { top: 'LARGE', right: 'AMARRE', bottom: 'BOURRASQUE', left: 'CABINE' }, rotation: 0, colorIndex: 2, feedback: 'correct' },
    { words: { top: 'COURANT', right: 'JETÉE', bottom: 'ORAGE', left: 'HUBLOT' }, rotation: 180, colorIndex: 0, feedback: 'wrong' },
  ],
};

const M_CHAT = [
  { sys: 'Assaut 2/3 — 0:24' },
  { pseudo: 'Maya', role: 'oeil', text: 'CORAIL en haut-gauche, tourne 2×.' },
  { pseudo: 'Sofiane', role: 'main', text: 'Posée ✋ La suivante ?' },
  { pseudo: 'Maya', role: 'oeil', text: 'Bleue en bas-droite, sans rotation.' },
  { pseudo: 'Tu', role: 'capitaine', me: true, text: 'Je sonde le haut-gauche 🔍' },
  { pseudo: 'Maya', role: 'oeil', text: 'Vas-y ! Indice du bas = « tempête ».' },
];

const M_LOBBY_CHAT = [
  { sys: 'Maya a rejoint' },
  { pseudo: 'Maya', role: 'oeil', text: 'Salut ! Je prends l’Œil 🔭' },
  { pseudo: 'Tu', role: 'capitaine', me: true, text: 'Je suis Capitaine. Manque la Main.' },
];

// ── Briques communes ─────────────────────────────────────────────────
function MAppbar({ online = 6 }) {
  return (
    <div className="rdm-appbar">
      <span className="rdm-brand"><img src="assets/logo-icon.svg" alt="" /><span>Orienta</span></span>
      <span className="rdm-badge">⚔️ Raid</span>
      <span className="rdm-spacer" />
      <span className="rdm-online"><i />{online}</span>
    </div>
  );
}

function MChip({ children, mod }) { return <span className={`rd-chip${mod ? ' ' + mod : ''}`}>{children}</span>; }

function MCrewStrip({ members }) {
  return (
    <div className="rdm-crew">
      {members.map((m, i) => (
        <div key={m.pseudo} className={`rdm-crew-item${m.speaking ? ' is-speaking' : ''}`}>
          <span className="rdm-crew-av" style={{ background: m.me ? 'var(--teal)' : hueColor(m.pseudo, i) }}>
            {m.pseudo[0].toUpperCase()}
            <span className="rdm-crew-emoji">{RAID_ROLES[m.role].emoji}</span>
          </span>
          <span className={`rdm-crew-name${m.me ? ' is-me' : ''}`}>{m.me ? 'Toi' : m.pseudo}</span>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// LOBBY
// ════════════════════════════════════════════════════════════════════
function MLobby({ fx = 0.3 }) {
  return (
    <div className="rdm">
      <div className="rdm-safe" />
      <MAppbar />
      <div className="rd-stage rdm-stage" style={{ '--fx': fx }}>
        <StageBg />
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <Boss emoji="🐋" />
          <span className="rdm-boss-eyebrow" style={{ marginTop: 10 }}>Semaine 1 · Boss coopératif</span>
          <h1 className="rdm-boss-name">Le Rorqual colossal</h1>
          <div className="rdm-chips">
            <MChip mod="rd-chip--week">3 assauts</MChip>
            <MChip>PV <b>300</b></MChip>
            <MChip mod="rd-chip--lives"><Lives n={3} /></MChip>
            <MChip>⏱ <b>5:00</b></MChip>
          </div>
        </div>
      </div>

      <div className="rdm-seg">
        <button className="rdm-seg-btn is-on" type="button">🎭 Rôles</button>
        <button className="rdm-seg-btn" type="button">💬 Chat <span className="rdm-seg-badge">3</span></button>
      </div>
      <p className="rdm-intro" style={{ paddingTop: 10 }}>Chacun a un <b>rôle secret</b> : personne ne voit tout, il faut <b>se parler</b>. Couvrez les 3 rôles.</p>

      <div className="rdm-roles">
        {['oeil', 'main', 'capitaine'].map((key) => {
          const r = RAID_ROLES[key];
          const holder = M_LOBBY_ROSTER[key];
          const mine = holder && holder.me;
          return (
            <div key={key} className={`rdm-role${mine ? ' rdm-role--mine' : ''}`}>
              {mine && <span className="rdm-mineflag">Ton rôle</span>}
              <span className="rdm-role-emoji">{r.emoji}</span>
              <div className="rdm-role-mid">
                <span className="rdm-role-name">{r.label}</span>
                <div className="rdm-role-pills">
                  {M_PILLS[key].map((p, i) => <span key={i} className={`rdm-rp rdm-rp--${p.k}`}>{p.t}</span>)}
                </div>
              </div>
              <div className="rdm-role-right">
                {holder ? (
                  <>
                    <span className="rdm-role-av" style={{ background: mine ? 'var(--teal)' : hueColor(holder.pseudo) }}>{holder.pseudo[0].toUpperCase()}</span>
                    <span className="rdm-role-who">{mine ? 'Toi' : holder.pseudo}</span>
                    {holder.ready && <span className="rdm-role-ready">✓ prêt</span>}
                  </>
                ) : (
                  <span className="rdm-role-take"><span className="plus">＋</span><span>Prendre</span></span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rdm-ready">
        <MDS.Button variant="primary">✓ Je suis prêt</MDS.Button>
        <div className="rdm-ready-meta">
          <span className="rdm-ready-status">Il reste <b>la Main</b> à couvrir</span>
          <span className="rdm-ready-dots"><i className="on" /><i className="on" /><i /></span>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// COMBAT — Plateau
// ════════════════════════════════════════════════════════════════════
function MCombatHeader({ fx }) {
  return (
    <div className="rd-stage rdm-stage" data-vignette="false" style={{ '--fx': fx, paddingTop: 14 }}>
      <StageBg />
      <div style={{ position: 'relative', zIndex: 2, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: '0 0 auto' }}><Boss emoji="🐋" combat impact={false} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="rdm-bossbar-name" style={{ fontSize: 17 }}>Le Rorqual colossal</div>
            <div className="rdm-chips" style={{ justifyContent: 'flex-start', marginTop: 8 }}>
              <MChip mod="rd-chip--week">Assaut <b>2/3</b></MChip>
              <MChip mod="rd-chip--timer is-low">⏱ <b>0:24</b></MChip>
              <MChip mod="rd-chip--lives"><Lives n={2} /></MChip>
            </div>
          </div>
        </div>
        <HpBar hp={130} max={300} />
        <MCrewStrip members={M_CREW} />
      </div>
    </div>
  );
}

function MCombatBoard({ fx = 0.3, shards = true }) {
  const { PuzzleBoard, Button } = MDS;
  return (
    <div className="rdm">
      <div className="rdm-safe" />
      <MAppbar />
      <MCombatHeader fx={fx} />

      <div className="rdm-seg">
        <button className="rdm-seg-btn is-on" type="button">🧩 Plateau</button>
        <button className="rdm-seg-btn" type="button">💬 Chat <span className="rdm-seg-badge">3</span></button>
      </div>

      <div className="rdm-lens">
        <span className="rdm-lens-emoji">🧭</span>
        <span className="rdm-lens-txt">
          <span className="rdm-lens-role">Tu joues : <span>Capitaine</span></span>
          <span className="rdm-lens-desc">Tu vois les couleurs · valide & sonar</span>
        </span>
      </div>

      <div className="rdm-board">
        <PuzzleBoard size={64} clues={M_BOARD.clues} placements={M_BOARD.placements} style={{ '--clue-rail': '44px' }} />
      </div>

      <div className="rdm-actions">
        <Button variant="primary">✓ Valider l’essai</Button>
        <div className="rdm-sonar">
          <span className="rdm-sonar-label">🔍 Sonar (1×) — sonde une carte</span>
          <button className="rdm-sonar-btn" type="button">↖ N-O</button>
          <button className="rdm-sonar-btn" type="button">↗ N-E</button>
          <button className="rdm-sonar-btn" type="button">↙ S-O</button>
          <button className="rdm-sonar-btn" type="button">↘ S-E</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// COMBAT — Chat
// ════════════════════════════════════════════════════════════════════
function MCombatChat({ fx = 0.3 }) {
  return (
    <div className="rdm">
      <div className="rdm-safe" />
      <MAppbar />
      <div className="rd-stage rdm-bossbar" style={{ '--fx': fx }}>
        <StageBg />
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
          <div style={{ flex: '0 0 auto' }}><Boss emoji="🐋" /></div>
          <span className="rdm-bossbar-txt">
            <span className="rdm-bossbar-name">Le Rorqual colossal</span>
            <span className="rdm-bossbar-sub">130 / 300 PV · Assaut 2/3</span>
          </span>
          <MChip mod="rd-chip--timer is-low">⏱ 0:24</MChip>
        </div>
      </div>

      <div className="rdm-seg">
        <button className="rdm-seg-btn" type="button">🧩 Plateau</button>
        <button className="rdm-seg-btn is-on" type="button">💬 Chat</button>
      </div>

      <div className="rdm-chatwrap">
        <Chat messages={M_CHAT} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// CINÉMATIQUE — victoire
// ════════════════════════════════════════════════════════════════════
function MCinematic({ fx = 0.3 }) {
  const { Button } = MDS;
  return (
    <div className="rdm rd-stage rd-stage--end rd-end--won" data-vignette="true" style={{ '--fx': fx }}>
      <StageBg />
      <div className="rdm-end">
        <Boss emoji="🐋" combat impact />
        <span className="rdm-end-badge">⚔️ Victoire d’équipage</span>
        <h1 className="rdm-end-title">Le Rorqual<br />est vaincu !</h1>
        <p className="rdm-end-sub">L’équipage a tenu bon. La bête replonge dans les abysses…</p>
        <div className="rdm-end-crew">
          {M_CREW.map((m, i) => (
            <span key={m.pseudo} className="rdm-crew-av" style={{ background: m.me ? 'var(--teal)' : hueColor(m.pseudo, i) }}>
              {m.pseudo[0].toUpperCase()}
              <span className="rdm-crew-emoji">{RAID_ROLES[m.role].emoji}</span>
            </span>
          ))}
        </div>
        <Button variant="primary" size="lg">Voir le résultat →</Button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// RÉSULTAT — victoire / défaite
// ════════════════════════════════════════════════════════════════════
function MResult({ won = true }) {
  const { Button, XPGauge } = MDS;
  return (
    <div className="rdm">
      <div className="rdm-safe" />
      <MAppbar />
      <div className={`rdm-result ${won ? 'rdm-result--won' : 'rdm-result--lost'}`}>
        <div className="rdm-result-top">
          {won && <span className="rdm-result-badge">⚔️ Victoire d’équipage</span>}
          <span className="rdm-result-emoji">{won ? '🏆' : '🌑'}</span>
          <h1 className="rdm-result-title">{won ? 'Le Rorqual est terrassé !' : 'Le Rorqual a replongé…'}</h1>
          <p className="rdm-result-sub">{won ? 'Votre équipage a vaincu le boss de la semaine.' : 'L’équipage est tombé. La mer offre une seconde chance.'}</p>
        </div>

        <div className="rdm-stats">
          {won ? (
            <>
              <div className="rdm-stat"><span className="rdm-stat-label">Temps</span><span className="rdm-stat-val">4:12</span></div>
              <div className="rdm-stat rdm-stat--gold"><span className="rdm-stat-label">Classement</span><span className="rdm-stat-val">🥇 1ᵉʳ</span><span className="rdm-stat-hint">sur 7</span></div>
              <div className="rdm-stat"><span className="rdm-stat-label">XP collectif</span><span className="rdm-stat-val">+2 400</span></div>
            </>
          ) : (
            <>
              <div className="rdm-stat"><span className="rdm-stat-label">Assauts</span><span className="rdm-stat-val">2/3</span></div>
              <div className="rdm-stat rdm-stat--record"><span className="rdm-stat-label">Record</span><span className="rdm-stat-val">3:48</span><span className="rdm-stat-hint">à battre</span></div>
              <div className="rdm-stat"><span className="rdm-stat-label">Boss restant</span><span className="rdm-stat-val">130</span><span className="rdm-stat-hint">PV</span></div>
            </>
          )}
        </div>

        {won && (
          <div className="rd-panel">
            <XPGauge mascot={<span>🦈</span>} eyebrow="Communauté" level="Niveau 7 — Chasseur" xp="9 240 XP" pct={68} nextLabel="Léviathan dans 3 760 XP" />
          </div>
        )}

        <div className="rdm-result-crew">
          {M_CREW.map((m, i) => (
            <span key={m.pseudo} className="rd-res-member">
              <span className="rd-holder-av" style={{ background: m.me ? 'var(--teal)' : hueColor(m.pseudo, i) }}>
                {m.pseudo[0].toUpperCase()}
                <span className="rd-res-mrole">{RAID_ROLES[m.role].emoji}</span>
              </span>
              <span className="rd-res-mname">{m.me ? 'Toi' : m.pseudo}</span>
            </span>
          ))}
        </div>

        <div className="rdm-result-actions">
          <Button variant="primary">{won ? 'Rejouer' : '⚔️ La revanche'}</Button>
          <Button variant="secondary">Partager</Button>
          <Button variant="ghost">Retour au hub</Button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// LOBBY — onglet Chat (salon d'équipage)
// ════════════════════════════════════════════════════════════════════
function MLobbyChat({ fx = 0.3 }) {
  return (
    <div className="rdm">
      <div className="rdm-safe" />
      <MAppbar />
      <div className="rd-stage rdm-bossbar" style={{ '--fx': fx }}>
        <StageBg />
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
          <div style={{ flex: '0 0 auto' }}><Boss emoji="🐋" /></div>
          <span className="rdm-bossbar-txt">
            <span className="rdm-bossbar-name">Le Rorqual colossal</span>
            <span className="rdm-bossbar-sub">Salle d’attente · Semaine 1</span>
          </span>
          <MChip mod="rd-chip--lives">👥 2/3</MChip>
        </div>
      </div>

      <div className="rdm-seg">
        <button className="rdm-seg-btn" type="button">🎭 Rôles</button>
        <button className="rdm-seg-btn is-on" type="button">💬 Chat</button>
      </div>

      <div className="rdm-chatwrap">
        <Chat messages={M_LOBBY_CHAT} />
      </div>
    </div>
  );
}

Object.assign(window, { MLobby, MLobbyChat, MCombatBoard, MCombatChat, MCinematic, MResult });
