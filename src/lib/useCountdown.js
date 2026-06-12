import { useEffect, useState } from 'react'

// Compte à rebours vers une cible (Date | chaîne ISO | timestamp ms).
// Renvoie { days, hours, minutes, seconds, total, done } et se rafraîchit
// chaque seconde. `total` est le nombre de ms restantes (borné à 0).
export function useCountdown(target) {
  const targetMs = target instanceof Date ? target.getTime() : new Date(target).getTime()
  const [total, setTotal] = useState(() => Math.max(0, targetMs - Date.now()))

  useEffect(() => {
    const tick = () => setTotal(Math.max(0, targetMs - Date.now()))
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [targetMs])

  const totalSec = Math.floor(total / 1000)
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
    total,
    done: total <= 0,
  }
}
