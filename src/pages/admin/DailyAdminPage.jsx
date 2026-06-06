import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { DndContext, closestCorners, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { getAdminSecret, clearAdminSecret } from '../../lib/adminSecret'
import { sample } from '../../lib/shuffle'
import Header from '../../components/ui/Header'
import CloverWithInputs from '../../components/game/CloverWithInputs'
import SuggestionsAdmin from './SuggestionsAdmin'
import StatsAdmin from './StatsAdmin'

const ADMIN_PSEUDO = 'Rodolphe LE BLEVENEC'
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function isoToday() {
  return new Date().toISOString().split('T')[0]
}

function ymd(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function buildMonthCells(year, month) {
  // month: 0-indexed. Returns array of { date|null } with leading blanks (Monday-first).
  const firstWeekday = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const cells = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(ymd(year, month, d))
  return cells
}

async function fetchCardPool() {
  const { data } = await supabase.from('orienta_word_cards').select('*').limit(1000)
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

  const [adminTab, setAdminTab] = useState('grilles')
  const today = isoToday()
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [gridsByDate, setGridsByDate] = useState(new Map())
  const [onlyEmpty, setOnlyEmpty] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [editingGrid, setEditingGrid] = useState(null)
  const [clues, setClues] = useState({ top: '', right: '', bottom: '', left: '' })
  const [placements, setPlacements] = useState({ 0: null, 1: null, 2: null, 3: null })
  const [cardPool, setCardPool] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshingSlot, setRefreshingSlot] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
  )

  useEffect(() => {
    if (user && user.pseudo !== ADMIN_PSEUDO) navigate('/hub')
  }, [user, navigate])

  useEffect(() => {
    fetchCardPool().then(setCardPool)
  }, [])

  useEffect(() => {
    fetchMonth(viewMonth.year, viewMonth.month)
  }, [viewMonth])

  async function fetchMonth(year, month) {
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    const first = ymd(year, month, 1)
    const last = ymd(year, month, lastDay)
    const { data: grids } = await supabase
      .from('orienta_grids')
      .select('id, daily_date, clue_top, clue_right, clue_bottom, clue_left, status')
      .gte('daily_date', first)
      .lte('daily_date', last)
    setGridsByDate(new Map((grids ?? []).map(g => [g.daily_date, g])))
  }

  function changeMonth(delta) {
    setViewMonth(({ year, month }) => {
      const m = month + delta
      return { year: year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 }
    })
  }

  function getExcludedIds(exceptPos = null) {
    const ids = new Set()
    for (const [pos, item] of Object.entries(placements)) {
      if (item && parseInt(pos) !== exceptPos) ids.add(item.card.id)
    }
    return ids
  }

  async function handleSelectDate(date) {
    const grid = gridsByDate.get(date) ?? null
    setSelectedDate(date)
    setSaveSuccess(false)
    setCalendarOpen(false)

    const pool = cardPool.length ? cardPool : await fetchCardPool().then(p => { setCardPool(p); return p })

    if (grid) {
      setEditingGrid(grid)
      setClues({ top: grid.clue_top ?? '', right: grid.clue_right ?? '', bottom: grid.clue_bottom ?? '', left: grid.clue_left ?? '' })
      // Les cartes (solution) sont servies par get-solution — l'admin est le
      // créateur des grilles du jour, donc autorisé. orienta_grid_cards n'est plus lue en direct.
      const { data: sol } = await supabase.functions.invoke('get-solution', {
        body: { grid_id: grid.id, player_id: user.id },
      })
      const p = {}
      for (const gc of sol?.cards ?? []) {
        if (gc.position >= 0 && gc.position <= 3 && gc.orienta_word_cards) {
          p[gc.position] = { card: gc.orienta_word_cards, rotation: gc.rotation ?? 0, colorIndex: gc.position }
        }
      }
      setPlacements(p)
    } else {
      setEditingGrid(null)
      setClues({ top: '', right: '', bottom: '', left: '' })
      const p = {}
      sample(pool, 4).forEach((card, i) => { p[i] = { card, rotation: 0, colorIndex: i } })
      setPlacements(p)
    }
  }

  async function handleRefreshAll() {
    setIsRefreshing(true)
    const pool = cardPool.length ? cardPool : await fetchCardPool().then(p => { setCardPool(p); return p })
    const p = {}
    sample(pool, 4).forEach((card, i) => { p[i] = { card, rotation: 0, colorIndex: i } })
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

  function handleDragEnd({ active, over }) {
    if (!over) return
    const slotIdx = parseInt(String(over.id).replace('slot-', ''), 10)
    if (isNaN(slotIdx)) return

    // active.id d'une carte placée = `placed-${card.id}-${pos}` (cf. WordCard/DroppableSlot)
    for (const [pos, item] of Object.entries(placements)) {
      if (item && `placed-${item.card.id}-${pos}` === active.id) {
        const sourceSlot = parseInt(pos)
        if (sourceSlot === slotIdx) return
        // Échange les deux slots ; la couleur (colorIndex) reste attachée à la
        // position pour que l'aperçu reflète la grille finale (couleur = slot).
        setPlacements(prev => {
          const moved = prev[slotIdx]
          return {
            ...prev,
            [slotIdx]: { ...item, colorIndex: slotIdx },
            [sourceSlot]: moved ? { ...moved, colorIndex: sourceSlot } : null,
          }
        })
        return
      }
    }
  }

  function handleRotate(pos) {
    setPlacements(prev => {
      const item = prev[pos]
      if (!item) return prev
      return { ...prev, [pos]: { ...item, rotation: (item.rotation + 90) % 360 } }
    })
  }

  async function handleSave() {
    if (!selectedDate || !user) return
    const allFilled = Object.values(placements).every(v => v !== null)
    if (!allFilled) return
    setIsSaving(true)

    const placementRows = Object.entries(placements).map(([pos, item]) => ({
      card_id: item.card.id,
      position: parseInt(pos),
      rotation: item.rotation,
    }))

    const { data, error } = await supabase.functions.invoke('admin', {
      body: {
        admin_secret: getAdminSecret(),
        action: 'save-daily-grid',
        creator_id: user.id,
        date: selectedDate,
        grid_id: editingGrid?.id,
        clues,
        placements: placementRows,
      },
    })

    setIsSaving(false)
    if (error || !data || data.error) {
      if (data?.error === 'unauthorized') { clearAdminSecret(); alert('Mot de passe administrateur incorrect.') }
      else alert('Échec de l\'enregistrement.')
      return
    }
    setSaveSuccess(true)
    fetchMonth(viewMonth.year, viewMonth.month)
  }

  async function handleDelete() {
    if (!editingGrid) return
    if (!window.confirm(`Supprimer la grille du ${formatDate(selectedDate)} ?`)) return
    const { data, error } = await supabase.functions.invoke('admin', {
      body: { admin_secret: getAdminSecret(), action: 'delete-daily-grid', grid_id: editingGrid.id },
    })
    if (error || !data || data.error) {
      if (data?.error === 'unauthorized') { clearAdminSecret(); alert('Mot de passe administrateur incorrect.') }
      else alert('Échec de la suppression.')
      return
    }
    setSelectedDate(null)
    setEditingGrid(null)
    fetchMonth(viewMonth.year, viewMonth.month)
  }

  const allPlaced = Object.values(placements).every(v => v !== null)
  const cluesOk = clues.top && clues.right && clues.bottom && clues.left

  const cells = buildMonthCells(viewMonth.year, viewMonth.month)
  const emptyCount = cells.filter(d => d && !gridsByDate.has(d)).length

  const calendar = (
    <div className="admin-calendar">
      <div className="admin-cal-header">
        <button className="admin-cal-nav" onClick={() => changeMonth(-1)} type="button" aria-label="Mois précédent">‹</button>
        <span className="admin-cal-month">{MONTHS[viewMonth.month]} {viewMonth.year}</span>
        <button className="admin-cal-nav" onClick={() => changeMonth(1)} type="button" aria-label="Mois suivant">›</button>
      </div>

      <button
        type="button"
        className={`admin-cal-filter ${onlyEmpty ? 'admin-cal-filter--on' : ''}`}
        onClick={() => setOnlyEmpty(v => !v)}
      >
        <span className="admin-cal-filter-dot" />
        {onlyEmpty ? `À remplir uniquement · ${emptyCount}` : 'Filtrer : à remplir'}
      </button>

      <div className="admin-cal-weekdays">
        {WEEKDAYS.map((w, i) => <span key={i} className="admin-cal-weekday">{w}</span>)}
      </div>
      <div className="admin-cal-grid">
        {cells.map((date, i) => {
          if (!date) return <span key={`blank-${i}`} className="admin-cal-cell admin-cal-cell--blank" />
          const grid = gridsByDate.get(date)
          const hasGrid = !!grid
          const dimmed = onlyEmpty && hasGrid
          const dayNum = parseInt(date.slice(8, 10), 10)
          return (
            <button
              key={date}
              type="button"
              onClick={() => handleSelectDate(date)}
              className={[
                'admin-cal-cell',
                hasGrid ? 'admin-cal-cell--filled' : 'admin-cal-cell--empty',
                date === selectedDate ? 'admin-cal-cell--active' : '',
                date === today ? 'admin-cal-cell--today' : '',
                dimmed ? 'admin-cal-cell--dimmed' : '',
              ].join(' ')}
              title={hasGrid ? (grid.clue_top ? `${grid.clue_top} · ${grid.clue_right}…` : 'Grille sans indice') : 'À remplir'}
            >
              <span className="admin-cal-num">{dayNum}</span>
              <span className={`admin-cal-mark ${hasGrid ? 'admin-cal-mark--ok' : 'admin-cal-mark--empty'}`}>
                {hasGrid ? '✓' : ''}
              </span>
            </button>
          )
        })}
      </div>

      <div className="admin-cal-legend">
        <span className="admin-cal-legend-item"><span className="admin-cal-dot admin-cal-dot--ok" /> Validée</span>
        <span className="admin-cal-legend-item"><span className="admin-cal-dot admin-cal-dot--empty" /> À faire</span>
      </div>
    </div>
  )

  return (
    <div className="admin-page">
      <Header />

      <div className="admin-tabs">
        {[['grilles', '📅 Grilles du jour'], ['idees', '💡 Boîte à idées'], ['stats', '📊 Stats']].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`admin-tab${adminTab === id ? ' admin-tab--active' : ''}`}
            onClick={() => setAdminTab(id)}
          >{label}</button>
        ))}
      </div>

      {adminTab === 'idees' ? (
        <main className="admin-main admin-main--single">
          <SuggestionsAdmin />
        </main>
      ) : adminTab === 'stats' ? (
        <main className="admin-main admin-main--single">
          <StatsAdmin />
        </main>
      ) : (
      <main className="admin-main">

        {/* ── Barre mobile : ouvre le calendrier ── */}
        <button
          type="button"
          className="admin-mobile-bar"
          onClick={() => setCalendarOpen(true)}
        >
          <span className="admin-mobile-bar-icon">📅</span>
          <span className="admin-mobile-bar-label">
            {selectedDate ? formatDate(selectedDate) : 'Choisir une date'}
          </span>
          <span className="admin-mobile-bar-chevron">Calendrier ›</span>
        </button>

        {/* ── Colonne gauche : calendrier (sidebar desktop) ── */}
        <aside className="admin-schedule">{calendar}</aside>

        {/* ── Tiroir calendrier (mobile) ── */}
        {calendarOpen && (
          <>
            <div className="admin-cal-backdrop" onClick={() => setCalendarOpen(false)} />
            <div className="admin-cal-drawer">
              <div className="admin-cal-drawer-head">
                <span className="admin-cal-drawer-title">Calendrier</span>
                <button className="admin-cal-drawer-close" onClick={() => setCalendarOpen(false)} type="button" aria-label="Fermer">✕</button>
              </div>
              {calendar}
            </div>
          </>
        )}

        {/* ── Colonne droite : éditeur ── */}
        <section className="admin-editor">
          {!selectedDate ? (
            <div className="admin-editor-empty">
              <p>Sélectionne une date dans le calendrier pour créer ou modifier la grille du jour.</p>
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
                <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
                  <CloverWithInputs
                    placements={placements}
                    clues={clues}
                    setClues={setClues}
                    onRotate={handleRotate}
                    draggable
                    slotAction={pos => (
                      <button
                        className="admin-slot-refresh"
                        onClick={() => handleRefreshSlot(pos)}
                        disabled={refreshingSlot === pos}
                        type="button"
                        title="Repiocher une carte"
                      >
                        {refreshingSlot === pos ? '…' : '🎲'}
                      </button>
                    )}
                  />
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
      )}
    </div>
  )
}
