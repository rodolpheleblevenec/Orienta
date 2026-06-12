import { useEffect, useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useBodyScrollLock } from '../../lib/useBodyScrollLock'
import { FAMILY_LABEL } from '../../lib/shopCosmetics'

// Une ligne de quête : progression + récompense en jetons + action (récupérer).
function QuestRow({ q, onClaim, busy }) {
  const pct = q.target > 0 ? Math.min(100, Math.round((q.progress / q.target) * 100)) : 0
  return (
    <li className={`quest-row${q.completed ? ' quest-row--done' : ''}`}>
      <div className="quest-row-main">
        <div className="quest-row-head">
          <span className="quest-row-title">{q.title}</span>
          <span className="quest-reward">🪙 {q.reward_jetons}</span>
        </div>
        <p className="quest-row-desc">{q.description}</p>
        <div className="quest-bar" role="progressbar" aria-valuenow={q.progress} aria-valuemax={q.target}>
          <div className="quest-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="quest-progress-txt">{Math.min(q.progress, q.target)} / {q.target}</span>
      </div>
      <div className="quest-row-action">
        {q.claimed ? (
          <span className="quest-claimed">✓ Récupéré</span>
        ) : q.claimable ? (
          <button className="quest-claim-btn" type="button" disabled={busy} onClick={() => onClaim(q.progress_id)}>
            {busy ? '…' : <>Récupérer 🪙{q.reward_jetons}</>}
          </button>
        ) : (
          <span className="quest-pending">{pct}%</span>
        )}
      </div>
    </li>
  )
}

// Une ligne de boutique : acheter (unlock/consommable) ou équiper (cosmétique possédé).
function ShopRow({ item, jetons, ownedCount, onBuy, onEquip, busy }) {
  const affordable = jetons >= item.cost_jetons
  const isUnlock = item.kind === 'unlock'
  const equippable = isUnlock && !!item.payload?.slot   // les unlocks "fonctionnels" (ex. difficultés) ne s'équipent pas
  return (
    <li className={`shop-row${item.equipped ? ' shop-row--equipped' : ''}`}>
      <div className="shop-row-main">
        <div className="shop-row-head">
          <span className="shop-row-title">{item.title}</span>
          <span className="shop-cost">🪙 {item.cost_jetons}</span>
        </div>
        <p className="shop-row-desc">{item.description}</p>
        {ownedCount > 0 && <span className="shop-owned-tag">En stock : {ownedCount}</span>}
      </div>
      <div className="shop-row-action">
        {isUnlock && item.owned ? (
          equippable ? (
            item.equipped ? (
              <button className="shop-btn shop-btn--equipped" type="button" disabled={busy} onClick={() => onEquip(item.code, false)}>✓ Équipé</button>
            ) : (
              <button className="shop-btn shop-btn--equip" type="button" disabled={busy} onClick={() => onEquip(item.code, true)}>Équiper</button>
            )
          ) : (
            <span className="quest-claimed">✓ Possédé</span>
          )
        ) : (
          <button className="shop-btn shop-btn--buy" type="button" disabled={busy || !affordable} onClick={() => onBuy(item.code)}>
            {busy ? '…' : 'Acheter'}
          </button>
        )}
      </div>
    </li>
  )
}

