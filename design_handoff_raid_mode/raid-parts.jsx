// raid-parts.jsx — composants partagés du redesign RAID.
// Tout est rendu via React (window.React) ; les composants du design system
// Orienta sont lus sur window.OrientaDesignSystem_50c4c1 au moment du rendu.
// Exporté sur window pour les autres scripts Babel (raid-screens, main).

const { useMemo } = React;

// ── Données de rôles (« organes ») — palier 3 du lobby ───────────────
// Chaque rôle contraste ce qu'il VOIT et ce qu'il FAIT → rend l'info
// asymétrique immédiatement lisible (cœur de l'amélioration UX).
const RAID_ROLES = {
  oeil: {
    key: 'oeil', label: 'Œil', emoji: '🔭', color: 'var(--blue)',
    tagline: 'Les yeux de l’équipage',
    powers: [
      { kind: 'see', text: 'Tu vois les **indices** et les **mots** des cartes.' },
      { kind: 'do',  text: 'Tu **dictes** à la Main quoi poser et comment tourner.' },
    ],
  },
  main: {
    key: 'main', label: 'Main', emoji: '✋', color: 'var(--green)',
    tagline: 'Les mains qui agissent',
    powers: [
      { kind: 'blind', text: 'Tu ne vois **ni indices ni mots**.' },
      { kind: 'do',    text: 'Toi seul **places** et **tournes** les cartes.' },
    ],
  },
  capitaine: {
    key: 'capitaine', label: 'Capitaine', emoji: '🧭', color: 'var(--orange)',
    tagline: 'La voix qui tranche',
    powers: [
      { kind: 'see', text: 'Tu vois les **couleurs** après chaque essai.' },
      { kind: 'do',  text: 'Toi seul **valides** l’essai. **Sonar** : sonde 1 carte/assaut.' },
    ],
  },
};

// Couleur d'avatar stable à partir d'un pseudo (teintes chaleureuses).
const PALETTE = ['var(--blue)', 'var(--green)', 'var(--orange)', 'var(--violet)', 'var(--coral)', 'var(--teal)'];
function hueColor(name, i) {
  if (i != null) return PALETTE[i % PALETTE.length];
  let h = 0; for (let k = 0; k < (name || '').length; k++) h = (h * 31 + name.charCodeAt(k)) % PALETTE.length;
  return PALETTE[h];
}

// Petit utilitaire : transforme « **gras** » en <b>gras</b>.
function richText(s) {
  const out = []; const parts = String(s).split(/\*\*(.+?)\*\*/g);
  parts.forEach((p, i) => out.push(i % 2 ? <b key={i}>{p}</b> : p));
  return out;
}

// ── Topbar ───────────────────────────────────────────────────────────
function Topbar({ online = 6, right }) {
  return (
    <header className="rd-topbar">
      <div className="rd-topbar-in">
        <div className="rd-brand">
          <img src="assets/logo-icon.svg" alt="Orienta" />
          <span>Orienta</span>
        </div>
        <span className="rd-mode-badge">⚔️ Raid</span>
        <span className="rd-topbar-spacer" />
        {right || (
          <>
            <span className="rd-onlinepill"><i />{online} en mer</span>
            <button className="rd-leave" type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              Quitter
            </button>
          </>
        )}
      </div>
    </header>
  );
}

// ── Décor de scène (couches d'ambiance) ──────────────────────────────
const BUBBLES = [
  { l: 8, s: 10, d: 9, delay: 0 }, { l: 17, s: 6, d: 12, delay: 3 },
  { l: 26, s: 14, d: 8, delay: 1.5 }, { l: 38, s: 7, d: 11, delay: 5 },
  { l: 47, s: 5, d: 13, delay: 2 }, { l: 58, s: 11, d: 9, delay: 4 },
  { l: 67, s: 8, d: 10, delay: 0.8 }, { l: 76, s: 6, d: 12, delay: 6 },
  { l: 85, s: 13, d: 8, delay: 2.6 }, { l: 92, s: 7, d: 11, delay: 4.5 },
  { l: 32, s: 5, d: 14, delay: 7 }, { l: 71, s: 9, d: 9, delay: 1 },
];
function StageBg() {
  return (
    <>
      <div className="rd-stage-grid" />
      <div className="rd-stage-glow" />
      <div className="rd-bubbles">
        {BUBBLES.map((b, i) => (
          <span key={i} className="rd-bubble" style={{
            left: b.l + '%', width: b.s, height: b.s,
            animationDuration: b.d + 's', animationDelay: b.delay + 's',
          }} />
        ))}
      </div>
    </>
  );
}

