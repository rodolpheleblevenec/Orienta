import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { LEVELS_COLLECTIVE, getLevelProgressCollective } from '../../lib/levels'
import { getCreature } from '../../lib/creatures'
import { motion } from 'framer-motion'
import Header from '../../components/ui/Header'
import FullLeaderboardModal from '../../components/ui/FullLeaderboardModal'

function getMedal(idx) {
  return ['🥇', '🥈', '🥉'][idx] ?? `${idx + 1}.`
}

export default function ClassementPage() {
  const { user } = useAuthStore()
  const [leaderboard, setLeaderboard] = useState([])
  const [userRank, setUserRank] = useState(null)
  const [loading, setLoading] = useState(true)
  const [collectiveProgress, setCollectiveProgress] = useState(null)
  const [showFullLeaderboard, setShowFullLeaderboard] = useState(false)

  useEffect(() => {
    if (!user) return
    const fetchData = async () => {
      setLoading(true)
      const [{ data: topPlayers }, { data: currentUser }, { data: colProgress }] = await Promise.all([
        supabase.from('orienta_users')
          .select('pseudo, xp')
          .order('xp', { ascending: false })
          .limit(10),
        supabase.from('orienta_users')
          .select('xp')
          .eq('id', user.id)
          .single(),
        supabase.from('orienta_collective_progress')
          .select('*')
          .eq('id', 1)
          .single(),
      ])

      setLeaderboard(topPlayers ?? [])
      setCollectiveProgress(colProgress)

      if (currentUser && !topPlayers?.some(p => p.pseudo === user.pseudo)) {
        const { count } = await supabase
          .from('orienta_users')
          .select('id', { count: 'exact' })
          .gt('xp', currentUser.xp)
        setUserRank({ pseudo: user.pseudo, xp: currentUser.xp, rank: (count ?? 0) + 1 })
      }
      setLoading(false)
    }
    fetchData()
  }, [user])

  const levelProgress = collectiveProgress ? getLevelProgressCollective(collectiveProgress.total_xp) : null
  const currentLevel = levelProgress?.currentLevel
  const nextLevel = levelProgress?.nextLevel
  const pct = levelProgress?.pct ?? 0
  const xpLeft = levelProgress?.xpLeft ?? 0
  const totalXp = collectiveProgress?.total_xp ?? 0
  const currentCreature = currentLevel ? getCreature(currentLevel.level) : null
  const upcomingLevels = currentLevel
    ? LEVELS_COLLECTIVE.filter(l => l.level > currentLevel.level).slice(0, 3)
    : []

  return (
    <div className="hub-page">
      <Header />
      <main className="hub-main">

        {/* ===== PARTIE 01 — PROGRESSION COLLECTIVE ===== */}
        <section className="hub-part">
          <div className="hub-part-head">
            <span className="hub-kick"><span className="hub-kick-num">01</span>Progression collective</span>
            <span className="hub-kick-rule" />
          </div>

          {collectiveProgress && currentLevel ? (
            <div className="clsmt-collective-hero">
              <div className="clsmt-collective-main">
                <div className="clsmt-collective-info">
                  <div className="clsmt-collective-creature">
                    <currentCreature.Component size={56} />
                  </div>
                  <div>
                    <p className="clsmt-collective-eyebrow">Niveau {currentLevel.level} · Communauté</p>
                    <h2 className="clsmt-collective-name">{currentLevel.name}</h2>
                    <p className="clsmt-collective-xp-val">{totalXp.toLocaleString()} XP collectifs</p>
                  </div>
                </div>
                <div className="clsmt-collective-bar-area">
                  <div className="clsmt-collective-bar-track">
                    <motion.div
                      className="clsmt-collective-bar-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1.2, ease: 'easeOut' }}
                    />
                  </div>
                  {nextLevel ? (
                    <p className="clsmt-collective-bar-hint">
                      <strong>{xpLeft.toLocaleString()} XP</strong> avant <strong>{nextLevel.name}</strong>
                    </p>
                  ) : (
                    <p className="clsmt-collective-bar-hint">Niveau maximum atteint !</p>
                  )}
                </div>
              </div>

              {upcomingLevels.length > 0 && (
                <div className="clsmt-upcoming-strip">
                  <p className="clsmt-upcoming-label">Prochains paliers</p>
                  <div className="clsmt-upcoming-list">
                    {upcomingLevels.map((level, i) => {
                      const creature = getCreature(level.level)
                      const xpNeeded = level.xp - totalXp
                      return (
                        <div key={level.level} className={`clsmt-upcoming-card${i === 0 ? ' clsmt-upcoming-card--next' : ''}`}>
                          <div className="clsmt-upcoming-icon-wrap">
                            <creature.Component size={30} />
                            <span className="clsmt-upcoming-lock">🔒</span>
                          </div>
                          <p className="clsmt-upcoming-level-num">Niveau {level.level}</p>
                          <p className="clsmt-upcoming-level-name">{level.name}</p>
                          <p className="clsmt-upcoming-xp">dans {xpNeeded.toLocaleString()} XP</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="hub-loading">
              <div className="grid-card-skeleton" style={{ height: 180 }} />
            </div>
          )}
        </section>

        {/* ===== PARTIE 02 — CLASSEMENT XP ===== */}
        <section className="hub-part hub-part-2">
          <div className="hub-part-head">
            <span className="hub-kick"><span className="hub-kick-num">02</span>Classement général XP</span>
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
              <>
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
                <div className="clsmt-panel-footer">
                  <button className="clsmt-voir-plus" onClick={() => setShowFullLeaderboard(true)} type="button">
                    Voir le classement complet →
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

      </main>

      {showFullLeaderboard && (
        <FullLeaderboardModal
          user={user}
          onClose={() => setShowFullLeaderboard(false)}
        />
      )}
    </div>
  )
}
