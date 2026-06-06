import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { DndContext, DragOverlay, closestCorners, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { getAdminSecret, clearAdminSecret } from '../../lib/adminSecret'
import { sample } from '../../lib/shuffle'
import Header from '../../components/ui/Header'
import CloverWithInputs from '../../components/game/CloverWithInputs'
import WordCard from '../../components/game/WordCard'
import SuggestionsAdmin from './SuggestionsAdmin'
import StatsAdmin from './StatsAdmin'

const ADMIN_PSEUDO = 'Rodolphe LE BLEVENEC'
const RESERVE_LOW = 3
const DIFFICULTIES = [['facile', 'Facile'], ['moyen', 'Moyen']]

function isoTodayParis() {
  return new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' })
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Timestamp (created_at, UTC sans tz) → date + heure locale
function fmtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z')
  return d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function cluesPreview(g) {
  const cs = [g.clue_top, g.clue_right, g.clue_bottom, g.clue_left].filter(Boolean)
  return cs.length ? cs.join(' · ') : 'Grille sans indice'
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

// ── Élément réordonnable de la réserve (drag-and-drop priorité) ──
function ReserveRow({ grid, index, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: grid.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <li ref={setNodeRef} style={style} className="reserve-row">
      <button className="reserve-handle" {...attributes} {...listeners} type="button" title="Glisser pour réordonner" aria-label="Réordonner">⠿</button>
      <span className="reserve-rank">{index + 1}</span>
      <span className="reserve-clues">{cluesPreview(grid)}</span>
      <span className="reserve-diff">{grid.difficulty ?? '—'}</span>
      <span className="reserve-actions">
        <button className="reserve-edit" onClick={() => onEdit(grid)} type="button">Modifier</button>
        <button className="reserve-del" onClick={() => onDelete(grid)} type="button">Suppr.</button>
      </span>
    </li>
  )
}

export default function DailyAdminPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [adminTab, setAdminTab] = useState('grilles')

  // Données
  const [reserve, setReserve] = useState([])
  const [programme, setProgramme] = useState([])
  const [grants, setGrants] = useState([])
  const [cardPool, setCardPool] = useState([])
  const today = isoTodayParis()

  // Éditeur (réutilisé pour réserve + override d'un jour daté)
  const [view, setView] = useState('list')              // 'list' | 'editor'
  const [editorMode, setEditorMode] = useState('reserve') // 'reserve' | 'dated'
  const [editorDate, setEditorDate] = useState(null)     // pour 'dated'
  const [editingGrid, setEditingGrid] = useState(null)
  const [difficulty, setDifficulty] = useState('facile')
  const [clues, setClues] = useState({ top: '', right: '', bottom: '', left: '' })
  const [placements, setPlacements] = useState({ 0: null, 1: null, 2: null, 3: null })
  const [isSaving, setIsSaving] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshingSlot, setRefreshingSlot] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [activeCard, setActiveCard] = useState(null)
  const [isSwappingSlots, setIsSwappingSlots] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
  )

  useEffect(() => {
    if (user && user.pseudo !== ADMIN_PSEUDO) navigate('/hub')
  }, [user, navigate])

  useEffect(() => {
    fetchCardPool().then(setCardPool)
    refreshData()
  }, [])

  async function refreshData() {
    const [{ data: res }, { data: prog }, { data: grnts }] = await Promise.all([
      supabase.from('orienta_grids')
        .select('id, clue_top, clue_right, clue_bottom, clue_left, difficulty, reserve_priority')
        .eq('daily_status', 'reserve')
        .order('reserve_priority', { ascending: true }),
      supabase.from('orienta_grids')
        .select('id, daily_date, daily_status, clue_top, clue_right, clue_bottom, clue_left, difficulty, creator_id')
        .not('daily_date', 'is', null)
        .gte('daily_date', new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0])
        .order('daily_date', { ascending: true }),
      // Droits de création (gagnants) : pseudo du gagnant + date de création effective de la grille
      supabase.from('orienta_grid_grants')
        .select('id, source_date, target_date, status, created_at, winner:orienta_users!winner_user_id(pseudo), created_grid:orienta_grids!created_grid_id(id, created_at)')
        .order('target_date', { ascending: false }),
    ])
    setReserve(res ?? [])
    setProgramme(prog ?? [])
    setGrants(grnts ?? [])
  }

  // ── Éditeur : ouverture ──
  function openNewReserve() {
    const pool = cardPool
    const p = {}
    sample(pool, 4).forEach((card, i) => { p[i] = { card, rotation: 0, colorIndex: i } })
    setPlacements(p)
    setClues({ top: '', right: '', bottom: '', left: '' })
    setDifficulty('facile')
    setEditingGrid(null)
    setEditorMode('reserve')
    setEditorDate(null)
    setSaveSuccess(false)
    setView('editor')
  }

  async function openEditGrid(grid, mode, date = null) {
    setEditingGrid(grid)
    setEditorMode(mode)
    setEditorDate(date)
    setDifficulty(grid.difficulty ?? 'facile')
    setClues({ top: grid.clue_top ?? '', right: grid.clue_right ?? '', bottom: grid.clue_bottom ?? '', left: grid.clue_left ?? '' })
    setSaveSuccess(false)
    setView('editor')
    // Les cartes (solution) sont servies par get-solution (admin = autorisé).
    const { data: sol } = await supabase.functions.invoke('get-solution', { body: { grid_id: grid.id, player_id: user.id } })
    const p = {}
    for (const gc of sol?.cards ?? []) {
      if (gc.position >= 0 && gc.position <= 3 && gc.orienta_word_cards) {
        p[gc.position] = { card: gc.orienta_word_cards, rotation: gc.rotation ?? 0, colorIndex: gc.position }
      }
    }
    setPlacements(p)
  }

  // ── Éditeur : pioche de cartes ──
  function getExcludedIds(exceptPos = null) {
    const ids = new Set()
    for (const [pos, item] of Object.entries(placements)) {
      if (item && parseInt(pos) !== exceptPos) ids.add(item.card.id)
    }
    return ids
  }

  async function handleRefreshAll() {
    setIsRefreshing(true)
    const p = {}
    sample(cardPool, 4).forEach((card, i) => { p[i] = { card, rotation: 0, colorIndex: i } })
    setPlacements(p)
    setClues({ top: '', right: '', bottom: '', left: '' })
    setIsRefreshing(false)
  }

  function handleRefreshSlot(pos) {
    setRefreshingSlot(pos)
    const card = pickRandom(cardPool, getExcludedIds(pos))
    if (card) setPlacements(prev => ({ ...prev, [pos]: { card, rotation: 0, colorIndex: pos } }))
    setRefreshingSlot(null)
  }

  // ── Éditeur : drag-and-drop des cartes dans les slots ──
  function handleDragStart({ active }) {
    for (const [pos, item] of Object.entries(placements)) {
      if (item && `placed-${item.card.id}-${pos}` === active.id) { setActiveCard({ ...item, fromSlot: parseInt(pos) }); return }
    }
  }

  function handleDragEnd({ active, over }) {
    setActiveCard(null)
    if (!over) return
    const targetSlot = parseInt(over.id.replace('slot-', ''), 10)
    if (isNaN(targetSlot)) return
    for (const [pos, item] of Object.entries(placements)) {
      if (item && `placed-${item.card.id}-${pos}` === active.id) {
        const sourceSlot = parseInt(pos)
        if (sourceSlot === targetSlot) return
        const existing = placements[targetSlot]
        setIsSwappingSlots(true)
        setPlacements(prev => ({ ...prev, [targetSlot]: item, [sourceSlot]: existing ?? null }))
        setTimeout(() => setIsSwappingSlots(false), 50)
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

  // ── Éditeur : sauvegarde ──
  async function handleSave() {
    const allFilled = Object.values(placements).every(v => v !== null)
    const cluesOk = clues.top && clues.right && clues.bottom && clues.left
    if (!allFilled || !cluesOk || !user) return
    setIsSaving(true)

    const placementRows = Object.entries(placements).map(([pos, item]) => ({
      card_id: item.card.id, position: parseInt(pos), rotation: item.rotation,
    }))

    const action = editorMode === 'reserve' ? 'save-reserve-grid' : 'save-daily-grid'
    const payload = editorMode === 'reserve'
      ? { admin_secret: getAdminSecret(), action, grid_id: editingGrid?.id, difficulty, clues, placements: placementRows }
      : { admin_secret: getAdminSecret(), action, creator_id: user.id, date: editorDate, grid_id: editingGrid?.id, clues, placements: placementRows }

    const { data, error } = await supabase.functions.invoke('admin', { body: payload })
    setIsSaving(false)
    if (error || !data || data.error) {
      if (data?.error === 'unauthorized') { clearAdminSecret(); alert('Mot de passe administrateur incorrect.') }
      else alert('Échec de l\'enregistrement.')
      return
    }
    setSaveSuccess(true)
    await refreshData()
    setView('list')
  }

  async function handleDelete(grid) {
    const label = grid.daily_date ? `la grille du ${fmtDate(grid.daily_date)}` : 'cette grille de réserve'
    if (!window.confirm(`Supprimer ${label} ?`)) return
    const { data, error } = await supabase.functions.invoke('admin', {
      body: { admin_secret: getAdminSecret(), action: 'delete-daily-grid', grid_id: grid.id },
    })
    if (error || !data || data.error) {
      if (data?.error === 'unauthorized') { clearAdminSecret(); alert('Mot de passe administrateur incorrect.') }
      else alert('Échec de la suppression.')
      return
    }
    await refreshData()
  }

  // ── Réordonnancement de la réserve (drag-and-drop) ──
  async function handleReserveDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const oldIndex = reserve.findIndex(g => g.id === active.id)
    const newIndex = reserve.findIndex(g => g.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(reserve, oldIndex, newIndex)
    setReserve(next) // optimiste
    const { error } = await supabase.functions.invoke('admin', {
      body: { admin_secret: getAdminSecret(), action: 'reorder-reserve', order: next.map(g => g.id) },
    })
    if (error) { alert('Échec du réordonnancement.'); refreshData() }
  }

  const allPlaced = Object.values(placements).every(v => v !== null)
  const cluesOk = clues.top && clues.right && clues.bottom && clues.left
  const upcoming = programme.filter(g => g.daily_date >= today)
  const past = programme.filter(g => g.daily_date < today).reverse()

  return (
    <div className="admin-page">
      <Header />

      <div className="admin-tabs">
        {[['grilles', '🗂 Grilles du jour'], ['idees', '💡 Boîte à idées'], ['stats', '📊 Stats']].map(([id, label]) => (
          <button key={id} type="button" className={`admin-tab${adminTab === id ? ' admin-tab--active' : ''}`} onClick={() => setAdminTab(id)}>{label}</button>
        ))}
      </div>

      {adminTab === 'idees' ? (
        <main className="admin-main admin-main--single"><SuggestionsAdmin /></main>
      ) : adminTab === 'stats' ? (
        <main className="admin-main admin-main--single"><StatsAdmin /></main>
      ) : view === 'editor' ? (
        // ───────────── ÉDITEUR ─────────────
        <main className="admin-main admin-main--single">
          <section className="admin-editor">
            <div className="admin-editor-header">
              <h2 className="admin-editor-title">
                {editorMode === 'reserve'
                  ? (editingGrid ? 'Modifier une grille de réserve' : 'Nouvelle grille de réserve')
                  : `Modifier la grille du ${fmtDate(editorDate)}`}
              </h2>
              <button className="btn-secondary" onClick={() => setView('list')} type="button">← Retour</button>
            </div>

            {editorMode === 'reserve' && (
              <div className="admin-diff-row">
                <span className="admin-diff-label">Difficulté :</span>
                {DIFFICULTIES.map(([id, label]) => (
                  <button key={id} type="button" className={`admin-diff-btn${difficulty === id ? ' admin-diff-btn--on' : ''}`} onClick={() => setDifficulty(id)}>{label}</button>
                ))}
              </div>
            )}

            <div className="admin-editor-body">
              <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <CloverWithInputs
                  placements={placements}
                  clues={clues}
                  setClues={setClues}
                  onRotate={handleRotate}
                  draggable
                  disableTransition={isSwappingSlots}
                  slotAction={pos => (
                    <button className="admin-slot-refresh" onClick={() => handleRefreshSlot(pos)} disabled={refreshingSlot === pos} type="button" title="Repiocher une carte">
                      {refreshingSlot === pos ? '…' : '🎲'}
                    </button>
                  )}
                />
                <DragOverlay dropAnimation={null}>
                  {activeCard && <WordCard id="overlay" card={activeCard.card} rotation={activeCard.rotation} colorIndex={activeCard.colorIndex ?? 0} draggable={false} />}
                </DragOverlay>
              </DndContext>
            </div>

            <div className="admin-editor-actions">
              <button className="btn-secondary admin-refresh-btn" onClick={handleRefreshAll} disabled={isRefreshing} type="button">
                {isRefreshing ? '…' : '↺ Toutes les cartes'}
              </button>
              <button className="btn-primary admin-save-btn" onClick={handleSave} disabled={isSaving || !allPlaced || !cluesOk} type="button">
                {isSaving ? '…' : saveSuccess ? '✓ Sauvegardé' : 'Enregistrer'}
              </button>
            </div>
            {!cluesOk && allPlaced && <p className="admin-hint">Remplis les 4 indices pour pouvoir enregistrer.</p>}
          </section>
        </main>
      ) : (
        // ───────────── LISTE : RÉSERVE + PROGRAMME ─────────────
        <main className="admin-main admin-main--single admin-reserve-page">
          {/* Droits de création (gagnants) — qui a gagné, et s'il a créé la grille (et quand) */}
          <section className="admin-grants">
            <h2 className="admin-editor-title">Droits de création (gagnants)</h2>
            <p className="admin-section-sub">Le 1er du classement de chaque jour gagne le droit de créer la grille du jour de J+3. Suis ici qui a gagné et s'il l'a fait.</p>
            {grants.length === 0 ? (
              <p className="admin-empty">Aucun droit de création pour l'instant — le rollover nocturne en crée un chaque nuit pour le vainqueur.</p>
            ) : (
              <ul className="grants-list">
                {grants.map(g => (
                  <li key={g.id} className={`grant-row grant-row--${g.status}`}>
                    <span className="grant-winner">🏆 {g.winner?.pseudo ?? '?'}</span>
                    <span className="grant-dates">gagné le {fmtDate(g.source_date)} → grille du <strong>{fmtDate(g.target_date)}</strong></span>
                    <span className={`grant-status grant-status--${g.status}`}>
                      {g.status === 'claimed'
                        ? `✓ Créée${g.created_grid?.created_at ? ' le ' + fmtDateTime(g.created_grid.created_at) : ''}`
                        : g.status === 'pending'
                          ? '⏳ En attente'
                          : '⌛ Expirée (non créée)'}
                    </span>
                    {g.created_grid?.id && (
                      <Link to={`/play/${g.created_grid.id}`} className="reserve-edit">Voir</Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Réserve */}
          <section className="admin-reserve">
            <div className="admin-section-head">
              <div>
                <h2 className="admin-editor-title">Réserve de grilles</h2>
                <p className="admin-section-sub">
                  Pool de secours sans date, piochée par priorité quand un gagnant ne crée pas sa grille.
                </p>
              </div>
              <button className="btn-primary" onClick={openNewReserve} type="button">＋ Nouvelle grille</button>
            </div>

            <div className={`admin-reserve-stock${reserve.length < RESERVE_LOW ? ' admin-reserve-stock--low' : ''}`}>
              {reserve.length} grille{reserve.length !== 1 ? 's' : ''} en réserve
              {reserve.length < RESERVE_LOW && ' — stock bas, ajoute des grilles !'}
            </div>

            {reserve.length === 0 ? (
              <p className="admin-empty">Aucune grille en réserve. Crée-en pour garantir une grille chaque jour.</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleReserveDragEnd}>
                <SortableContext items={reserve.map(g => g.id)} strategy={verticalListSortingStrategy}>
                  <ul className="reserve-list">
                    {reserve.map((g, i) => (
                      <ReserveRow key={g.id} grid={g} index={i} onEdit={(grid) => openEditGrid(grid, 'reserve')} onDelete={handleDelete} />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </section>

          {/* Programme (lecture + override) */}
          <section className="admin-programme">
            <h2 className="admin-editor-title">Programme</h2>
            <p className="admin-section-sub">Grille du jour et grilles programmées par les gagnants. Tu peux corriger ou supprimer (modération).</p>

            {upcoming.length === 0 ? (
              <p className="admin-empty">Aucune grille datée à venir — les jours seront comblés par la réserve.</p>
            ) : (
              <ul className="programme-list">
                {upcoming.map(g => (
                  <li key={g.id} className={`programme-row${g.daily_date === today ? ' programme-row--today' : ''}`}>
                    <span className="programme-date">
                      {g.daily_date === today ? "Aujourd'hui" : fmtDate(g.daily_date)}
                      {g.daily_status === 'scheduled' && <span className="programme-tag">🏆 gagnant</span>}
                    </span>
                    <span className="programme-clues">{cluesPreview(g)}</span>
                    <span className="programme-actions">
                      <Link to={`/play/${g.id}`} className="reserve-edit">Jouer</Link>
                      <button className="reserve-edit" onClick={() => openEditGrid(g, 'dated', g.daily_date)} type="button">Modifier</button>
                      <button className="reserve-del" onClick={() => handleDelete(g)} type="button">Suppr.</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {past.length > 0 && (
              <details className="programme-history">
                <summary>Historique récent ({past.length})</summary>
                <ul className="programme-list">
                  {past.map(g => (
                    <li key={g.id} className="programme-row programme-row--past">
                      <span className="programme-date">{fmtDate(g.daily_date)}</span>
                      <span className="programme-clues">{cluesPreview(g)}</span>
                      <span className="programme-actions">
                        <Link to={`/play/${g.id}`} className="reserve-edit">Jouer</Link>
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        </main>
      )}
    </div>
  )
}
