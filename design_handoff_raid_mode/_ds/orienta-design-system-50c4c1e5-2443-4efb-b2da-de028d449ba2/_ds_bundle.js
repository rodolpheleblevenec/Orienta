/* @ds-bundle: {"format":3,"namespace":"OrientaDesignSystem_50c4c1","components":[{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"StatPill","sourcePath":"components/core/StatPill.jsx"},{"name":"TextField","sourcePath":"components/core/TextField.jsx"},{"name":"SectionKicker","sourcePath":"components/feedback/SectionKicker.jsx"},{"name":"XPGauge","sourcePath":"components/feedback/XPGauge.jsx"},{"name":"PuzzleBoard","sourcePath":"components/game/PuzzleBoard.jsx"},{"name":"CARD_COLORS","sourcePath":"components/game/WordCard.jsx"},{"name":"WordCard","sourcePath":"components/game/WordCard.jsx"}],"sourceHashes":{"components/core/Avatar.jsx":"2ca89c694494","components/core/Badge.jsx":"c96834d7e0c2","components/core/Button.jsx":"88c7ae9021df","components/core/Card.jsx":"f555f9da6a40","components/core/IconButton.jsx":"1c18b605661d","components/core/StatPill.jsx":"27904cf1c4be","components/core/TextField.jsx":"84aa0f9ae3fb","components/feedback/SectionKicker.jsx":"c1ddab73e872","components/feedback/XPGauge.jsx":"ff87ac0fef79","components/game/PuzzleBoard.jsx":"b507cf974397","components/game/WordCard.jsx":"2de9e690fe06","ui_kits/orienta_app/app.jsx":"7d122c75d8a9","ui_kits/orienta_app/icons.jsx":"24e79f3d54aa","ui_kits/orienta_app/screens.jsx":"98203b097edb"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.OrientaDesignSystem_50c4c1 = window.OrientaDesignSystem_50c4c1 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SIZES = {
  sm: 28,
  md: 32,
  lg: 40,
  xl: 56
};

/**
 * Round (or rounded-square) avatar. Shows an image, an emoji skin, or an
 * initial on a solid colour.
 */
function Avatar({
  size = 'md',
  src,
  emoji,
  initial,
  color,
  shape = 'circle',
  className = '',
  style,
  ...props
}) {
  const px = typeof size === 'number' ? size : SIZES[size] || 32;
  const variant = emoji ? 'o-avatar--emoji' : '';
  const shapeClass = shape === 'square' ? 'o-avatar--square' : '';
  const fontSize = emoji ? px * 0.62 : px * 0.42;
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ['o-avatar', variant, shapeClass, className].filter(Boolean).join(' '),
    style: {
      width: px,
      height: px,
      fontSize,
      ...(color && !src && !emoji ? {
        background: color
      } : null),
      ...style
    }
  }, props), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: ""
  }) : emoji ? emoji : initial || '?');
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Small status badge. Tone maps to Orienta's semantic tints. */
function Badge({
  tone = 'neutral',
  className = '',
  children,
  ...props
}) {
  const toneClass = tone === 'neutral' ? '' : `o-badge--${tone}`;
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ['o-badge', toneClass, className].filter(Boolean).join(' ')
  }, props), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Orienta primary action. A teal pill in the display face by default;
 * `secondary` (outlined) and `ghost` (bare) are quieter variants.
 */
function Button({
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  as = 'button',
  className = '',
  children,
  ...props
}) {
  const Tag = as;
  const classes = ['o-btn', `o-btn--${variant}`, size === 'sm' ? 'o-btn--sm' : size === 'lg' ? 'o-btn--lg' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: classes
  }, props), iconLeft, children != null && /*#__PURE__*/React.createElement("span", null, children), iconRight);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Rounded surface container. `interactive` adds the lift-on-hover behaviour. */
function Card({
  elevation = 'sm',
  interactive = false,
  as = 'div',
  className = '',
  children,
  ...props
}) {
  const Tag = as;
  const classes = ['o-card', elevation === 'flat' ? 'o-card--flat' : elevation === 'raised' ? 'o-card--raised' : '', interactive ? 'o-card--interactive' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: classes
  }, props), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Square, tinted-on-hover icon button. Optional notification badge. */
