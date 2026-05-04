import { useEffect, useRef, useState } from 'react'
import { pauseUntilIso } from '../utils/energyPause'

type Rating = 1 | 2 | 3

const ENERGY_LABELS: Record<Rating, string> = { 1: 'źle', 2: 'dobrze', 3: 'super' }
const MOOD_LABELS: Record<Rating, string> = { 1: 'dół', 2: 'ok', 3: 'super' }

function PopupIcons() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <symbol id="i-energy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2 L4 14 H11 L10 22 L20 9 H13 L13 2 Z" />
        </symbol>
        <symbol id="i-mood" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 14 Q12 17.5 16 14" />
          <circle cx="9" cy="10" r="0.6" fill="currentColor" />
          <circle cx="15" cy="10" r="0.6" fill="currentColor" />
        </symbol>
        <symbol id="i-hunger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 2 V10 M5 2 V7 Q5 9.2 7 9.5 V22" />
          <path d="M17 2 Q14 4 14 8 Q14 11 17 11 V22" />
        </symbol>
        <symbol id="i-coffee" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 9 H17 V14 Q17 19 10.5 19 Q4 19 4 14 Z" />
          <path d="M17 11 H19.5 Q21.5 11 21.5 13.5 Q21.5 16 19.5 16 H17" />
          <path d="M8 3 Q8 4.5 9 5.5 Q10 6.5 10 7.5" />
          <path d="M13 3 Q13 4.5 14 5.5" />
        </symbol>
      </defs>
    </svg>
  )
}

interface SegRowProps {
  iconHref: string
  options: readonly Rating[]
  labels: Record<Rating, string>
  value: Rating | null
  onPick: (r: Rating) => void
}

function SegRow({ iconHref, options, labels, value, onPick }: SegRowProps) {
  return (
    <div className="seg-row">
      <span className="row-icon">
        <svg>
          <use href={iconHref} />
        </svg>
      </span>
      <div className="seg">
        {options.map((r) => {
          const active = value === r
          const accent = active ? (r === 2 ? ' energy-mid' : r === 3 ? ' energy-good' : '') : ''
          return (
            <button key={r} className={`opt${active ? ' active' : ''}${accent}`} onClick={() => onPick(r)}>
              {labels[r]}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface ToggleProps {
  iconHref: string
  label: string
  value: boolean
  onToggle: () => void
}

function Toggle({ iconHref, label, value, onToggle }: ToggleProps) {
  return (
    <button className={`toggle${value ? ' on' : ''}`} onClick={onToggle}>
      <span className="left">
        <svg className="icon-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <use href={iconHref} />
        </svg>
        <span className="label-text">{label}</span>
      </span>
      <span className="switch" />
    </button>
  )
}

export default function EnergyPopup() {
  const [energy, setEnergy] = useState<Rating | null>(null)
  const [mood, setMood] = useState<Rating | null>(null)
  const [hungry, setHungry] = useState(false)
  const [hadCoffee, setHadCoffee] = useState(false)
  const [note, setNote] = useState('')
  const noteRef = useRef<HTMLTextAreaElement>(null)

  const ready = energy !== null && mood !== null

  const submit = () => {
    if (!ready) return
    window.api.energySubmit({ energy: energy!, mood: mood!, hungry, hadCoffee, note })
  }

  const skip = () => window.api.energySkip()

  const pauseFor = (kind: '1h' | '2h' | 'eod') => {
    window.api.energyPauseUntil(pauseUntilIso(kind))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const inTextarea = target.tagName === 'TEXTAREA'

      if (e.key === 'Escape') {
        e.preventDefault()
        skip()
        return
      }
      if (e.key === 'Enter') {
        if (inTextarea && !e.metaKey && !e.ctrlKey) return
        e.preventDefault()
        if (ready) submit()
        return
      }
      if (inTextarea) return

      if (energy === null) {
        if (e.key === '1' || e.key === '2' || e.key === '3') {
          e.preventDefault()
          setEnergy(Number(e.key) as Rating)
        }
        return
      }
      if (mood === null) {
        if (e.key === '1' || e.key === '2' || e.key === '3') {
          e.preventDefault()
          setMood(Number(e.key) as Rating)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [energy, mood])

  useEffect(() => {
    if (mood !== null && noteRef.current) {
      noteRef.current.focus()
    }
  }, [mood])

  return (
    <div className="pop">
      <PopupIcons />

      <div className="head">
        <h1>Jak się czujesz?</h1>
        <p>teraz, krótko</p>
      </div>

      <div className="seg-rows">
        <SegRow iconHref="#i-energy" options={[1, 2, 3]} labels={ENERGY_LABELS} value={energy} onPick={setEnergy} />
        <SegRow iconHref="#i-mood" options={[1, 2, 3]} labels={MOOD_LABELS} value={mood} onPick={setMood} />
      </div>

      <div className="toggle-pair">
        <Toggle iconHref="#i-hunger" label="głodny" value={hungry} onToggle={() => setHungry((v) => !v)} />
        <Toggle iconHref="#i-coffee" label="kawa <2h" value={hadCoffee} onToggle={() => setHadCoffee((v) => !v)} />
      </div>

      <textarea
        ref={noteRef}
        className="e-note"
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="opcjonalna notatka..."
      />

      <div className="foot">
        <span className="pause-label">pauza</span>
        <button className="pill" onClick={() => pauseFor('1h')}>1h</button>
        <button className="pill" onClick={() => pauseFor('2h')}>2h</button>
        <button className="pill" onClick={() => pauseFor('eod')}>do końca dnia</button>
        <button className="skip" onClick={skip}>skip</button>
        <button className="submit" onClick={submit} disabled={!ready}>Zapisz</button>
      </div>
    </div>
  )
}
