import { useState } from 'react'

// Small transient popup shown by the focus blocker when a blocked app is hidden.
// Main creates/destroys the window and auto-closes it after a few seconds. The
// snooze button gives the app 3 minutes; while the item is on cooldown (after a
// previous snooze) the button is disabled and shows roughly how long is left.
export default function FocusBlockPopup() {
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
  const name = params.get('name') ?? 'Aplikacja'
  const cooldownMs = Number(params.get('cd') ?? '0') || 0
  const onCooldown = cooldownMs > 0
  const cooldownMin = Math.ceil(cooldownMs / 60000)
  // Guard against double-click: after the first click the window closes on success;
  // a second click would hit the cooldown and silently no-op.
  const [clicked, setClicked] = useState(false)
  const disabled = onCooldown || clicked

  return (
    <div
      className="w-screen h-screen flex items-center gap-3 px-4 rounded-xl bg-clean-view/95 border border-border/50"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <span className="text-[22px] flex-shrink-0">🚫</span>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[13px] font-semibold text-t-primary truncate">
          {name} zablokowana
        </span>
        <span className="text-[11px] text-t-muted">przez focus</span>
      </div>
      <button
        onClick={() => { if (!disabled) { setClicked(true); window.api.snoozeFocusApp(name) } }}
        disabled={disabled}
        className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors border-none ${
          disabled
            ? 'bg-stone-500/40 text-t-muted cursor-not-allowed'
            : 'bg-amber-500/90 hover:bg-amber-400 text-stone-900 cursor-pointer'
        }`}
        title={onCooldown ? 'Snooze chwilowo zablokowany' : 'Odblokuj na 3 minuty'}
      >
        {onCooldown ? `snooze za ~${cooldownMin} min` : 'Daj mi 3 min'}
      </button>
    </div>
  )
}