function IconButton({
  active = false,
  badge,
  className = '',
  children,
  ...props
}) {
  const classes = ['o-iconbtn', active ? 'o-iconbtn--active' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("button", _extends({
    className: classes
  }, props), children, badge != null && badge !== false && /*#__PURE__*/React.createElement("span", {
    className: "o-iconbtn-badge"
  }, badge));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/StatPill.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Header currency / streak chip — display face, fully round, tinted by meaning.
 * Renders as a button by default; pass `static` for a non-interactive chip.
 */
function StatPill({
  tone = 'neutral',
  icon,
  value,
  static: isStatic = false,
  className = '',
  children,
  ...props
}) {
  const toneClass = tone === 'neutral' ? '' : `o-pill--${tone}`;
  const classes = ['o-pill', toneClass, isStatic ? 'o-pill--static' : '', className].filter(Boolean).join(' ');
  const Tag = isStatic ? 'span' : 'button';
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: classes
  }, props), icon, /*#__PURE__*/React.createElement("span", null, value ?? children));
}
Object.assign(__ds_scope, { StatPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatPill.jsx", error: String((e && e.message) || e) }); }

// components/core/TextField.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
let _id = 0;

/** Labelled text input with optional uppercase label, hint, and error state. */
function TextField({
  label,
  hint,
  error = false,
  errorText,
  id,
  className = '',
  ...props
}) {
  const inputId = id || `o-field-${++_id}`;
  const showError = error || !!errorText;
  return /*#__PURE__*/React.createElement("div", {
    className: "o-field"
  }, label && /*#__PURE__*/React.createElement("label", {
    className: "o-field-label",
    htmlFor: inputId
  }, label), /*#__PURE__*/React.createElement("input", _extends({
    id: inputId,
    className: ['o-input', showError ? 'o-input--error' : '', className].filter(Boolean).join(' ')
  }, props)), (hint || errorText) && /*#__PURE__*/React.createElement("span", {
    className: ['o-field-hint', showError ? 'o-field-hint--error' : ''].filter(Boolean).join(' ')
  }, errorText || hint));
}
Object.assign(__ds_scope, { TextField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/TextField.jsx", error: String((e && e.message) || e) }); }

// components/feedback/SectionKicker.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Numbered section heading: "01 — La grille du jour" with a trailing rule. */
function SectionKicker({
  num,
  children,
  trailing,
  className = '',
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['o-kicker', className].filter(Boolean).join(' ')
  }, props), /*#__PURE__*/React.createElement("span", {
    className: "o-kicker-label"
  }, num != null && /*#__PURE__*/React.createElement("span", {
    className: "o-kicker-num"
  }, num), children), /*#__PURE__*/React.createElement("span", {
    className: "o-kicker-rule"
  }), trailing);
}
Object.assign(__ds_scope, { SectionKicker });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/SectionKicker.jsx", error: String((e && e.message) || e) }); }

// components/feedback/XPGauge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Collective / individual XP progress card: a mascot, the current level,
 * a thin teal-filling track, and the gap to the next level.
 */
function XPGauge({
  mascot,
  eyebrow = 'Communauté',
  level,
  xp,
  pct = 0,
  nextLabel,
  onClick,
  className = '',
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['o-gauge', className].filter(Boolean).join(' '),
    onClick: onClick,
    role: onClick ? 'button' : undefined
  }, props), /*#__PURE__*/React.createElement("div", {
    className: "o-gauge-head"
  }, mascot != null && /*#__PURE__*/React.createElement("div", {
    className: "o-gauge-mascot"
  }, mascot), /*#__PURE__*/React.createElement("div", {
    className: "o-gauge-info"
  }, eyebrow && /*#__PURE__*/React.createElement("span", {
    className: "o-gauge-eyebrow"
  }, eyebrow), level && /*#__PURE__*/React.createElement("span", {
    className: "o-gauge-level"
  }, level), xp && /*#__PURE__*/React.createElement("span", {
    className: "o-gauge-xp"
  }, xp)), onClick && /*#__PURE__*/React.createElement("span", {
    className: "o-gauge-chevron"
  }, "\u203A")), /*#__PURE__*/React.createElement("div", {
    className: "o-gauge-track"
  }, /*#__PURE__*/React.createElement("div", {
    className: "o-gauge-fill",
    style: {
      width: `${Math.max(0, Math.min(100, pct))}%`
    }
  })), nextLabel && /*#__PURE__*/React.createElement("div", {
    className: "o-gauge-next"
  }, nextLabel));
}
Object.assign(__ds_scope, { XPGauge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/XPGauge.jsx", error: String((e && e.message) || e) }); }

// components/game/WordCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Orienta's five fixed card identities. White fill; border + text carry colour. */
const CARD_COLORS = [{
  id: 'green',
  border: '#16a085',
  text: '#16a085'
}, {
  id: 'coral',
  border: '#f2603f',
  text: '#f2603f'
}, {
  id: 'orange',
  border: '#e8920e',
  text: '#e8920e'
}, {
  id: 'blue',
  border: '#2f6fd6',
  text: '#2f6fd6'
}, {
  id: 'violet',
  border: '#7030E0',
  text: '#7030E0'
}];
const POSITIONS = ['top', 'right', 'bottom', 'left'];

/**
 * A single puzzle card. Four words pinned to the edges; the whole card
 * rotates by `rotation`° while each word counter-rotates to stay readable
 * (the exact production formula). Feedback adds the Mastermind glow.
 */
function WordCard({
  words,
  rotation = 0,
  colorIndex = 0,
  feedback = 'neutral',
  size = 150,
  hoverable = false,
  className = '',
  style,
  ...props
}) {
  const color = CARD_COLORS[(colorIndex % CARD_COLORS.length + CARD_COLORS.length) % CARD_COLORS.length];
  function wordStyle(pos) {
    const physIdx = (POSITIONS.indexOf(pos) + rotation / 90) % 4;
    const isVertical = physIdx % 2 === 1;
    const deg = isVertical ? -90 - rotation : -rotation;
    return {
      transform: `rotate(${deg}deg)`,
      color: color.text
    };
  }
  const fb = feedback !== 'neutral' ? `o-wordcard--${feedback}` : '';
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['o-wordcard', hoverable ? 'o-wordcard--hoverable' : '', fb, className].filter(Boolean).join(' '),
    style: {
      '--slot-size': `${size}px`,
      transform: `rotate(${rotation}deg)`,
      transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      ...(feedback === 'neutral' ? {
        borderColor: color.border
      } : null),
      ...style
    }
  }, props), /*#__PURE__*/React.createElement("span", {
    className: "o-wordcard-chip",
    style: {
      background: color.border
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "o-wordcard-word o-wordcard-word--top",
    style: wordStyle('top')
  }, words?.top), /*#__PURE__*/React.createElement("span", {
    className: "o-wordcard-word o-wordcard-word--right",
    style: wordStyle('right')
  }, words?.right), /*#__PURE__*/React.createElement("span", {
    className: "o-wordcard-word o-wordcard-word--bottom",
    style: wordStyle('bottom')
  }, words?.bottom), /*#__PURE__*/React.createElement("span", {
    className: "o-wordcard-word o-wordcard-word--left",
    style: wordStyle('left')
  }, words?.left));
}
Object.assign(__ds_scope, { CARD_COLORS, WordCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/game/WordCard.jsx", error: String((e && e.message) || e) }); }

// components/game/PuzzleBoard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * The 2×2 puzzle board: four cards with a clue rail on each side. Pass
 * `placements` (4 cards, reading order: top-left, top-right, bottom-left,
 * bottom-right) and the four directional `clues`.
 */
function PuzzleBoard({
  placements = [],
  clues = {},
  size = 130,
  className = '',
  style,
  ...props
}) {
  const railH = Math.round(size * 0.42);
  const railW = Math.round(size * 0.56);
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['o-board', className].filter(Boolean).join(' '),
    style: {
      '--slot-size': `${size}px`,
      '--clue-rail': `${railW}px`,
      ...style
    }
  }, props), /*#__PURE__*/React.createElement(Clue, {
    side: "top",
    text: clues.top
  }), /*#__PURE__*/React.createElement(Clue, {
    side: "left",
    text: clues.left
  }), /*#__PURE__*/React.createElement("div", {
    className: "o-board-grid"
  }, [0, 1, 2, 3].map(i => {
    const p = placements[i];
    return p ? /*#__PURE__*/React.createElement(__ds_scope.WordCard, {
      key: i,
      words: p.words,
      rotation: p.rotation ?? 0,
      colorIndex: p.colorIndex ?? i,
      feedback: p.feedback ?? 'neutral',
      size: size
    }) : /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        width: size,
        height: size,
        borderRadius: 18,
        border: '2px dashed rgba(28,33,40,0.15)',
        background: 'rgba(255,255,255,0.55)'
      }
    });
  })), /*#__PURE__*/React.createElement(Clue, {
    side: "right",
    text: clues.right
  }), /*#__PURE__*/React.createElement(Clue, {
    side: "bottom",
    text: clues.bottom
  }));
}
function Clue({
  side,
  text
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `o-clue o-clue--${side}${text ? '' : ' o-clue--empty'}`
  }, text || '?');
}
Object.assign(__ds_scope, { PuzzleBoard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/game/PuzzleBoard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/orienta_app/app.jsx
try { (() => {
/* DS components are read inside each component body so this file is safe to
   evaluate before the bundle loads; the first render is gated below. */
const {
  Topbar: OTopbar,
  LoginScreen,
  HubScreen,
  CLUES: O_CLUES,
  CARDS: O_CARDS
} = window.OrientaScreens;
const {
  IArrow: A2,
  IRotate: Rot
} = window;

/* ── Play ──────────────────────────────────────────────────── */
function PlayScreen({
  pseudo,
  onFinish,
  onNav,
  onLogout
}) {
  const {
    Button: OBtn,
    Badge: OBadge,
    WordCard: OWordCard
  } = window.OrientaDesignSystem_50c4c1;
  const [placements, setPlacements] = React.useState([null, null, null, null]); // {cardId, rotation}
  const [trayIds, setTrayIds] = React.useState([0, 1, 2, 3]);
  const [selected, setSelected] = React.useState(null);
  const cardById = id => O_CARDS.find(c => c.id === id);
  const allPlaced = placements.every(Boolean);
  function placeAt(slot) {
    if (selected == null || placements[slot]) return;
    setPlacements(p => p.map((v, i) => i === slot ? {
      cardId: selected,
      rotation: 0
    } : v));
    setTrayIds(t => t.filter(id => id !== selected));
    setSelected(null);
  }
  function rotateSlot(slot, e) {
    e.stopPropagation();
    setPlacements(p => p.map((v, i) => i === slot ? {
      ...v,
      rotation: (v.rotation + 90) % 360
    } : v));
  }
  function reset() {
    setPlacements([null, null, null, null]);
    setTrayIds([0, 1, 2, 3]);
    setSelected(null);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "screen"
  }, /*#__PURE__*/React.createElement(OTopbar, {
    pseudo: pseudo,
    onNav: onNav,
    onLogout: onLogout
  }), /*#__PURE__*/React.createElement("main", {
    className: "main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "play-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "play-head"
  }, /*#__PURE__*/React.createElement("h1", {
    className: "play-title"
  }, "Place et oriente les cartes"), /*#__PURE__*/React.createElement("p", {
    className: "play-sub"
  }, "Glisse chaque carte au bon endroit, bien tourn\xE9e, pour coller aux indices."), /*#__PURE__*/React.createElement("div", {
    className: "play-meta"
  }, /*#__PURE__*/React.createElement(OBadge, {
    tone: "neutral"
  }, "Essai 1 / 3"), /*#__PURE__*/React.createElement(OBadge, {
    tone: "success"
  }, "\u23F1 00:42"), /*#__PURE__*/React.createElement(OBadge, {
    tone: "warning"
  }, "Moyen"))), /*#__PURE__*/React.createElement("div", {
    className: "o-board",
    style: {
      '--slot-size': '130px',
      '--clue-rail': '74px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "o-clue o-clue--top"
  }, O_CLUES.top), /*#__PURE__*/React.createElement("div", {
    className: "o-clue o-clue--left"
  }, O_CLUES.left), /*#__PURE__*/React.createElement("div", {
    className: "o-board-grid"
  }, [0, 1, 2, 3].map(slot => {
    const p = placements[slot];
    if (!p) return /*#__PURE__*/React.createElement("div", {
      key: slot,
      className: "slot-empty",
      onClick: () => placeAt(slot)
    }, selected != null ? '＋' : '·');
    const card = cardById(p.cardId);
    return /*#__PURE__*/React.createElement("div", {
      key: slot,
      className: "card-pick",
      onClick: e => rotateSlot(slot, e),
      title: "Cliquer pour tourner"
    }, /*#__PURE__*/React.createElement(OWordCard, {
      words: card.words,
      colorIndex: card.colorIndex,
      rotation: p.rotation,
      size: 130,
      hoverable: true
    }), /*#__PURE__*/React.createElement("span", {
      className: "rotate-hint"
    }, "\u21BB tourner"));
  })), /*#__PURE__*/React.createElement("div", {
    className: "o-clue o-clue--right"
  }, O_CLUES.right), /*#__PURE__*/React.createElement("div", {
    className: "o-clue o-clue--bottom"
  }, O_CLUES.bottom)), /*#__PURE__*/React.createElement("div", {
    className: "tray"
  }, trayIds.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "tray-empty"
  }, "Toutes les cartes sont plac\xE9es \u2014 clique sur une carte pour la tourner, puis valide.") : trayIds.map(id => {
    const card = cardById(id);
    const isSel = selected === id;
    return /*#__PURE__*/React.createElement("div", {
      key: id,
      className: "card-pick",
      onClick: () => setSelected(isSel ? null : id),
      style: {
        outline: isSel ? '2px solid var(--teal)' : 'none',
        outlineOffset: 4,
        borderRadius: 20
      }
    }, /*#__PURE__*/React.createElement(OWordCard, {
      words: card.words,
      colorIndex: card.colorIndex,
      rotation: 0,
      size: 120,
      hoverable: true
    }));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(OBtn, {
    variant: "secondary",
    onClick: reset
  }, "R\xE9initialiser"), /*#__PURE__*/React.createElement(OBtn, {
    variant: "primary",
    iconRight: /*#__PURE__*/React.createElement(A2, null),
    disabled: !allPlaced,
    onClick: () => onFinish({
      placements
    })
  }, "Valider la grille")), selected == null && trayIds.length > 0 && /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--ink-3)',
      fontSize: 13,
      margin: 0
    }
  }, "Astuce : choisis une carte ci-dessus, puis clique un emplacement vide."))));
}

