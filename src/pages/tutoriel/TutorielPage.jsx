import { Link } from 'react-router-dom'
import Header from '../../components/ui/Header'
import StaticMiniGrid from '../../components/ui/StaticMiniGrid'

const DEMO_PLACEMENTS = {
  0: { card: { word_top: 'BALEINE', word_right: 'GÂTEAU', word_bottom: 'FOIE', word_left: 'POLICIER' }, rotation: 0, colorIndex: 0 },
  1: { card: { word_top: 'TABLE', word_right: 'KETCHUP', word_bottom: 'CHAPEAU', word_left: 'TÉLÉPHONE' }, rotation: 0, colorIndex: 1 },
  2: { card: { word_top: 'CHEVAL', word_right: 'RIDEAU', word_bottom: 'BOUCHE', word_left: 'MAILLOT' }, rotation: 0, colorIndex: 2 },
  3: { card: { word_top: 'REINE', word_right: 'FLEUR', word_bottom: 'MELON', word_left: 'BUS' }, rotation: 0, colorIndex: 3 },
}
const DEMO_CLUES = { top: 'Sel', right: 'Tomate', bottom: 'Vantard', left: 'Uniforme' }

function DemoGrid() {
  return (
    <div className="tuto-demo-grid">
      <StaticMiniGrid placements={DEMO_PLACEMENTS} clues={DEMO_CLUES} />
    </div>
  )
}

