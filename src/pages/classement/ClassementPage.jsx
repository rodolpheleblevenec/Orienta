import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { LEVELS_COLLECTIVE, getLevelProgressCollective } from '../../lib/levels'
import { getCreature } from '../../lib/creatures'
import { motion } from 'framer-motion'
import Header from '../../components/ui/Header'
import CollectiveGauge from '../../components/ui/CollectiveGauge'

function getMedal(idx) {
  return ['🥇', '🥈', '🥉'][idx] ?? `${idx + 1}.`
}

export default function ClassementPage() {
  const { user } = useAuthStore()
  const [leaderboard, setLeaderboard] = useState([])
  const [userRank, setUserRank] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetchLeaderboard = async () => {
      setLoading(true)
      const [{ data: topPlayers }, { data: currentUser }] = await Promise.all([
        supabase.from('orienta_users')
          .select('pseudo, xp')
          .order('xp', { ascending: false })
          .limit(10),
        supabase.from('orienta_users')
          .select('xp')
          .eq('id', user.id)
          .single()
      ])

      setLeaderboard(topPlayers ?? [])

      if (currentUser && !topPlayers?.some(p => p.pseudo === user.pseudo)) {
        const { count } = await supabase
          .from('orienta_users')
          .select('id', { count: 'exact' })
          .gt('xp', currentUser.xp)
        setUserRank({ pseudo: user.pseudo, xp: currentUser.xp, rank: (count ?? 0) + 1 })
      }
      setLoading(false)
    }
    fetchLeaderboard()
  }, [user])

  return (
    <div className="hub-page">
      <Header />
      <main className="hub-main">

        {/* Progression collective */}
        <section className="hub-part">
          <div className="hub-part-head">
            <span className="hub-kick"><span className="hub-kick-num">01</span>Progression collective</span>
            <span className="hub-kick-rule" />
          </div>
          <div className="clsmt-gauge-wrap">
            <CollectiveGauge />
          </div>
        </section>

        {/* Classement XP */}
        <section className="hub-part hub-part-2">
          <div className="hub-part-head">
            <span className="hub-kick"><span className="hub-kick-num">02</span>Classement XP</span>
            <span className="hub-kick-rule" />
          </div>

          <div className="clsmt-panel">
            {loading ? (
              <div className="hub-loading">
                {[1,2,3,4,5].map(i => <div key={i} className="grid-card-skeleton" style={{ height: 56 }} />)}
              </div>
            ) : leaderboard.length === 0 ? (
              <p style={{ color: 'var(--ink-2)', textAlign: 'center', padding: '40px 0' }}>Aucun joueur encore.</p>
            ) : (
              <div className="clsmt-list">
                {leaderboard.map((player, idx) => {
                  const isMe = user?.pseudo === player.pseudo
                  return (
                    <motion.div
                      key={player.pseudo}
                      className={`clsmt-row${isMe ? ' clsmt-row--me' : ''}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                    >
                      <span className="clsmt-rank">{getMedal(idx)}</span>
                      <span className="clsmt-name">{player.pseudo}</span>
                      <span className="clsmt-xp">{(player.xp ?? 0).toLocaleString()} XP</span>
                    </motion.div>
                  )
                })}
                {userRank && (
                  <>
                    <div className="clsmt-sep">···</div>
                    <div className="clsmt-row clsmt-row--me">
                      <span className="clsmt-rank">#{userRank.rank}</span>
                      <span className="clsmt-name">{userRank.pseudo}</span>
                      <span className="clsmt-xp">{(userRank.xp ?? 0).toLocaleString()} XP</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  )
}
