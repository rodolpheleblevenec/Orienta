import { useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useBodyScrollLock } from '../../lib/useBodyScrollLock'

export default function TutorialModal() {
  const { tutorialOpen, closeTutorial } = useAuthStore()
  const [tab, setTab] = useState('creator')
  useBodyScrollLock(tutorialOpen)

  if (!tutorialOpen) return null

  return (
    <div className="tutorial-backdrop">
      <div className="tutorial-modal">
        <div className="tutorial-header">
          <h2>Comment jouer</h2>
          <button className="tutorial-close" onClick={closeTutorial} type="button">✕</button>
        </div>

        <div className="tutorial-tabs">
          <button
            className={`tutorial-tab ${tab === 'creator' ? 'tutorial-tab--active' : ''}`}
            onClick={() => setTab('creator')}
            type="button"
          >
            Créateur
          </button>
          <button
            className={`tutorial-tab ${tab === 'player' ? 'tutorial-tab--active' : ''}`}
            onClick={() => setTab('player')}
            type="button"
          >
            Joueur
          </button>
        </div>

        <div className="tutorial-content">
          {tab === 'creator' && (
            <div className="tutorial-section">
              <h3>Créer une grille</h3>
              <ol className="tutorial-steps">
                <li>
                  <strong>Choisir un niveau de difficulté</strong>
                  <p>Facile : temps illimité, 4 cartes. Moyen : 90s, 4 cartes. Difficile : 90s, 5 cartes (une est un leurre).</p>
                </li>
                <li>
                  <strong>Placer les cartes</strong>
                  <p>Glisse les cartes du plateau vers les 4 emplacements de la grille. Tu peux tourner les cartes avec ↻ pour orienter les mots.</p>
                </li>
                <li>
                  <strong>Écrire les indices</strong>
                  <p>Ajoute un indice pour chaque côté (haut, bas, gauche, droite). Les indices aident le joueur à trouver les cartes.</p>
                </li>
                <li>
                  <strong>Publier</strong>
                  <p>Une fois publiée, ta grille est visible pendant 48h. Les joueurs peuvent la résoudre et tu gagneras de l'XP ! 🎯</p>
                </li>
              </ol>
            </div>
          )}

          {tab === 'player' && (
            <div className="tutorial-section">
              <h3>Résoudre une grille</h3>
              <ol className="tutorial-steps">
                <li>
                  <strong>Lire les indices</strong>
                  <p>Les indices sont placés autour de la grille. Ils te permettent de déduire quelles cartes mettre où.</p>
                </li>
                <li>
                  <strong>Placer les cartes</strong>
                  <p>Glisse les cartes du plateau vers les emplacements de la grille. Oriente-les avec ↻ pour que les mots soient lisibles.</p>
                </li>
                <li>
                  <strong>Vérifier ton résultat</strong>
                  <p>Clique sur "Soumettre". Le jeu te montre combien de cartes sont bien placées et bien orientées.</p>
                </li>
                <li>
                  <strong>Réessayer</strong>
                  <p>Tu as 3 essais pour trouver la bonne grille. Chaque essai te rapproche de la solution ! 💪</p>
                </li>
              </ol>
            </div>
          )}
        </div>

        {tab === 'creator'
          ? <button className="tutorial-close-btn btn-secondary" onClick={() => setTab('player')} type="button">Suivant →</button>
          : <button className="tutorial-close-btn btn-primary" onClick={closeTutorial} type="button">Fermer</button>
        }
      </div>
    </div>
  )
}