/* ── Result ────────────────────────────────────────────────── */
function ResultScreen({
  pseudo,
  run,
  onReplay,
  onNav,
  onLogout
}) {
  const {
    Button: OBtn,
    Card: OCard,
    PuzzleBoard: OPuzzleBoard
  } = window.OrientaDesignSystem_50c4c1;
  const solved = (run?.placements || [null, null, null, null]).map((p, i) => {
    const card = p ? O_CARDS.find(c => c.id === p.cardId) : O_CARDS[i];
    return {
      words: card.words,
      colorIndex: card.colorIndex,
      rotation: p ? p.rotation : 0,
      feedback: 'correct'
    };
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "screen"
  }, /*#__PURE__*/React.createElement(OTopbar, {
    pseudo: pseudo,
    onNav: onNav,
    onLogout: onLogout
  }), /*#__PURE__*/React.createElement("main", {
    className: "main main--narrow"
  }, /*#__PURE__*/React.createElement("div", {
    className: "result-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "result-emoji"
  }, "\uD83C\uDF89"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: 'var(--ink-3)',
      fontWeight: 600
    }
  }, "Grille r\xE9solue"), /*#__PURE__*/React.createElement("div", {
    className: "result-score"
  }, "760"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--ink-2)',
      fontSize: 14
    }
  }, "points \xB7 joli coup, ", pseudo, " !")), /*#__PURE__*/React.createElement("div", {
    className: "result-grid-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "result-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "result-stat-k"
  }, "Essais"), /*#__PURE__*/React.createElement("div", {
    className: "result-stat-v",
    style: {
      color: 'var(--teal)'
    }
  }, "1 / 3")), /*#__PURE__*/React.createElement("div", {
    className: "result-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "result-stat-k"
  }, "Temps"), /*#__PURE__*/React.createElement("div", {
    className: "result-stat-v"
  }, "00:58")), /*#__PURE__*/React.createElement("div", {
    className: "result-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "result-stat-k"
  }, "XP gagn\xE9"), /*#__PURE__*/React.createElement("div", {
    className: "result-stat-v",
    style: {
      color: 'var(--amber)'
    }
  }, "+31")), /*#__PURE__*/React.createElement("div", {
    className: "result-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "result-stat-k"
  }, "Rang du jour"), /*#__PURE__*/React.createElement("div", {
    className: "result-stat-v"
  }, "#3"))), /*#__PURE__*/React.createElement(OCard, {
    elevation: "raised",
    style: {
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 12,
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: 'var(--ink-3)',
      fontWeight: 600
    }
  }, "La solution"), /*#__PURE__*/React.createElement(OPuzzleBoard, {
    size: 104,
    clues: O_CLUES,
    placements: solved
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(OBtn, {
    variant: "secondary",
    onClick: () => onNav('hub')
  }, "Retour au hub"), /*#__PURE__*/React.createElement(OBtn, {
    variant: "primary",
    iconRight: /*#__PURE__*/React.createElement(A2, null),
    onClick: onReplay
  }, "Rejouer")))));
}

