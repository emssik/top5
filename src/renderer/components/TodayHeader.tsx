import { useEffect, useMemo, useState } from 'react'
import type { GameGateConfig } from '../types'

// Rendered OUTSIDE the scrollable .main (in Dashboard, above it) so the clock and
// the game-token bar stay pinned no matter how far the task list scrolls. Sticky
// inside .main proved unreliable in this nesting, so we pull it out of the scroll.

function TodayClock() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const label = useMemo(() => {
    const days = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota']
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return `${days[now.getDay()]}, ${time}`
    // re-render only when the displayed minute changes
  }, [now.getDay(), Math.floor(now.getTime() / 60000)])

  return <div className="today-clock">{label}</div>
}

function formatGameTime(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  return `${m}:${String(ss).padStart(2, '0')}`
}

// Gamified game-time gate: shows earned game-tokens and lets the user open/close
// a play session. Balance and burn are owned by main; this bar just reflects and
// counts down locally between refetches.
function GameTokenBar() {
  const [config, setConfig] = useState<GameGateConfig | null>(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    window.api.getGameGateConfig().then(setConfig).catch(() => {})
    const refetch = setInterval(() => {
      window.api.getGameGateConfig().then(setConfig).catch(() => {})
    }, 3000)
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      clearInterval(refetch)
      clearInterval(tick)
    }
  }, [])

  if (!config || !config.enabled) return null

  const sessionActive = config.sessionStartedAt != null
  let remaining = config.tokenBalanceSec
  if (sessionActive) {
    const started = Date.parse(config.sessionStartedAt!)
    if (!Number.isNaN(started)) remaining = Math.max(0, config.tokenBalanceSec - (now - started) / 1000)
  }

  const low = sessionActive && remaining <= 600
  const empty = !sessionActive && remaining <= 0

  const start = () => window.api.gameStartSession().then(setConfig).catch(() => {})
  const stop = () => window.api.gameStopSession().then(setConfig).catch(() => {})

  return (
    <div className={`game-token-bar${sessionActive ? ' playing' : ''}${low ? ' low' : ''}`}>
      <span className="game-token-icon">🎮</span>
      <span className="game-token-balance">{formatGameTime(remaining)}</span>
      {sessionActive ? (
        <button className="game-token-btn stop" onClick={stop}>Koniec</button>
      ) : empty ? (
        <span className="game-token-hint">zrób focus, żeby zagrać</span>
      ) : (
        <button className="game-token-btn play" onClick={start}>Graj</button>
      )}
    </div>
  )
}

export default function TodayHeader() {
  return (
    <div className="today-header-fixed">
      <TodayClock />
      <GameTokenBar />
    </div>
  )
}
