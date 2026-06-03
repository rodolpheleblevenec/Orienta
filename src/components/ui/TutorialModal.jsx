import { useAuthStore } from '../../stores/authStore'
import { useBodyScrollLock } from '../../lib/useBodyScrollLock'

function DemoBoard() {
  return (
    <div className="tuto-board">
      <div className="tuto-board-clue tuto-board-clue--top">ÉCURIE</div>
      <div className="tuto-board-middle">
        <div className="tuto-board-clue tuto-board-clue--side">MCU</div>
        <div className="tuto-board-grid">
          <div className="tuto-board-card tuto-board-card--a">
            <span className="tbc-top">ÉTABLE</span>
            <span className="tbc-left">NATURE</span>
            <span className="tbc-right">CHEVAL</span>
            <span className="tbc-bot">PAILLE</span>
          </div>
          <div className="tuto-board-card tuto-board-card--b">
            <span className="tbc-top">ÉTALON</span>
            <span className="tbc-left">CAMÉRA</span>
            <span className="tbc-right">BLOND</span>
            <span className="tbc-bot">RAPIDE</span>
          </div>
          <div className="tuto-board-card tuto-board-card--c">
            <span className="tbc-top">PRAIRIE</span>
            <span className="tbc-left">HERBE</span>
            <span className="tbc-right">FOIN</span>
            <span className="tbc-bot">VERT</span>
          </div>
          <div className="tuto-board-card tuto-board-card--d">
            <span className="tbc-top">GALOP</span>
            <span className="tbc-left">COURSE</span>
            <span className="tbc-right">VITESSE</span>
            <span className="tbc-bot">PISTE</span>
          </div>
        </div>
        <div className="tuto-board-clue tuto-board-clue--side">FILM</div>
      </div>
      <div className="tuto-board-clue tuto-board-clue--bot">VELOURS</div>
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

export default function TutorialModal() {
  const { tutorialOpen, closeTutorial, markTourDone } = useAuthStore()
  useBodyScrollLock(tutorialOpen)

  if (!tutorialOpen) return null

  function handleClose() {
    markTourDone('tutorial_modal_done')
    closeTutorial()
  }

  return (
    <div className="tutorial-backdrop">
      <div className="tutorial-modal">

        <div className="tutorial-modal-header">
          <div className="tutorial-modal-brand">
            <span className="hub-eyebrow-dot" />
            Comment jouer
          </div>
          <button className="tutorial-modal-x" onClick={handleClose} type="button">✕</button>
        </div>

        <div className="tutorial-modal-body">

          {/* ── Hero ── */}
          <section className="tuto-hero">
            <div className="tuto-hero-text">
              <h1 className="tuto-hero-title">Un jeu quotidien<br />à deux rôles</h1>
              <p className="tuto-hero-sub">
                Chaque jour, tes collègues publient des grilles. Tu peux en jouer autant que tu veux — ou en créer une toi-même. Le principe : cacher 4 cartes de mots dans une grille et écrire des indices pour aider les autres à les retrouver.
              </p>
              <span className="tuto-hero-hint">4 cartes · 4 indices · 3 essais</span>
            </div>
            <div className="tuto-hero-visual">
              <DemoBoard />
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
                  Tu disposes de 4 cartes à placer sur les 4 emplacements. Chaque carte a un mot sur chacune de ses faces — tourne-la pour que les mots pointent vers les bons indices. L'orientation compte autant que la position.
                </StepItem>
                <StepItem n="3" title="Soumets ta réponse">
                  Tu as <strong>3 essais</strong>. Après chaque tentative, le jeu te donne un retour façon Mastermind sur chacune de tes 4 cartes.
                </StepItem>
              </div>

              <div className="tuto-aside-col">
                <div className="tuto-callout">
                  <p className="tuto-callout-title">Retour après chaque essai</p>
                  <div className="tuto-feedback-list">
                    <div className="tuto-feedback-row">
                      <span className="tuto-fdot tuto-fdot--green" />
                      <div>
                        <strong>Vert</strong>
                        <p>Bon emplacement <em>et</em> bonne orientation.</p>
                      </div>
                    </div>
                    <div className="tuto-feedback-row">
                      <span className="tuto-fdot tuto-fdot--orange" />
                      <div>
                        <strong>Orange</strong>
                        <p>Bonne orientation, mais mauvais emplacement.</p>
                      </div>
                    </div>
                    <div className="tuto-feedback-row">
                      <span className="tuto-fdot tuto-fdot--red" />
                      <div>
                        <strong>Rouge</strong>
                        <p>Ni le bon emplacement, ni la bonne orientation.</p>
                      </div>
                    </div>
                  </div>
                </div>

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
                  Dispose les 4 cartes sur le trèfle 2×2 et oriente-les à ta guise. Tourne chaque carte jusqu'à ce que les mots adjacents des cartes voisines créent une connexion intéressante. C'est <em>toi</em> qui décides de la solution finale.
                </StepItem>
                <StepItem n="3" title="1 min 30 pour écrire tes indices">
                  Le chrono démarre dès que tu vois ta grille arrangée. Tu as <strong>90 secondes</strong> pour trouver un mot par bord qui relie les deux mots qui se font face. Anticipe tes indices avant de lancer le timer.
                </StepItem>
              </div>

              <div className="tuto-aside-col">
                <div className="tuto-callout tuto-callout--creator">
                  <p className="tuto-callout-title">Faire de bons indices</p>
                  <ul className="tuto-tips-list">
                    <li>
                      <span className="tuto-tips-icon tuto-tips-icon--yes">✓</span>
                      <span>L'indice doit relier <em>les deux mots en même temps</em>, pas juste l'un des deux.</span>
                    </li>
                    <li>
                      <span className="tuto-tips-icon tuto-tips-icon--no">✕</span>
                      <span>Évite les dérivés directs — si un mot est NAGER, NATATION est trop facile.</span>
                    </li>
                    <li>
                      <span className="tuto-tips-icon tuto-tips-icon--yes">✓</span>
                      <span>Pense à ton audience : une référence partagée peut être magnifique si tout le monde la capte.</span>
                    </li>
                    <li>
                      <span className="tuto-tips-icon tuto-tips-icon--yes">✓</span>
                      <span>Teste mentalement ta grille. Si tu peux imaginer un joueur plausible qui se tromperait, l'indice est trop ambigu.</span>
                    </li>
                  </ul>
                </div>

                <div className="tuto-callout tuto-callout--tip">
                  <p className="tuto-callout-title">Exemple</p>
                  <p>Si <strong>ÉTABLE</strong> et <strong>ÉTALON</strong> se font face sur le bord du haut, <strong>ÉCURIE</strong> est parfait. Si <strong>CAMÉRA</strong> et <strong>BLOND</strong> se font face à droite, <strong>MCU</strong> peut fonctionner pour qui connaît Thor.</p>
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

        </div>

        <div className="tutorial-modal-footer">
          <button className="btn-primary tutorial-modal-cta" onClick={handleClose} type="button">
            C'est parti !
          </button>
        </div>

      </div>
    </div>
  )
}