/* ── App shell (state machine) ─────────────────────────────── */
function App() {
  const [route, setRoute] = React.useState('login');
  const [pseudo, setPseudo] = React.useState('');
  const [run, setRun] = React.useState(null);
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);
  if (route === 'login') return /*#__PURE__*/React.createElement(LoginScreen, {
    onLogin: p => {
      setPseudo(p);
      setRoute('hub');
    }
  });
  if (route === 'hub') return /*#__PURE__*/React.createElement(HubScreen, {
    pseudo: pseudo,
    onPlay: () => setRoute('play'),
    onNav: setRoute,
    onLogout: () => setRoute('login')
  });
  if (route === 'play') return /*#__PURE__*/React.createElement(PlayScreen, {
    pseudo: pseudo,
    onFinish: r => {
      setRun(r);
      setRoute('result');
    },
    onNav: setRoute,
    onLogout: () => setRoute('login')
  });
  return /*#__PURE__*/React.createElement(ResultScreen, {
    pseudo: pseudo,
    run: run,
    onReplay: () => setRoute('play'),
    onNav: setRoute,
    onLogout: () => setRoute('login')
  });
}
function boot() {
  if (!window.OrientaDesignSystem_50c4c1 || !window.OrientaScreens) {
    setTimeout(boot, 40);
    return;
  }
  ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
}
boot();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/orienta_app/app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/orienta_app/icons.jsx
try { (() => {
/* Lucide-style inline icons (stroke 2, 24px grid, currentColor) — the Orienta
   icon idiom. Exported to window for the screen components. */
const IPlay = () => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "currentColor",
  width: "18",
  height: "18"
}, /*#__PURE__*/React.createElement("path", {
  d: "M8 5v14l11-7z"
}));
const IArrow = () => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.5",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  width: "18",
  height: "18"
}, /*#__PURE__*/React.createElement("path", {
  d: "M5 12h14"
}), /*#__PURE__*/React.createElement("path", {
  d: "m13 6 6 6-6 6"
}));
const IBell = () => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2"
}, /*#__PURE__*/React.createElement("path", {
  d: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
}), /*#__PURE__*/React.createElement("path", {
  d: "M13.73 21a2 2 0 0 1-3.46 0"
}));
const IFlame = () => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "currentColor"
}, /*#__PURE__*/React.createElement("path", {
  d: "M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"
}));
const ILogout = () => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2"
}, /*#__PURE__*/React.createElement("path", {
  d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
}), /*#__PURE__*/React.createElement("polyline", {
  points: "16 17 21 12 16 7"
}), /*#__PURE__*/React.createElement("line", {
  x1: "21",
  y1: "12",
  x2: "9",
  y2: "12"
}));
const IRotate = () => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M23 4v6h-6"
}), /*#__PURE__*/React.createElement("path", {
  d: "M20.49 15a9 9 0 1 1-2.12-9.36L23 10"
}));
Object.assign(window, {
  IPlay,
  IArrow,
  IBell,
  IFlame,
  ILogout,
  IRotate
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/orienta_app/icons.jsx", error: String((e && e.message) || e) }); }

// ui_kits/orienta_app/screens.jsx
try { (() => {
/* Components are read from window.OrientaDesignSystem_50c4c1 inside each
   component body so the file is safe to evaluate before the DS bundle loads
   (app.jsx gates the first render until the namespace is ready). */
const {
  IPlay,
  IArrow,
  IBell,
  IFlame,
  ILogout,
  IRotate
} = window;

/* ── Demo data ─────────────────────────────────────────────── */
const CLUES = {
  top: "L'OCÉAN",
  right: 'LA CÔTE',
  bottom: 'LE BATEAU',
  left: 'LE TEMPS'
};
const CARDS = [{
  id: 0,
  colorIndex: 0,
  words: {
    top: 'MER',
    right: 'SEL',
    bottom: 'VAGUE',
    left: 'PORT'
  }
}, {
  id: 1,
  colorIndex: 3,
  words: {
    top: 'QUAI',
    right: 'CALE',
    bottom: 'DIGUE',
    left: 'MÔLE'
  }
}, {
  id: 2,
  colorIndex: 2,
  words: {
    top: 'FLOT',
    right: 'ÉCUME',
    bottom: 'HOULE',
    left: 'RIVE'
  }
}, {
  id: 3,
  colorIndex: 1,
  words: {
    top: 'LARGE',
    right: 'CAP',
    bottom: 'BAIE',
    left: 'ANSE'
  }
}];
const LEADERS = [{
  name: 'Camille',
  score: 980
}, {
  name: 'Rodolphe',
  score: 940
}, {
  name: 'Inès',
  score: 910
}, {
  name: 'Théo',
  score: 870
}, {
  name: 'Lou',
  score: 845
}];

/* ── Topbar ────────────────────────────────────────────────── */
function Topbar({
  pseudo,
  onNav,
  onLogout
}) {
  const {
    StatPill,
    IconButton,
    Avatar
  } = window.OrientaDesignSystem_50c4c1;
  return /*#__PURE__*/React.createElement("header", {
    className: "tb"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tb-in"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tb-brand",
    onClick: () => onNav('hub')
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-icon.svg",
    alt: "Orienta"
  }), /*#__PURE__*/React.createElement("span", null, "Orienta")), /*#__PURE__*/React.createElement("nav", {
    className: "tb-nav"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tb-link tb-link--active",
    onClick: () => onNav('hub')
  }, "Hub"), /*#__PURE__*/React.createElement("div", {
    className: "tb-link",
    onClick: () => onNav('hub')
  }, "Classement"), /*#__PURE__*/React.createElement("div", {
    className: "tb-link",
    onClick: () => onNav('hub')
  }, "Tutoriel")), /*#__PURE__*/React.createElement("span", {
    className: "tb-spacer"
  }), /*#__PURE__*/React.createElement(StatPill, {
    tone: "jetons",
    icon: /*#__PURE__*/React.createElement("span", {
      "aria-hidden": true
    }, "\uD83E\uDE99"),
    value: 120,
    title: "Tes jetons"
  }), /*#__PURE__*/React.createElement(StatPill, {
    tone: "streak",
    icon: /*#__PURE__*/React.createElement(IFlame, null),
    value: 7,
    title: "Ta s\xE9rie"
  }), /*#__PURE__*/React.createElement(IconButton, {
    badge: 2,
    title: "Notifications"
  }, /*#__PURE__*/React.createElement(IBell, null)), /*#__PURE__*/React.createElement("span", {
    className: "tb-divider"
  }), /*#__PURE__*/React.createElement("div", {
    className: "tb-me",
    onClick: () => onNav('hub')
  }, /*#__PURE__*/React.createElement(Avatar, {
    emoji: "\uD83E\uDDED",
    size: "md"
  }), /*#__PURE__*/React.createElement("span", {
    className: "tb-me-name"
  }, pseudo)), /*#__PURE__*/React.createElement(IconButton, {
    title: "Se d\xE9connecter",
    onClick: onLogout
  }, /*#__PURE__*/React.createElement(ILogout, null))));
}

/* ── Login ─────────────────────────────────────────────────── */
function LoginScreen({
  onLogin
}) {
  const {
    Button,
    Card
  } = window.OrientaDesignSystem_50c4c1;
  const [pseudo, setPseudo] = React.useState('');
  const [err, setErr] = React.useState('');
  function submit(e) {
    e.preventDefault();
    if (!pseudo.trim()) {
      setErr('Entre un pseudo pour continuer.');
      return;
    }
    onLogin(pseudo.trim());
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "screen",
    style: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: '8%',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 700,
      height: 500,
      background: 'radial-gradient(ellipse, rgba(10,158,132,0.11) 0%, transparent 68%)',
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement(Card, {
    elevation: "raised",
    style: {
      width: '100%',
      maxWidth: 420,
      padding: '50px 44px 38px',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      borderColor: 'rgba(10,158,132,0.10)',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-icon.svg",
    alt: "Orienta",
    style: {
      width: 44,
      height: 44,
      borderRadius: 12
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--display)',
      fontWeight: 800,
      fontSize: 26,
      color: 'var(--teal)',
      letterSpacing: '-0.035em'
    }
  }, "Orienta")), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--display)',
      fontWeight: 800,
      fontSize: 28,
      lineHeight: 1.18,
      letterSpacing: '-0.03em',
      margin: '0 0 10px'
    }
  }, "Le jeu de mots", /*#__PURE__*/React.createElement("br", null), "de l'\xE9quipe WeFiiT"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--ink-2)',
      fontSize: 14,
      lineHeight: 1.6,
      margin: '0 0 26px'
    }
  }, "Vos mots, une seule aventure. Relevez le d\xE9fi du jour, ensemble."), /*#__PURE__*/React.createElement("form", {
    onSubmit: submit,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "o-field-label",
    htmlFor: "ps"
  }, "Ton pseudo"), /*#__PURE__*/React.createElement("input", {
    id: "ps",
    className: "o-input",
    style: {
      marginTop: 7
    },
    placeholder: "Entre ton pseudo\u2026",
    autoFocus: true,
    value: pseudo,
    maxLength: 32,
    onChange: e => {
      setPseudo(e.target.value);
      setErr('');
    }
  })), err && /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--coral)',
      fontSize: 13,
      margin: 0
    }
  }, err), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    type: "submit",
    iconRight: /*#__PURE__*/React.createElement(IArrow, null),
    style: {
      width: '100%',
      marginTop: 2
    }
  }, "Jouer maintenant")), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 20,
      fontSize: 12,
      color: 'var(--ink-3)'
    }
  }, "Nouveau pseudo = nouveau compte", /*#__PURE__*/React.createElement("br", null), "M\xEAme pseudo = m\xEAme profil")));
}

