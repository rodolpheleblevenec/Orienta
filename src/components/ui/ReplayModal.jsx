import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function ReplayModal({ playId, gridId, onClose }) {
  const [grid, setGrid] = useState(null)
  const [attempts, setAttempts] = useState([])
  const [play, setPlay] = useState(null)
  const [selectedAttempt, setSelectedAttempt] = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('orienta_grids').select('*, orienta_grid_cards(*, orienta_word_cards(*))').eq('id', gridId).single(),
      supabase.from('orienta_play_attempts').select('*').eq('play_id', playId).order('attempt_number'),
      supabase.from('orienta_plays').select('*').eq('id', playId).single(),
    ]).then(([gridRes, attemptsRes, playRes]) => {
      setGrid(gridRes.data)
      setAttempts(attemptsRes.data ?? [])
      setPlay(playRes.data)
      if (attemptsRes.data?.length > 0) {
        setSelectedAttempt(attemptsRes.data[attemptsRes.data.length - 1])
      }
    })
  }, [playId, gridId])

  if (!grid || !selectedAttempt) {
    return (
      <div className="replay-modal-backdrop" onClick={onClose}>
        <div className="replay-modal" onClick={e => e.stopPropagation()}>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Chargement…</p>
        </div>
      </div>
    )
  }

  const cardMap = {}
  for (const gc of grid.orienta_grid_cards) {
    cardMap[gc.id] = gc
  }

  const solutionByPos = {}
  for (const gc of grid.orienta_grid_cards) {
    if (gc.position !== -1) {
      solutionByPos[gc.position] = gc.orienta_word_cards
    }
  }

  const answerByPos = {}
  if (selectedAttempt.answer) {
    for (const ans of selectedAttempt.answer) {
      answerByPos[ans.position] = {
        card: ans,
        word: cardMap[ans.card_id]?.orienta_word_cards,
      }
    }
  }

  const positions = [0, 1, 2, 3]
  const posLabels = { 0: 'Haut', 1: 'Droite', 2: 'Bas', 3: 'Gauche' }
  const wordFields = { 0: 'word_top', 1: 'word_right', 2: 'word_bottom', 3: 'word_left' }

  return (
    <div className="replay-modal-backdrop" onClick={onClose}>
      <div className="replay-modal" onClick={e => e.stopPropagation()}>
        <div className="replay-modal-header">
          <h2 className="replay-modal-title">Réécoute</h2>
          <button className="replay-modal-close" onClick={onClose} type="button">✕</button>
        </div>

        <div className="replay-modal-content">
          <div className="replay-grid">
            {positions.map(pos => {
              const wordField = wordFields[pos]
              const playerWord = answerByPos[pos]?.word?.[wordField]
              const correctWord = solutionByPos[pos]?.[wordField]
              const isCorrect = playerWord === correctWord && playerWord !== undefined
              return (
                <div key={pos} className="replay-position">
                  <div className="replay-label">{posLabels[pos]}</div>
                  <div className={`replay-word ${answerByPos[pos]?.card ? (isCorrect ? 'replay-word--correct' : 'replay-word--wrong') : 'replay-word--empty'}`}>
                    {playerWord ?? '—'}
                  </div>
                  <div className="replay-correct">
                    {correctWord || '—'}
                  </div>
                </div>
              )
            })}
          </div>

          {attempts.length > 1 && (
            <div className="replay-attempts">
              <h3>Autres essais</h3>
              <div className="replay-attempt-list">
                {attempts.map((att, i) => (
                  <button
                    key={i}
                    className={`replay-attempt-btn ${selectedAttempt.attempt_number === att.attempt_number ? 'replay-attempt-btn--active' : ''}`}
                    onClick={() => setSelectedAttempt(att)}
                  >
                    Essai {att.attempt_number}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="replay-feedback">
            <div className="replay-feedback-row">
              <span>Bien placé & orienté:</span>
              <strong>{selectedAttempt.correct_full}</strong>
            </div>
            <div className="replay-feedback-row">
              <span>Bien orienté:</span>
              <strong>{selectedAttempt.correct_rotation}</strong>
            </div>
            <div className="replay-feedback-row">
              <span>Mauvais:</span>
              <strong>{selectedAttempt.neither}</strong>
            </div>
          </div>
        </div>

        <button className="btn-secondary replay-modal-close-btn" onClick={onClose}>Fermer</button>
      </div>
    </div>
  )
}
