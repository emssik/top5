import { useEffect, useRef, useState } from 'react'
import { pauseUntilIso } from '../utils/energyPause'

type Rating = 1 | 2 | 3

const ENERGY_LABELS: Record<Rating, string> = { 1: 'źle', 2: 'dobrze', 3: 'super' }
const MOOD_LABELS: Record<Rating, string> = { 1: 'dół', 2: 'ok', 3: 'super' }

interface RatingRowProps {
  label: string
  value: Rating | null
  onPick: (r: Rating) => void
  labels: Record<Rating, string>
}

function RatingRow({ label, value, onPick, labels }: RatingRowProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-t-secondary w-[60px] shrink-0">{label}</span>
      <div className="flex gap-1.5">
        {([1, 2, 3] as const).map((r) => (
          <button
            key={r}
            onClick={() => onPick(r)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors min-w-[58px] ${
              value === r
                ? 'bg-emerald-600 text-white'
                : 'bg-surface/80 hover:bg-hover/80 text-t-heading'
            }`}
          >
            <span className="font-mono opacity-70 mr-1">{r}</span>
            {labels[r]}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function EnergyPopup() {
  const [energy, setEnergy] = useState<Rating | null>(null)
  const [mood, setMood] = useState<Rating | null>(null)
  const [hungry, setHungry] = useState<boolean | null>(null)
  const [note, setNote] = useState('')
  const noteRef = useRef<HTMLTextAreaElement>(null)

  const ready = energy !== null && mood !== null && hungry !== null

  const submit = () => {
    if (!ready) return
    window.api.energySubmit({ energy: energy!, mood: mood!, hungry: hungry!, note })
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
        return
      }
      if (hungry === null) {
        const k = e.key.toLowerCase()
        if (k === 'y' || k === 't') {
          e.preventDefault()
          setHungry(true)
        } else if (k === 'n' || e.key === ' ') {
          e.preventDefault()
          setHungry(false)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [energy, mood, hungry, ready])

  useEffect(() => {
    if (hungry !== null && noteRef.current) {
      noteRef.current.focus()
    }
  }, [hungry])

  return (
    <div className="h-screen flex flex-col p-4 rounded-xl bg-card/95 border border-border/50 select-none">
      <p className="text-[14px] text-t-primary font-semibold mb-3">Jak się czujesz?</p>

      <div className="flex flex-col gap-2 mb-3">
        <RatingRow label="Energia" value={energy} onPick={setEnergy} labels={ENERGY_LABELS} />
        <RatingRow label="Nastrój" value={mood} onPick={setMood} labels={MOOD_LABELS} />
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-t-secondary w-[60px] shrink-0">Głód</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setHungry(true)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors min-w-[58px] ${
                hungry === true ? 'bg-emerald-600 text-white' : 'bg-surface/80 hover:bg-hover/80 text-t-heading'
              }`}
            >
              <span className="font-mono opacity-70 mr-1">y</span>tak
            </button>
            <button
              onClick={() => setHungry(false)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors min-w-[58px] ${
                hungry === false ? 'bg-emerald-600 text-white' : 'bg-surface/80 hover:bg-hover/80 text-t-heading'
              }`}
            >
              <span className="font-mono opacity-70 mr-1">n</span>nie
            </button>
          </div>
        </div>
      </div>

      <textarea
        ref={noteRef}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="opcjonalna notatka..."
        rows={2}
        className="w-full text-[12px] text-t-primary bg-surface/60 border border-border/50 rounded-md px-2 py-1.5 mb-3 resize-none focus:outline-none focus:border-emerald-600/60 placeholder:text-t-secondary/60"
      />

      <div className="flex items-center gap-1.5 text-[10px] mt-auto">
        <span className="text-t-secondary mr-0.5">pauza:</span>
        <button onClick={() => pauseFor('1h')} className="px-2 py-0.5 rounded bg-surface/80 hover:bg-hover/80 text-t-heading">1h</button>
        <button onClick={() => pauseFor('2h')} className="px-2 py-0.5 rounded bg-surface/80 hover:bg-hover/80 text-t-heading">2h</button>
        <button onClick={() => pauseFor('eod')} className="px-2 py-0.5 rounded bg-surface/80 hover:bg-hover/80 text-t-heading">eod</button>
        <button onClick={skip} className="ml-auto px-2 py-0.5 rounded text-t-secondary hover:bg-hover/80">skip</button>
        <button
          onClick={submit}
          disabled={!ready}
          className={`px-3 py-1 rounded font-medium text-[11px] ${
            ready ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-surface/40 text-t-secondary/50 cursor-not-allowed'
          }`}
        >
          Zapisz ⏎
        </button>
      </div>
    </div>
  )
}