// Modale jetons : onglet Quêtes (gagner) + onglet Boutique (dépenser).
// Ouverte depuis la pastille jetons du header. Rafraîchit tout à l'ouverture.
export default function QuestsModal({ onClose }) {
  useBodyScrollLock()
  const { user, quests, fetchQuests, claimQuest, shop, fetchShop, buyItem, equipItem, giftJetons } = useAuthStore()
  const [tab, setTab] = useState('quests')
  const [busyId, setBusyId] = useState(null)
  const [giftPseudo, setGiftPseudo] = useState('')
  const [giftAmount, setGiftAmount] = useState('')
  const [giftMsg, setGiftMsg] = useState(null)
  const [gifting, setGifting] = useState(false)
  const jetons = user?.jetons ?? 0
  const daily = quests?.daily ?? []
  const weekly = quests?.weekly ?? []
  const items = shop?.items ?? []
  const counters = shop?.counters ?? {}

  useEffect(() => { fetchQuests(); fetchShop() }, []) // recharge à l'ouverture

  async function handleClaim(progressId) {
    setBusyId(progressId)
    await claimQuest(progressId)
    setBusyId(null)
  }
  async function handleBuy(code) {
    setBusyId(code)
    await buyItem(code)
    setBusyId(null)
  }
  async function handleEquip(code, equip) {
    setBusyId(code)
    await equipItem(code, equip)
    setBusyId(null)
  }
  async function handleGift() {
    const amt = parseInt(giftAmount, 10)
    if (!giftPseudo.trim() || !Number.isFinite(amt) || amt <= 0) {
      setGiftMsg({ ok: false, text: 'Indique un pseudo et un montant valide.' }); return
    }
    if (amt > (user?.jetons ?? 0)) { setGiftMsg({ ok: false, text: 'Solde insuffisant.' }); return }
    setGifting(true)
    const res = await giftJetons(giftPseudo.trim(), amt)
    setGifting(false)
    if (res?.ok) {
      setGiftMsg({ ok: true, text: `🎁 Envoyé : 🪙${res.amount} à ${giftPseudo.trim()} !` })
      setGiftPseudo(''); setGiftAmount('')
    } else {
      const map = {
        recipient_not_found: 'Joueur introuvable.',
        self_gift: 'Tu ne peux pas t\'offrir des jetons.',
        insufficient_funds: 'Solde insuffisant.',
        recipient_invalid: 'Destinataire invalide.',
      }
      setGiftMsg({ ok: false, text: map[res?.error] ?? 'Échec de l\'envoi.' })
    }
  }

  // Articles boutique groupés par famille (ordre d'affichage stable).
  const families = ['cosmetic', 'convenience', 'social']
  const grouped = families
    .map(f => ({ family: f, items: items.filter(i => i.family === f) }))
    .filter(g => g.items.length > 0)

  return (
    <div className="streak-modal-backdrop" onClick={onClose}>
      <div className="streak-modal quests-modal" onClick={e => e.stopPropagation()}>
        <div className="streak-modal-header">
          <h2 className="streak-modal-title">🪙 {jetons} jeton{jetons !== 1 ? 's' : ''}</h2>
          <button className="streak-modal-close" onClick={onClose} type="button">✕</button>
        </div>

        <div className="jetons-tabs">
          <button type="button" className={`jetons-tab${tab === 'quests' ? ' jetons-tab--active' : ''}`} onClick={() => setTab('quests')}>Quêtes</button>
          <button type="button" className={`jetons-tab${tab === 'shop' ? ' jetons-tab--active' : ''}`} onClick={() => setTab('shop')}>Boutique</button>
        </div>

        {tab === 'quests' ? (
          daily.length === 0 && weekly.length === 0 ? (
            <p className="quests-modal-empty">Chargement de tes quêtes…</p>
          ) : (
            <>
              {daily.length > 0 && (
                <>
                  <h3 className="quest-group-title">Aujourd'hui</h3>
                  <ul className="quest-list">
                    {daily.map(q => (
                      <QuestRow key={q.progress_id} q={q} onClaim={handleClaim} busy={busyId === q.progress_id} />
                    ))}
                  </ul>
                </>
              )}
              {weekly.length > 0 && (
                <>
                  <h3 className="quest-group-title">Cette semaine</h3>
                  <ul className="quest-list">
                    {weekly.map(q => (
                      <QuestRow key={q.progress_id} q={q} onClaim={handleClaim} busy={busyId === q.progress_id} />
                    ))}
                  </ul>
                </>
              )}
            </>
          )
        ) : (
          <>
            {grouped.length === 0 ? (
              <p className="quests-modal-empty">Chargement de la boutique…</p>
            ) : (
              grouped.map(g => (
                <div key={g.family}>
                  <h3 className="quest-group-title">{FAMILY_LABEL[g.family] ?? g.family}</h3>
                  <ul className="quest-list">
                    {g.items.map(item => (
                      <ShopRow
                        key={item.code}
                        item={item}
                        jetons={jetons}
                        ownedCount={counters?.[item.payload?.counter] ?? 0}
                        onBuy={handleBuy}
                        onEquip={handleEquip}
                        busy={busyId === item.code}
                      />
                    ))}
                  </ul>
                </div>
              ))
            )}

            {/* Offrir des jetons (action sociale — hors catalogue achetable) */}
            <h3 className="quest-group-title">Offrir</h3>
            <div className="gift-block">
              <p className="gift-block-title">🎁 Offrir des jetons à un joueur</p>
              <div className="gift-block-row">
                <input
                  className="gift-input"
                  placeholder="Pseudo du joueur"
                  value={giftPseudo}
                  onChange={e => { setGiftPseudo(e.target.value); setGiftMsg(null) }}
                />
                <input
                  className="gift-input gift-input--amount"
                  type="number" min="1"
                  placeholder="🪙"
                  value={giftAmount}
                  onChange={e => { setGiftAmount(e.target.value); setGiftMsg(null) }}
                />
                <button className="shop-btn shop-btn--buy" type="button" disabled={gifting} onClick={handleGift}>
                  {gifting ? '…' : 'Offrir'}
                </button>
              </div>
              {giftMsg && (
                <p className={`gift-msg${giftMsg.ok ? ' gift-msg--ok' : ' gift-msg--err'}`}>{giftMsg.text}</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
