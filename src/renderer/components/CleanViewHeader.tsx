import { useState, useEffect, useMemo } from 'react'

export default function CleanViewHeader() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
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
      <div className="text-[22px] font-semibold">{dateLabel}</div>
      <div className="text-[15px] opacity-40 mt-0.5">{timeLabel}</div>
      <div className="mt-3 mx-auto w-full h-px opacity-15" style={{ backgroundColor: 'currentColor' }} />
    </div>
  )
}
