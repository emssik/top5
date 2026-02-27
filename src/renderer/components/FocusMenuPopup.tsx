import { useEffect, useState } from 'react'

export default function FocusMenuPopup() {
  const [items, setItems] = useState<{ id: string; label: string; type?: 'separator' }[]>([])

  useEffect(() => {
    window.api.getFocusMenuItems().then(setItems)
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.close()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Apply theme
  useEffect(() => {
    window.api.getAppData().then((data) => {
      if (data.config.theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light')
      }
    })
  }, [])

  return (
    <div className="py-1.5 bg-clean-view h-screen overflow-hidden">
      {items.map((item, i) => {
        if (item.type === 'separator') {
          return <div key={`sep-${i}`} className="h-px bg-border/50 my-1 mx-2" />
        }
        return (
          <button
            key={item.id}
            onClick={() => window.api.focusMenuClick(item.id)}
            className="w-full text-left px-3 py-1.5 text-[12px] text-t-secondary hover:bg-hover hover:text-t-primary transition-colors flex items-center gap-2.5 border-none bg-transparent cursor-pointer"
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
