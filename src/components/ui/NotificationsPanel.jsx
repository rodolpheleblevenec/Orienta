import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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

export default function NotificationsPanel({ onClose }) {
  useBodyScrollLock()
  const { user, markNotifsRead } = useAuthStore()
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('orienta_notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setNotifs(data ?? [])
        setLoading(false)
      })
    markNotifsRead()
  }, [user])

  return (
    <div className="notif-backdrop" onClick={onClose}>
      <motion.div
        className="notif-panel"
        initial={{ opacity: 0, y: -8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
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
                  const type = n.payload?.type
                  let icon = '💬'
                  let text = null
                  let comment = null
                  let link = n.payload?.grid_id ? `/dashboard/${n.payload.grid_id}` : null

                  if (type === 'level_up') {
                    icon = '⭐'
                    text = <>Tu passes au niveau <strong>{n.payload.level} — {n.payload.level_name}</strong> !</>
                    link = null
                  } else if (type === 'play') {
                    icon = n.payload.success ? '🎉' : '🎮'
                    text = <><strong>{n.payload.player_pseudo ?? 'Quelqu\'un'}</strong> {n.payload.success ? 'a réussi' : 'a joué'} ta grille</>
                  } else if (type === 'streak_danger') {
                    icon = '🔥'
                    text = <>Ton streak de <strong>{n.payload.streak_current} jour{n.payload.streak_current > 1 ? 's' : ''}</strong> est en danger !</>
                    link = null
                  } else {
                    text = <><strong>{n.payload?.player_pseudo ?? 'Quelqu\'un'}</strong> a commenté ta grille</>
                    comment = n.payload?.comment
                  }

                  return (
                    <motion.li
                      key={n.id}
                      className={`notif-item${n.read ? ' notif-item--read' : ''}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <div className="notif-icon">{icon}</div>
                      <div className="notif-content">
                        <p className="notif-text">{text}</p>
                        {comment && <p className="notif-comment">« {comment} »</p>}
                        <span className="notif-time">{timeAgo(n.created_at)}</span>
                      </div>
                      {link && (
                        <Link to={link} className="notif-link" onClick={onClose}>→</Link>
                      )}
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </motion.div>
    </div>
  )
}
