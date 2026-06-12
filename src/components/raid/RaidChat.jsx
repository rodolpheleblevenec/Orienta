import { useState, useRef, useEffect } from 'react'

// Chat d'équipage (broadcast). Le moteur de la collaboration : l'info étant
// cachée par organe, c'est ici qu'on se coordonne.
export default function RaidChat({ chat, onSend, me }) {
  const [text, setText] = useState('')
  const endRef = useRef(null)
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [chat])

  function submit(e) {
    e.preventDefault()
    if (!text.trim()) return
    onSend(text)
    setText('')
  }

  return (
    <div className="raid-chat">
      <div className="raid-chat-head">💬 Coordination</div>
      <div className="raid-chat-log">
        {chat.length === 0 && <p className="raid-chat-empty">Parlez-vous : qui voit quoi, qui pose quoi…</p>}
        {chat.map((m, i) => (
          <div key={i} className={`raid-chat-msg${m.pseudo === me?.pseudo ? ' raid-chat-msg--me' : ''}`}>
            <span className="raid-chat-author">{m.pseudo || 'joueur'}</span>
            <span className="raid-chat-text">{m.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form className="raid-chat-form" onSubmit={submit}>
        <input
          className="raid-chat-input"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Message à l’équipage…"
          maxLength={240}
        />
        <button type="submit" className="raid-chat-send" disabled={!text.trim()}>↑</button>
      </form>
    </div>
  )
}
