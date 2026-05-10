import { useEffect, useState } from 'react'
import { computeCycleRange, CYCLE_LENGTH_WEEKS } from '../../shared/cycle'

interface Props {
  cycleStart: string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function weekLabel(currentWeek: number): string {
  if (currentWeek === 0) return 'Cycle starts soon'
  if (currentWeek > CYCLE_LENGTH_WEEKS) return 'Cycle over'
  return `Week ${currentWeek} of ${CYCLE_LENGTH_WEEKS}`
}

/**
 * Self-contained 1Hz countdown. Owns its own ticking state so the rest of
 * CycleView (heavy task lists) doesn't re-render every second.
 */
export default function CycleClockBanner({ cycleStart }: Props) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const range = computeCycleRange(cycleStart, now)
  if (!range) return null

  const { currentWeek, msRemaining, start, end } = range
  const startDate = new Date(start + 'T00:00:00')
  const endDate = new Date(end + 'T00:00:00')
  const startLabel = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endLabel = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const safe = Math.max(0, msRemaining)
  const total = Math.floor(safe / 1000)
  const dd = pad(Math.floor(total / 86400))
  const hh = pad(Math.floor((total % 86400) / 3600))
  const mm = pad(Math.floor((total % 3600) / 60))
  const ss = pad(total % 60)

  return (
    <div className="cycle-clock-banner" title={`Cycle ${start} → ${end}`}>
      <div className="cycle-clock-week">{weekLabel(currentWeek)}</div>
      <div className="cycle-clock-time" aria-live="off">
        <span className="ccu"><span className="ccv">{dd}</span><span className="ccl">days</span></span>
        <span className="ccs">:</span>
        <span className="ccu"><span className="ccv">{hh}</span><span className="ccl">hours</span></span>
        <span className="ccs">:</span>
        <span className="ccu"><span className="ccv">{mm}</span><span className="ccl">minutes</span></span>
        <span className="ccs">:</span>
        <span className="ccu"><span className="ccv">{ss}</span><span className="ccl">seconds</span></span>
      </div>
      <div className="cycle-clock-end">{startLabel} → {endLabel}</div>
    </div>
  )
}
