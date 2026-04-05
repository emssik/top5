import { useEffect, useState } from 'react'

export function useMinuteTick(): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [])
  return tick
}
