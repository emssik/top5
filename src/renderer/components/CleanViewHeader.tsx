import { useState, useEffect, useMemo } from 'react'
import { formatCheckInTime } from '../utils/checkInTime'
import { minutesFocusedToday } from '../utils/finishForToday'

export default function CleanViewHeader() {
  const [now, setNow] = useState(new Date())
  const [todayMinutes, setTodayMinutes] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const load = async () => setTodayMinutes(minutesFocusedToday(await window.api.getFocusCheckIns()))
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [])

  const dateLabel = useMemo(() => {
    const days = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota']
    const months = ['Stycznia', 'Lutego', 'Marca', 'Kwietnia', 'Maja', 'Czerwca', 'Lipca', 'Sierpnia', 'Września', 'Października', 'Listopada', 'Grudnia']
    return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`
  }, [now.getDay(), now.getDate(), now.getMonth()])

  const timeLabel = useMemo(() => {
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, [Math.floor(now.getTime() / 60000)])

  return (
    <div className="text-center mb-4">
      <div className="text-[22px] font-semibold" style={{ color: 'var(--cv-ink)' }}>{dateLabel}</div>
      <div className="text-[15px] mt-0.5" style={{ color: 'var(--cv-ink-faint)' }}>
        {timeLabel}{todayMinutes > 0 && <span className="ml-1.5">({formatCheckInTime(todayMinutes)})</span>}
      </div>
      <div className="mt-3 mx-auto w-full h-px" style={{ backgroundColor: 'var(--cv-ink-faint)', opacity: 0.33 }} />
    </div>
  )
}
