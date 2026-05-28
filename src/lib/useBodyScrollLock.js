import { useEffect } from 'react'

export function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [active])
}
