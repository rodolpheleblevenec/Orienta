import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { DndContext, closestCorners, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import Header from '../../components/ui/Header'
import WordCard from '../../components/game/WordCard'

const ADMIN_PSEUDO = 'Rodolphe LE BLEVENEC'

function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function isoToday() {
  return new Date().toISOString().split('T')[0]
}

function addDays(dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function buildScheduleDates() {
  const today = isoToday()
  return Array.from({ length: 14 }, (_, i) => addDays(today, i))
}

async function fetchCardPool() {
  const { data } = await supabase.from('orienta_word_cards').select('*').limit(200)
  return data ?? []
}

function pickRandom(pool, excludeIds) {
  const available = pool.filter(c => !excludeIds.has(c.id))
  if (!available.length) return null
  return available[Math.floor(Math.random() * available.length)]
}

export default function DailyAdminPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [schedule, setSchedule] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [editingGrid, setEditingGrid] = useState(null)
  const [clues, setClues] = useState({ top: '', right: '', bottom: '', left: '' })
  const [placements, setPlacements] = useState({ 0: null, 1: null, 2: null, 3: null })
  const [cardPool, setCardPool] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshingSlot, setRefreshingSlot] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [editingSide, setEditingSide] = useState(null)
  const lateralInputRef = useRef(null)

  useEffect(() => {
    if (editingSide && lateralInputRef.current) {
      lateralInputRef.current.focus()
      lateralInputRef.current.select()
    }
  }, [editingSide])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
  )

  useEffect(() => {
    if (user && user.pseudo !== ADMIN_PSEUDO) navigate('/hub')
  }, [user, navigate])

  useEffect(() => {
    fetchSchedule()
    fetchCardPool().then(setCardPool)
  }, [])

  async function fetchSchedule() {
    const dates = buildScheduleDates()
    const { data: grids } = await supabase
      .from('orienta_grids')
      .select('id, daily_date, clue_top, clue_right, clue_bottom, clue_left, status, orienta_grid_cards(card_id, position, rotation, orienta_word_cards(*))')
      .in('daily_date', dates)

    const gridByDate = new Map((grids ?? []).map(g => [g.daily_date, g]))
    setSchedule(dates.map(date => ({ date, grid: gridByDate.get(date) ?? null })))
  }

  function getExcludedIds(exceptPos = null) {
    const ids = new Set()
    for (const [pos, item] of Object.entries(placements)) {
      if (item && parseInt(pos) !== exceptPos) ids.add(item.card.id)
    }
    return ids
  }

  async function handleSelectDate(date, grid) {
    setSelectedDate(date)
    setSaveSuccess(false)

    const pool = cardPool.length ? cardPool : await fetchCardPool().then(p => { setCardPool(p); return p })

    if (grid) {
      setEditingGrid(grid)
      setClues({ top: grid.clue_top ?? '', right: grid.clue_right ?? '', bottom: grid.clue_bottom ?? '', left: grid.clue_left ?? '' })
      const p = {}
      for (const gc of grid.orienta_grid_cards ?? []) {
        if (gc.orienta_word_cards) {
          p[gc.position] = { card: gc.orienta_word_cards, rotation: gc.rotation ?? 0, colorIndex: gc.position }
        }
      }
      setPlacements(p)
    } else {
      setEditingGrid(null)
      setClues({ top: '', right: '', bottom: '', left: '' })
      const shuffled = [...pool].sort(() => Math.random() - 0.5)
      const p = {}
      shuffled.slice(0, 4).forEach((card, i) => { p[i] = { card, rotation: 0, colorIndex: i } })
      setPlacements(p)
    }
  }

  async function handleRefreshAll() {
    setIsRefreshing(true)
    const pool = cardPool.length ? cardPool : await fetchCardPool().then(p => { setCardPool(p); return p })
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    const p = {}
    shuffled.slice(0, 4).forEach((card, i) => { p[i] = { card, rotation: 0, colorIndex: i } })
    setPlacements(p)
    setClues({ top: '', right: '', bottom: '', left: '' })
    setIsRefreshing(false)
  }

  async function handleRefreshSlot(pos) {
    setRefreshingSlot(pos)
    const pool = cardPool.length ? cardPool : await fetchCardPool().then(p => { setCardPool(p); return p })
    const excluded = getExcludedIds(pos)
    const card = pickRandom(pool, excluded)
    if (card) {
      setPlacements(prev => ({ ...prev, [pos]: { card, rotation: 0, colorIndex: pos } }))
    }
    setRefreshingSlot(null)
  }

  function handleRotate(pos) {
    setPlacements(prev => {
      const item = prev[pos]
      if (!item) return prev
      return { ...prev, [pos]: { ...item, rotation: (item.rotation + 90) % 360 } }
    })
  }

  function handleClueChange(key, value) {
    // Interdire les espaces : un seul mot autorisé
    if (value.includes(' ')) {
      return
    }
    setClues(p => ({ ...p, [key]: value }))
  }

  async function handleSave() {
    if (!selectedDate || !user) return
    const allFilled = Object.values(placements).every(v => v !== null)
    if (!allFilled) return
    setIsSaving(true)

    const gridData = {
      creator_id: user.id,
      clue_top: clues.top,
      clue_right: clues.right,
      clue_bottom: clues.bottom,
      clue_left: clues.left,
      daily_date: selectedDate,
      status: 'published',
      difficulty: 'facile',
      expires_at: new Date(new Date(selectedDate).getTime() + 48 * 60 * 60 * 1000).toISOString(),
    }

    let gridId = editingGrid?.id

    if (editingGrid) {
      await supabase.from('orienta_grids').update(gridData).eq('id', editingGrid.id)
      await supabase.from('orienta_grid_cards').delete().eq('grid_id', editingGrid.id)
    } else {
      const { data: newGrid } = await supabase.from('orienta_grids').insert(gridData).select().single()
      gridId = newGrid?.id
    }

    if (gridId) {
      const cardRows = Object.entries(placements).map(([pos, item]) => ({
        grid_id: gridId,
        card_id: item.card.id,
        position: parseInt(pos),
        rotation: item.rotation,
      }))
      await supabase.from('orienta_grid_cards').insert(cardRows)
    }

    setIsSaving(false)
    setSaveSuccess(true)
    fetchSchedule()
  }

  async function handleDelete() {
    if (!editingGrid) return
    if (!window.confirm(`Supprimer la grille du ${formatDate(selectedDate)} ?`)) return
    await supabase.from('orienta_grid_cards').delete().eq('grid_id', editingGrid.id)
    await supabase.from('orienta_grids').delete().eq('id', editingGrid.id)
    setSelectedDate(null)
    setEditingGrid(null)
    fetchSchedule()
  }

  const allPlaced = Object.values(placements).every(v => v !== null)
  const cluesOk = clues.top && clues.right && clues.bottom && clues.left

  return (
    <div className="admin-page">
      <Header />
      <main className="admin-main">

        {/* ── Colonne gauche : calendrier ── */}
        <aside className="admin-schedule">
          <h2 className="admin-schedule-title">Calendrier — 14 jours</h2>
          <ul className="admin-schedule-list">
            {schedule.map(({ date, grid }) => {
              const isSelected = date === selectedDate
              const hasGrid = !!grid
              return (
                <li key={date}>
                  <button
                    className={`admin-schedule-row ${isSelected ? 'admin-schedule-row--active' : ''}`}
                    onClick={() => handleSelectDate(date, grid)}
                    type="button"
                  >
                    <span className="admin-schedule-date">{formatDate(date)}</span>
                    <span className={`admin-schedule-status ${hasGrid ? 'admin-schedule-status--ok' : 'admin-schedule-status--empty'}`}>
                      {hasGrid ? (
                        <>
                          <span className="admin-schedule-dot admin-schedule-dot--ok" />
                          {grid.clue_top ? `${grid.clue_top} · ${grid.clue_right}…` : 'Grille sans indice'}
                        </>
                      ) : (
                        <>
                          <span className="admin-schedule-dot admin-schedule-dot--empty" />
                          Vide
                        </>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        {/* ── Colonne droite : éditeur ── */}
        <section className="admin-editor">
          {!selectedDate ? (
            <div className="admin-editor-empty">
              <p>Sélectionne une date pour créer ou modifier la grille du jour.</p>
            </div>
          ) : (
            <>
              <div className="admin-editor-header">
                <h2 className="admin-editor-title">
                  {editingGrid ? 'Modifier' : 'Créer'} — {formatDate(selectedDate)}
                </h2>
                {editingGrid && (
                  <button className="admin-delete-btn" onClick={handleDelete} type="button">
                    Supprimer
                  </button>
                )}
              </div>

              <div className="admin-editor-body">
                <DndContext sensors={sensors} collisionDetection={closestCorners}>
                  <div className="clover-wrapper">
                    <input
                      className="clue-input clue-input--top"
                      value={clues.top}
                      onChange={e => handleClueChange('top', e.target.value)}
                      placeholder="Haut"
                      maxLength={24}
                    />
                    <button
                      type="button"
                      className={`clue-side-btn clue-side-btn--left${editingSide === 'left' ? ' clue-side-btn--active' : ''}${!clues.left ? ' clue-side-btn--empty' : ''}`}
                      onClick={() => setEditingSide('left')}
                    >
                      <span className="clue-side-btn__text">{clues.left || 'Gauche'}</span>
                    </button>
                    <div className="clover-grid">
                      {[0, 1, 2, 3].map(pos => (
                        <div key={pos} className="clover-slot admin-clover-slot">
                          {placements[pos] ? (
                            <WordCard
                              id={`admin-${placements[pos].card.id}-${pos}`}
                              card={placements[pos].card}
                              rotation={placements[pos].rotation}
                              colorIndex={placements[pos].colorIndex}
                              onRotate={() => handleRotate(pos)}
                              draggable={false}
                            />
                          ) : (
                            <div className="clover-slot-placeholder" />
                          )}
                          <button
                            className="admin-slot-refresh"
                            onClick={() => handleRefreshSlot(pos)}
                            disabled={refreshingSlot === pos}
                            type="button"
                            title="Remplacer cette carte"
                          >
                            {refreshingSlot === pos ? '…' : '↺'}
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className={`clue-side-btn clue-side-btn--right${editingSide === 'right' ? ' clue-side-btn--active' : ''}${!clues.right ? ' clue-side-btn--empty' : ''}`}
                      onClick={() => setEditingSide('right')}
                    >
                      <span className="clue-side-btn__text">{clues.right || 'Droite'}</span>
                    </button>
                    <input
                      className="clue-input clue-input--bottom"
                      value={clues.bottom}
                      onChange={e => handleClueChange('bottom', e.target.value)}
                      placeholder="Bas"
                      maxLength={24}
                    />
                    {editingSide && (
                      <>
                        <div className="clue-lateral-backdrop" onClick={() => setEditingSide(null)} />
                        <div className="clue-lateral-editor">
                          <span className="clue-lateral-label">{editingSide === 'left' ? '← Gauche' : 'Droite →'}</span>
                          <input
                            ref={lateralInputRef}
                            className="clue-lateral-input"
                            value={clues[editingSide]}
                            onChange={e => handleClueChange(editingSide, e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && setEditingSide(null)}
                            onBlur={() => setEditingSide(null)}
                            placeholder="Indice…"
                            maxLength={24}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </DndContext>
              </div>

              <div className="admin-editor-actions">
                <button
                  className="btn-secondary admin-refresh-btn"
                  onClick={handleRefreshAll}
                  disabled={isRefreshing}
                  type="button"
                >
                  {isRefreshing ? '…' : '↺ Toutes les cartes'}
                </button>
                <button
                  className="btn-primary admin-save-btn"
                  onClick={handleSave}
                  disabled={isSaving || !allPlaced || !cluesOk}
                  type="button"
                >
                  {isSaving ? '…' : saveSuccess ? '✓ Sauvegardé' : 'Enregistrer'}
                </button>
                {editingGrid && (
                  <Link to={`/play/${editingGrid.id}`} className="btn-secondary admin-play-btn">
                    ▶ Jouer
                  </Link>
                )}
              </div>

              {!cluesOk && allPlaced && (
                <p className="admin-hint">Remplis les 4 indices pour pouvoir enregistrer.</p>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  )
}
