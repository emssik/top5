import { useEffect } from 'react'
import { useProjects } from './hooks/useProjects'
import Dashboard from './components/Dashboard'
import FocusMode from './components/FocusMode'
import CompactBar from './components/CompactBar'
import CheckInPopup from './components/CheckInPopup'

export default function App() {
  const { loaded, loadData, config } = useProjects()

  // Check-in popup is a separate window with #checkin hash
  if (window.location.hash === '#checkin') {
    return <CheckInPopup />
  }

  useEffect(() => {
    loadData()

    const cleanup = window.api.onReloadData(() => {
      loadData()
    })
    return cleanup
  }, [])

  useEffect(() => {
    const cleanup = window.api.onShortcutAction((data) => {
      if (data.action === 'exit-compact-mode') {
        const { config, saveConfig } = useProjects.getState()
        saveConfig({ ...config, compactMode: false })
      }
    })
    return cleanup
  }, [])

  if (!loaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-950 text-neutral-400">
        Loading...
      </div>
    )
  }

  if (config.compactMode) {
    return <CompactBar />
  }

  if (config.focusProjectId && config.focusTaskId) {
    return <FocusMode />
  }

  return <Dashboard />
}
