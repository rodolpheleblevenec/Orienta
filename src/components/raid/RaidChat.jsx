import { useState, useRef, useEffect } from 'react'
import { ORGANS } from '../../lib/raid'

// Couleur d'avatar déterministe à partir du pseudo (comme le panneau "en ligne" du hub).
function hueOf(s) {
  let h = 0
  for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) % 360
  return h
}

// Pastille de rôle tagguée par couleur (cohérent avec les cartes de rôle du lobby).
const ROLE_TAG = {
  oeil:        { color: 'var(--blue)',    background: 'var(--blue-soft)' },
  vigie:       { color: 'var(--blue)',    background: 'var(--blue-soft)' },
  cartographe: { color: 'var(--violet)',  background: 'var(--violet-soft)' },
  main:        { color: 'var(--green)',   background: 'var(--green-soft)' },
  timonier:    { color: 'var(--green)',   background: 'var(--green-soft)' },
  mecanicien:  { color: 'var(--teal-700)',background: 'var(--teal-soft)' },
  capitaine:   { color: 'var(--orange)',  background: 'var(--orange-soft)' },
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
      <div className="rchat-head">
        <svg className="rchat-head-ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
        <span className="rchat-head-title">Coordination</span>
        <span className="rchat-head-live"><i />temps réel</span>
      </div>
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
                    {org && <span className="rchat-role" style={!mine ? ROLE_TAG[m.role] : undefined}>{org.emoji} {org.label}</span>}
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
