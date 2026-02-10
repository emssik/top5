import { useState, useEffect, useCallback } from 'react'

export function useTimer(totalTimeMs: number, timerStartedAt: string | null) {
  const [elapsed, setElapsed] = useState(totalTimeMs)

  useEffect(() => {
    if (!timerStartedAt) {
      setElapsed(totalTimeMs)
      return
    }

    const update = () => {
      const started = new Date(timerStartedAt).getTime()
      const now = Date.now()
      setElapsed(totalTimeMs + (now - started))
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [totalTimeMs, timerStartedAt])

  const formatTime = useCallback((ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, '0')}m`
    }
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
  }, [])

  return { elapsed, formatted: formatTime(elapsed) }
}
