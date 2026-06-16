import { useRef, useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useGeneralChat } from '../../lib/useGeneralChat'
import RaidChat from '../raid/RaidChat'

// Bulle de chat général flottante (coin inférieur gauche), montée globalement.
//   - Desktop : panneau ancré en bas à gauche.
//   - Mobile  : panneau plein écran.
// C'est le MÊME canal que le SAS du RAID (canal général d'organisation), éphémère
// (les messages disparaissent au bout de 10 min).
export default function GeneralChat() {
  const { user } = useAuthStore()
  const [open, setOpen] = useState(false)
  const lastOpenRef = useRef(0)
  const { chat, sendChat, me } = useGeneralChat(user)

  if (!user) return null

  const openPanel = () => { lastOpenRef.current = Date.now(); setOpen(true) }
  const unread = !open && chat.some(m => (m.ts ?? 0) > lastOpenRef.current)

  return (
    <>
      {!open && (
        <button type="button" className="gchat-fab" onClick={openPanel} aria-label="Ouvrir la discussion générale">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          {unread && <span className="gchat-fab-dot" />}
        </button>
      )}
      {open && (
        <div
          className="gchat-panel"
          role="dialog"
          aria-label="Discussion générale"
          onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}
        >
          <RaidChat
            chat={chat}
            onSend={sendChat}
            me={me}
            title="Discussion générale"
            placeholder="Votre message…"
            emptyHint="Lancez la discussion — organisez-vous, proposez un RAID. Les messages s’effacent au bout de 10 min."
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </>
  )
}