function StaticFeedback() {
  return (
    <div className="tuto-callout" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="tuto-pfd-header">
        <p className="tuto-callout-title">Retour après chaque essai</p>
      </div>
      <div className="pfd-tiles">
        <div className="pfd-tile pfd-tile--green">
          <span className="pfd-tile-num">2</span>
          <div className="pfd-tile-content">
            <div className="pfd-tile-title-row">
              <span className="pfd-tile-dot" />
              <span className="pfd-tile-title">Bien placés et orientés</span>
            </div>
            <span className="pfd-tile-subtitle">Bon emplacement et bonne orientation</span>
          </div>
        </div>
        <div className="pfd-tile pfd-tile--orange">
          <span className="pfd-tile-num">1</span>
          <div className="pfd-tile-content">
            <div className="pfd-tile-title-row">
              <span className="pfd-tile-dot" />
              <span className="pfd-tile-title">Bonne orientation</span>
            </div>
            <span className="pfd-tile-subtitle">Bien orientée, mais au mauvais emplacement</span>
          </div>
        </div>
        <div className="pfd-tile pfd-tile--red">
          <span className="pfd-tile-num">1</span>
          <div className="pfd-tile-content">
            <div className="pfd-tile-title-row">
              <span className="pfd-tile-dot" />
              <span className="pfd-tile-title">À revoir</span>
            </div>
            <span className="pfd-tile-subtitle">Ni le bon emplacement, ni la bonne orientation</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function StaticCreatePanel() {
  return (
    <div className="tuto-callout" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="create-phase-panel">
        <div className="create-step-header tuto-create-step-header">
          <span className="create-step-badge">Étape 2</span>
          <p className="create-step-title">Écris tes 4 indices</p>
        </div>
        <div className="create-timer-block">
          <div className="timer-bar-track">
            <div className="timer-bar-fill" style={{ width: '65%', backgroundColor: 'var(--accent)' }} />
          </div>
          <span className="timer-value" style={{ color: 'var(--accent)' }}>0:58</span>
        </div>
        <div className="create-clues-check">
          {[
            { key: 'top',    label: 'Haut',    done: true,  value: 'Sel' },
            { key: 'right',  label: 'Droite',  done: true,  value: 'Tomate' },
            { key: 'bottom', label: 'Bas',     done: false, value: '' },
            { key: 'left',   label: 'Gauche',  done: false, value: '' },
          ].map(({ key, label, done, value }) => (
            <div key={key} className={`create-clue-item${done ? ' create-clue-item--done' : ''}`}>
              <span className="create-clue-icon">{done ? '✓' : '○'}</span>
              <span className="create-clue-label">{label}</span>
              {done && <span className="create-clue-value">« {value} »</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StepItem({ n, title, children }) {
  return (
    <div className="tuto-step">
      <div className="tuto-step-num">{n}</div>
      <div className="tuto-step-body">
        <strong className="tuto-step-title">{title}</strong>
        <p className="tuto-step-desc">{children}</p>
      </div>
    </div>
  )
}

export default function TutorielPage() {
  return (
    <div className="hub-page">
      <Header />
      <main className="hub-main tuto-main">

        {/* ── Hero ── */}
        <section className="tuto-hero">
          <div className="tuto-hero-text">
            <p className="tuto-hero-eyebrow">
              <span className="hub-eyebrow-dot" />
              Comment jouer
            </p>
            <h1 className="tuto-hero-title">Un jeu quotidien<br />à deux rôles</h1>
            <p className="tuto-hero-sub">
              Chaque jour, tes collègues publient des grilles. Tu peux en jouer autant que tu veux — ou en créer une toi-même. Le principe : placer 4 cartes de mots dans une grille 2×2 et écrire des indices pour aider les autres à les retrouver.
            </p>
            <div className="tuto-hero-actions">
              <Link to="/" className="hub-btn-play">
                <svg viewBox="0 0 20 20" fill="currentColor"><path d="M6.3 3.7a1 1 0 0 1 1.4 0l6 6a1 1 0 0 1 0 1.4l-6 6A1 1 0 0 1 6 16.3V3.7Z"/></svg>
                Jouer maintenant
              </Link>
              <span className="tuto-hero-hint">4 cartes · 4 indices · 3 essais</span>
            </div>
          </div>
          <div className="tuto-hero-visual">
            <DemoGrid />
          </div>
        </section>

        {/* ── Jouer ── */}
        <section className="hub-part tuto-track">
          <div className="hub-part-head">
            <span className="hub-kick"><span className="hub-kick-num">01</span>Résoudre une grille</span>
            <span className="hub-kick-rule" />
            <span className="tuto-track-badge tuto-track-badge--play">Joueur</span>
          </div>

          <div className="tuto-track-layout">
            <div className="tuto-steps-col">
              <StepItem n="1" title="Lis les indices">
                Sur chaque bord extérieur de la grille, un indice relie les mots de deux cartes voisines. Ces 4 mots sont tes seules informations — commence par en tirer le maximum avant de placer quoi que ce soit.
              </StepItem>
              <StepItem n="2" title="Glisse et oriente les cartes">
                Tu disposes de 4 cartes dans la réserve à gauche. Glisse chaque carte vers un emplacement de la grille et tourne-la (↻) pour que ses mots pointent vers les bons indices. L'orientation compte autant que la position.
              </StepItem>
              <StepItem n="3" title="Soumets ta réponse">
                Tu as <strong>3 essais</strong>. Après chaque tentative, le jeu te donne un retour façon Mastermind — le nombre de cartes correctes pour chaque catégorie, à droite.
              </StepItem>
            </div>

            <div className="tuto-aside-col">
              <StaticFeedback />

              <div className="tuto-callout tuto-callout--tip">
                <p className="tuto-callout-title">Astuce</p>
                <p>Même un seul essai raté suffit souvent à comprendre quelle carte échanger ou de combien de degrés en faire pivoter une. Prends le temps de lire le retour avant de re-soumettre.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Créer ── */}
        <section className="hub-part hub-part-2 tuto-track">
          <div className="hub-part-head">
            <span className="hub-kick"><span className="hub-kick-num">02</span>Créer une grille</span>
            <span className="hub-kick-rule" />
            <span className="tuto-track-badge tuto-track-badge--create">Créateur</span>
          </div>

          <div className="tuto-track-layout">
            <div className="tuto-steps-col">
              <StepItem n="1" title="Reçois tes 4 cartes">
                L'app te distribue 4 cartes aléatoires. Chaque carte est un carré avec un mot différent sur chacun de ses 4 bords. C'est ce matériau brut que tu vas transformer en puzzle.
              </StepItem>
              <StepItem n="2" title="Arrange la grille comme tu veux">
                Glisse les 4 cartes sur les emplacements et oriente-les à ta guise. Tourne chaque carte jusqu'à ce que les mots adjacents des cartes voisines créent une connexion intéressante. C'est <em>toi</em> qui décides de la solution finale.
              </StepItem>
              <StepItem n="3" title="90 secondes pour écrire tes indices">
                Le chrono démarre dès que tu vois ta grille arrangée. Tu as <strong>90 secondes</strong> pour trouver un mot par bord qui relie les deux mots qui se font face. Anticipe tes indices avant de lancer le timer — en mode Facile, pas de chrono.
              </StepItem>
            </div>

            <div className="tuto-aside-col">
              <StaticCreatePanel />

              <div className="tuto-callout tuto-callout--tip">
                <p className="tuto-callout-title">Faire de bons indices</p>
                <ul className="tuto-tips-list">
                  <li>
                    <span className="tuto-tips-icon tuto-tips-icon--yes">✓</span>
                    <span>L'indice doit relier <em>les deux mots en même temps</em>, pas juste l'un des deux. <strong>POLICIER</strong> et <strong>MAILLOT</strong> → <strong>Uniforme</strong> : les deux en portent un.</span>
                  </li>
                  <li>
                    <span className="tuto-tips-icon tuto-tips-icon--yes">✓</span>
                    <span><strong>KETCHUP</strong> et <strong>FLEUR</strong> → <strong>Tomate</strong> : le ketchup vient de la tomate, et la tomate est une fleur avant d'être un fruit.</span>
                  </li>
                  <li>
                    <span className="tuto-tips-icon tuto-tips-icon--yes">✓</span>
                    <span><strong>BOUCHE</strong> et <strong>MELON</strong> → <strong>Vantard</strong> : grande bouche et avoir le melon — deux façons de dire qu'on se la raconte.</span>
                  </li>
                  <li>
                    <span className="tuto-tips-icon tuto-tips-icon--no">✕</span>
                    <span>Évite les dérivés directs — si un mot de la carte est NAGER, NATATION est trop facile et sera refusé.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── Score ── */}
        <section className="hub-part hub-part-2 tuto-track">
          <div className="hub-part-head">
            <span className="hub-kick"><span className="hub-kick-num">03</span>Score &amp; progression</span>
            <span className="hub-kick-rule" />
          </div>

          <div className="tuto-score-grid">
            <div className="tuto-score-card">
              <div className="tuto-score-icon">⚡</div>
              <strong>Score individuel</strong>
              <p>Plus tu es rapide et précis, plus ton score est élevé. Première tentative correcte : score maximum. Chaque essai raté et chaque seconde écoulée réduisent les points.</p>
            </div>
            <div className="tuto-score-card">
              <div className="tuto-score-icon">🌱</div>
              <strong>XP collectif</strong>
              <p>Tes scores alimentent la jauge collective de l'équipe. Plus la jauge monte, plus la créature d'équipe évolue. Tout le monde contribue, tout le monde gagne.</p>
            </div>
            <div className="tuto-score-card">
              <div className="tuto-score-icon">🏆</div>
              <strong>Classement du jour</strong>
              <p>Un classement quotidien regroupe les meilleurs scores. Joue toutes les grilles du jour pour maximiser ta position et ne pas laisser tes collègues trop loin derrière.</p>
            </div>
          </div>
        </section>

        {/* ── CTA bottom ── */}
        <section className="tuto-cta-section">
          <p className="tuto-cta-label">Prêt·e à jouer ?</p>
          <Link to="/" className="hub-btn-play">
            <svg viewBox="0 0 20 20" fill="currentColor"><path d="M6.3 3.7a1 1 0 0 1 1.4 0l6 6a1 1 0 0 1 0 1.4l-6 6A1 1 0 0 1 6 16.3V3.7Z"/></svg>
            Voir les grilles du jour
          </Link>
        </section>

      </main>
    </div>
  )
}
