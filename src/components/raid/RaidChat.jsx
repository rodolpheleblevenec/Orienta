import { useState, useRef, useEffect } from 'react'
import { ORGANS } from '../../lib/raid'

// Couleur d'avatar déterministe à partir du pseudo (comme le panneau "en ligne" du hub).
function hueOf(s) {
  let h = 0
  for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) % 360
  return h
}

// Chat d'équipage (broadcast) — UI façon messagerie : avatars, bulles gauche/droite,
// rôle sous le pseudo, regroupement des messages consécutifs.
export default function RaidChat({ chat, onSend, me }) {
  const [text, setText] = useState('')
  const logRef = useRef(null)
  // Auto-défilement INTERNE au journal uniquement (on règle scrollTop du conteneur)
  // — surtout pas scrollIntoView, qui remonte aussi la fenêtre/page à chaque message.
  useEffect(() => { const el = logRef.current; if (el) el.scrollTop = el.scrollHeight }, [chat])

  function submit(e) {
    e.preventDefault()
    if (!text.trim()) return
    onSend(text)
    setText('')
  }

  return (
    <div className="rchat">
      <div className="rchat-head">💬 Coordination de l’équipage</div>
      <div className="rchat-log" ref={logRef}>
        {chat.length === 0 && <p className="rchat-empty">Parlez-vous : qui voit quoi, qui pose quoi, qui tourne…</p>}
        {chat.map((m, i) => {
          const mine = me?.user_id != null && m.user_id != null ? m.user_id === me.user_id : m.pseudo === me?.pseudo
          const org = m.role ? ORGANS[m.role] : null
          const prev = chat[i - 1]
          const grouped = prev && prev.pseudo === m.pseudo && (m.ts - prev.ts < 90000)
          return (
            <div key={i} className={`rchat-row${mine ? ' rchat-row--me' : ''}${grouped ? ' rchat-row--grouped' : ''}`}>
              {!mine && (
                <div className="rchat-ava" style={grouped ? { background: 'transparent' } : { background: `hsl(${hueOf(m.pseudo)} 52% 52%)` }}>
                  {grouped ? '' : (m.pseudo?.[0]?.toUpperCase() ?? '?')}
                </div>
              )}
              <div className="rchat-bubble">
                {!grouped && (
                  <div className="rchat-meta">
                    <span className="rchat-name">{mine ? 'Toi' : (m.pseudo || 'joueur')}</span>
                    {org && <span className="rchat-role">{org.emoji} {org.label}</span>}
                  </div>
                )}
                <div className="rchat-text">{m.text}</div>
              </div>
            </div>
          )
        })}
      </div>
      <form className="rchat-form" onSubmit={submit}>
        <input className="rchat-input" value={text} onChange={e => setText(e.target.value)} placeholder="Message à l’équipage…" maxLength={240} />
        <button type="submit" className="rchat-send" disabled={!text.trim()} aria-label="Envoyer">➤</button>
      </form>
    </div>
  )
}