/* ── Hub ───────────────────────────────────────────────────── */
function HubScreen({
  pseudo,
  onPlay,
  onNav,
  onLogout
}) {
  const {
    Button,
    Card,
    Badge,
    Avatar,
    XPGauge,
    SectionKicker
  } = window.OrientaDesignSystem_50c4c1;
  return /*#__PURE__*/React.createElement("div", {
    className: "screen"
  }, /*#__PURE__*/React.createElement(Topbar, {
    pseudo: pseudo,
    onNav: onNav,
    onLogout: onLogout
  }), /*#__PURE__*/React.createElement("main", {
    className: "main"
  }, /*#__PURE__*/React.createElement(SectionKicker, {
    num: "01",
    trailing: /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: 'var(--ink-3)',
        fontWeight: 600
      }
    }, "\xC9dition N\xB0142 \xB7 aujourd'hui")
  }, "La grille du jour"), /*#__PURE__*/React.createElement("div", {
    className: "hub-hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-card"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), "Challenge du jour"), /*#__PURE__*/React.createElement("h1", {
    className: "hero-title"
  }, "La grille", /*#__PURE__*/React.createElement("br", null), "du jour"), /*#__PURE__*/React.createElement("p", {
    className: "hero-p"
  }, "Faites pivoter les quatre cartes, suivez les indices et placez tout juste. Une nouvelle grille chaque matin."), /*#__PURE__*/React.createElement("div", {
    className: "spill-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "spill"
  }, /*#__PURE__*/React.createElement("span", {
    className: "spill-k"
  }, "Statut"), /*#__PURE__*/React.createElement("span", {
    className: "spill-v"
  }, "Non jou\xE9")), /*#__PURE__*/React.createElement("div", {
    className: "spill spill--teal"
  }, /*#__PURE__*/React.createElement("span", {
    className: "spill-k"
  }, "Niveau"), /*#__PURE__*/React.createElement("span", {
    className: "spill-v"
  }, "Moyen")), /*#__PURE__*/React.createElement("div", {
    className: "spill"
  }, /*#__PURE__*/React.createElement("span", {
    className: "spill-k"
  }, "Joueurs"), /*#__PURE__*/React.createElement("span", {
    className: "spill-v"
  }, "38")), /*#__PURE__*/React.createElement("div", {
    className: "spill spill--amber"
  }, /*#__PURE__*/React.createElement("span", {
    className: "spill-k"
  }, "R\xE9ussite"), /*#__PURE__*/React.createElement("span", {
    className: "spill-v"
  }, "71%"))), /*#__PURE__*/React.createElement("div", {
    className: "hero-actions"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    iconLeft: /*#__PURE__*/React.createElement(IPlay, null),
    onClick: onPlay
  }, "Jouer la grille"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm"
  }, "Grilles pr\xE9c\xE9dentes (6) \u2192"))), /*#__PURE__*/React.createElement("aside", {
    className: "stage"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stage-top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "stage-kind"
  }, "\u25B6 D\xE9couvrir le jeu"), /*#__PURE__*/React.createElement("span", {
    className: "stage-live"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), "En boucle")), /*#__PURE__*/React.createElement("div", {
    className: "stage-center"
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/hero-card.png",
    alt: "Carte qui pivote"
  })), /*#__PURE__*/React.createElement("div", {
    className: "stage-info"
  }, /*#__PURE__*/React.createElement("h3", null, "Une grille. Chaque jour.", /*#__PURE__*/React.createElement("br", null), "Avec tout le monde."), /*#__PURE__*/React.createElement("p", null, "Tournez les cartes, suivez les indices, r\xE9solvez la grille.")))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 28
    }
  }, /*#__PURE__*/React.createElement(Card, {
    elevation: "raised"
  }, /*#__PURE__*/React.createElement(XPGauge, {
    mascot: /*#__PURE__*/React.createElement("span", null, "\uD83E\uDD88"),
    eyebrow: "Communaut\xE9",
    level: "Niveau 6 \u2014 Chasseur",
    xp: "9 240 XP collectifs",
    pct: 42,
    nextLabel: "Sage dans 6 760 XP",
    onClick: () => {}
  }))), /*#__PURE__*/React.createElement("section", {
    className: "rank"
  }, /*#__PURE__*/React.createElement(SectionKicker, {
    num: "02"
  }, "Classement du jour"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12.5,
      color: 'var(--teal)',
      fontWeight: 600,
      margin: '8px 0 0'
    }
  }, "\uD83C\uDFC6 Le 1\u1D49\u02B3 du classement gagne le droit de cr\xE9er la grille du jour dans 3 jours."), /*#__PURE__*/React.createElement("div", {
    className: "rank-list"
  }, LEADERS.map((p, i) => /*#__PURE__*/React.createElement("div", {
    className: "rank-row",
    key: p.name
  }, /*#__PURE__*/React.createElement("span", {
    className: `rank-pos rank-pos--${i + 1}`
  }, i + 1), /*#__PURE__*/React.createElement(Avatar, {
    initial: p.name[0],
    color: ['var(--blue)', 'var(--orange)', 'var(--green)', 'var(--coral)', 'var(--teal)'][i % 5],
    size: "sm"
  }), /*#__PURE__*/React.createElement("span", {
    className: "rank-name"
  }, p.name), i === 0 && /*#__PURE__*/React.createElement(Badge, {
    tone: "warning"
  }, "R\xE9compense"), /*#__PURE__*/React.createElement("span", {
    className: "rank-score"
  }, p.score)))))));
}
window.OrientaScreens = {
  Topbar,
  LoginScreen,
  HubScreen,
  CLUES,
  CARDS
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/orienta_app/screens.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.StatPill = __ds_scope.StatPill;

__ds_ns.TextField = __ds_scope.TextField;

__ds_ns.SectionKicker = __ds_scope.SectionKicker;

__ds_ns.XPGauge = __ds_scope.XPGauge;

__ds_ns.PuzzleBoard = __ds_scope.PuzzleBoard;

__ds_ns.CARD_COLORS = __ds_scope.CARD_COLORS;

__ds_ns.WordCard = __ds_scope.WordCard;

})();