// ── Boss ─────────────────────────────────────────────────────────────
function Boss({ emoji = '🐋', combat = false, impact = false }) {
  // 8 éclats répartis en cercle, longueur pilotée par --fx.
  const shards = Array.from({ length: 8 }, (_, i) => i * 45);
  return (
    <div className="rd-boss">
      {combat && (
        <div className="rd-boss-rings" aria-hidden="true">
          <span /><span /><span />
        </div>
      )}
      <div className="rd-boss-disc">
        <span className="rd-boss-emoji">{emoji}</span>
      </div>
      {combat && impact && (
        <div className="rd-impact" aria-hidden="true">
          <span className="rd-impact-ring" />
          {shards.map((a) => (
            <span key={a} className="rd-shard" style={{
              transform: `rotate(${a}deg) translateY(calc(-78px - 60px * var(--fx)))`,
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Barre de PV ──────────────────────────────────────────────────────
function HpBar({ hp, max }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((hp / max) * 100))) : 0;
  return (
    <div className="rd-hp">
      <div className="rd-hp-row">
        <span className="rd-hp-name">Points de vie</span>
        <span className="rd-hp-val">{hp} / {max} PV</span>
      </div>
      <div className="rd-hp-track">
        <div className="rd-hp-fill" style={{ width: pct + '%' }} />
      </div>
    </div>
  );
}

function Lives({ n }) {
  return <>{'🛟'.repeat(Math.max(0, n)) || '—'}</>;
}

// ── Rail d'équipage (combat) ─────────────────────────────────────────
function CrewRail({ members }) {
  return (
    <div className="rd-crew">
      <div className="rd-crew-title">Équipage · {members.length}</div>
      {members.map((m, i) => {
        const r = RAID_ROLES[m.role];
        return (
          <div key={m.pseudo} className={`rd-crew-member${m.speaking ? ' is-speaking' : ''}`}>
            <span className="rd-crew-av" style={{ background: m.me ? 'var(--teal)' : hueColor(m.pseudo, i) }}>
              {m.pseudo[0].toUpperCase()}
              <span className="rd-crew-role-emoji">{r?.emoji}</span>
            </span>
            <span className="rd-crew-info">
              <span className="rd-crew-name">{m.me ? 'Toi' : m.pseudo}</span>
              <span className="rd-crew-role">{r?.label}</span>
            </span>
            {m.speaking && <span className="rd-crew-wave">💬</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── Lentille de rôle (combat) — « tu joues : Capitaine » ─────────────
function RoleLens({ role }) {
  const r = RAID_ROLES[role];
  return (
    <div className="rd-lens">
      <span className="rd-lens-emoji">{r.emoji}</span>
      <span className="rd-lens-txt">
        <span className="rd-lens-role">Tu joues : <span>{r.label}</span></span>
        <span className="rd-lens-desc">{r.tagline} — vois les couleurs, valide l’essai, lance le sonar.</span>
      </span>
      <span className="rd-lens-tags">
        <span className="rd-power-key rd-pk-see">👁 Couleurs</span>
        <span className="rd-power-key rd-pk-do">✓ Valide · 🔍 Sonar</span>
      </span>
    </div>
  );
}

// Petits styles pour les tags de la lentille (réutilise les couleurs powers).
if (typeof document !== 'undefined' && !document.getElementById('rd-lens-pk')) {
  const s = document.createElement('style'); s.id = 'rd-lens-pk';
  s.textContent = '.rd-lens .rd-pk-see{color:var(--blue);background:var(--blue-soft)}.rd-lens .rd-pk-do{color:var(--teal-700);background:#fff}';
  document.head.appendChild(s);
}

// ── Chat ─────────────────────────────────────────────────────────────
const ROLE_TAG_STYLE = {
  oeil:      { color: 'var(--blue)',     background: 'var(--blue-soft)' },
  main:      { color: 'var(--green)',    background: 'var(--green-soft)' },
  capitaine: { color: 'var(--orange)',   background: 'var(--orange-soft)' },
};
function Chat({ messages, compact = false }) {
  return (
    <div className="rd-chat">
      <div className="rd-chat-head">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
        <span className="rd-panel-title">Coordination</span>
        <span className="rd-online"><i />temps réel</span>
      </div>
      <div className="rd-chat-msgs">
        {messages.map((m, i) => {
          if (m.sys) return <div key={i} className="rd-msg-sys">{m.sys}</div>;
          const r = RAID_ROLES[m.role];
          const tag = ROLE_TAG_STYLE[m.role] || {};
          return (
            <div key={i} className={`rd-msg${m.me ? ' is-me' : ''}`}>
              {!m.me && (
                <span className="rd-msg-av" style={{ background: hueColor(m.pseudo) }}>{m.pseudo[0].toUpperCase()}</span>
              )}
              <div className="rd-msg-main">
                {!m.me && (
                  <div className="rd-msg-meta">
                    <span className="rd-msg-who">{m.pseudo}</span>
                    <span className="rd-msg-role" style={tag}>{r?.emoji} {r?.label}</span>
                  </div>
                )}
                <div className="rd-msg-bubble">{m.text}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="rd-chat-input">
        <input className="o-input" placeholder="Écris à l’équipage…" readOnly />
        <button className="rd-chat-send" type="button" aria-label="Envoyer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
        </button>
      </div>
    </div>
  );
}

Object.assign(window, {
  RAID_ROLES, hueColor, richText,
  Topbar, StageBg, Boss, HpBar, Lives, CrewRail, RoleLens, Chat,
});
