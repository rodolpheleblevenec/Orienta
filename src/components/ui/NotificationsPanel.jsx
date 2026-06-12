import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { useBodyScrollLock } from '../../lib/useBodyScrollLock'

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'à l\'instant'
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`
  return `il y a ${Math.floor(diff / 86400)}j`
}

// 'YYYY-MM-DD' → '14 juin' (les payloads grant stockent des dates calendaires)
function fmtDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

export default function NotificationsPanel({ onClose }) {
  useBodyScrollLock()
  const navigate = useNavigate()
  const { user, markNotifsRead } = useAuthStore()
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)

  function openNotif(link) {
    if (!link) return
    onClose()
    navigate(link)
  }

  useEffect(() => {
    if (!user) return
    supabase
      .from('orienta_notifications')
      .select('*')
      .eq('user_id', user.id)
      .neq('type', 'streak_danger')
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setNotifs(data ?? [])
        setLoading(false)
      })
    markNotifsRead()
  }, [user])

  return (
    <>
      {/* Catch-clic transparent (desktop) / voile sombre (mobile) — ferme au clic extérieur */}
      <div className="notif-backdrop" onClick={onClose} />
      <motion.div
        className="notif-panel"
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.15 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="notif-panel-header">
          <h2 className="notif-panel-title">Notifications</h2>
          <button className="notif-panel-close" onClick={onClose} type="button">✕</button>
        </div>

        <div className="notif-panel-body">
          {loading ? (
            <p className="notif-empty">Chargement…</p>
          ) : notifs.length === 0 ? (
            <p className="notif-empty">Aucune notification pour l'instant.</p>
          ) : (
            <ul className="notif-list">
              <AnimatePresence initial={false}>
                {notifs.map((n, i) => {
                  const type = n.type
                  let icon = '💬'
                  let text = null
                  let comment = null
                  let link = n.payload?.grid_id ? `/dashboard/${n.payload.grid_id}` : null

                  if (type === 'level_up') {
                    icon = '⭐'
                    text = <>Tu passes au niveau <strong>{n.payload.level} — {n.payload.level_name}</strong> !</>
                    link = '/profile'
                  } else if (type === 'play') {
                    icon = n.payload.success ? '🎉' : '🎮'
                    text = <><strong>{n.payload.player_pseudo ?? 'Quelqu\'un'}</strong> {n.payload.success ? 'a réussi' : 'a joué'} ta grille</>
                  } else if (type === 'upvote') {
                    icon = '👍'
                    text = <><strong>{n.payload?.player_pseudo ?? 'Quelqu\'un'}</strong> a recommandé ta grille</>
                  } else if (type === 'suggestion') {
                    icon = '💡'
                    text = <><strong>{n.payload?.player_pseudo ?? 'Quelqu\'un'}</strong> a proposé une idée</>
                    link = '/admin/daily'
                  } else if (type === 'comment') {
                    text = <><strong>{n.payload?.player_pseudo ?? 'Quelqu\'un'}</strong> a commenté ta grille</>
                    comment = n.payload?.comment
                  } else if (type === 'comment_reply') {
                    icon = '↩️'
                    text = <><strong>{n.payload?.creator_pseudo ?? 'Le créateur'}</strong> a répondu à ton message</>
                    comment = n.payload?.reply
                  } else if (type === 'grid_grant') {
                    icon = '🏆'
                    text = <>Tu as gagné la grille du <strong>{fmtDate(n.payload?.source_date)}</strong> ! À toi de créer la grille du jour du <strong>{fmtDate(n.payload?.target_date)}</strong>.</>
                    link = n.payload?.grant_id ? `/create?grant=${n.payload.grant_id}` : '/hub'
                  } else if (type === 'reserve_low') {
                    icon = '⚠️'
                    text = <>Réserve de grilles basse (<strong>{n.payload?.count ?? 0}</strong>). Pense à ajouter des grilles de secours.</>
                    link = '/admin/daily'
                  } else if (type === 'grant_expired') {
                    icon = '⌛'
                    text = <>Personne n'a créé la grille du <strong>{fmtDate(n.payload?.target_date)}</strong> à temps — comblée par la réserve.</>
                    link = '/admin/daily'
                  } else if (type === 'quest_completed') {
                    icon = '✅'
                    text = <>Quête accomplie&nbsp;! <strong>Récupère ta récompense</strong> dans tes quêtes.</>
                    link = '/hub'
                  } else if (type === 'grid_boosted') {
                    icon = '✨'
                    text = <>Un joueur a mis ta grille <strong>en avant</strong>&nbsp;!</>
                    link = n.payload?.grid_id ? `/dashboard/${n.payload.grid_id}` : '/hub'
                  } else if (type === 'jetons_gift') {
                    icon = '🎁'
                    text = <><strong>{n.payload?.from_pseudo ?? 'Quelqu\'un'}</strong> t'a offert <strong>🪙{n.payload?.amount ?? 0}</strong>&nbsp;!</>
                    link = '/hub'
                  } else {
                    text = <><strong>{n.payload?.player_pseudo ?? 'Quelqu\'un'}</strong> a interagi avec ta grille</>
                  }

                  return (
                    <motion.li
                      key={n.id}
                      className={`notif-item${n.read ? ' notif-item--read' : ''}${link ? ' notif-item--clickable' : ''}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={link ? () => openNotif(link) : undefined}
                      role={link ? 'button' : undefined}
                      tabIndex={link ? 0 : undefined}
                      onKeyDown={link ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNotif(link) }
                      } : undefined}
                    >
                      <div className="notif-icon">{icon}</div>
                      <div className="notif-content">
                        <p className="notif-text">{text}</p>
                        {comment && <p className="notif-comment">« {comment} »</p>}
                        <span className="notif-time">{timeAgo(n.created_at)}</span>
                      </div>
                      {link && (
                        <span className="notif-link" aria-hidden="true">→</span>
                      )}
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </motion.div>
    </>
  )
}
