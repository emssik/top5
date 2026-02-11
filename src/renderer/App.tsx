import { useEffect } from 'react'
import { useProjects } from './hooks/useProjects'
import Dashboard from './components/Dashboard'
import FocusMode from './components/FocusMode'
import CompactBar from './components/CompactBar'
import CheckInPopup from './components/CheckInPopup'
import StatsView from './components/StatsView'
import ProjectEditor from './components/ProjectEditor'

export default function App() {
  const { loaded, loadData, config } = useProjects()
  const windowHash = window.location.hash
  const isCheckInWindow = windowHash === '#checkin'
  const isStatsWindow = windowHash === '#stats'
  const isNewProjectWindow = windowHash === '#new-project'
  const isAuxWindow = isCheckInWindow || isStatsWindow || isNewProjectWindow

  // Separate windows with hash routing — apply theme from stored config.
  useEffect(() => {
    if (!isAuxWindow) return

    let cancelled = false
    window.api.getAppData().then((data) => {
      if (cancelled) return
      if (data.config.theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light')
      } else {
        document.documentElement.removeAttribute('data-theme')
      }
    })

    return () => {
      cancelled = true
    }
  }, [isAuxWindow])

  useEffect(() => {
    if (isAuxWindow) return

    loadData()

    const cleanup = window.api.onReloadData(() => {
      loadData()
    })
    return cleanup
  }, [isAuxWindow, loadData])

  useEffect(() => {
    if (isAuxWindow) return

    const cleanup = window.api.onShortcutAction((data) => {
      if (data.action === 'exit-compact-mode') {
        const { config, saveConfig } = useProjects.getState()
        saveConfig({ ...config, compactMode: false })
      }
    })
    return cleanup
  }, [isAuxWindow])

  // Apply theme to <html> in the main app window.
  useEffect(() => {
    if (isAuxWindow) return

    if (config.theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
  }, [isAuxWindow, config.theme])

  if (isCheckInWindow) return <CheckInPopup />
  if (isStatsWindow) return <StatsView />
  if (isNewProjectWindow) return (
    <div className="h-screen bg-base text-t-primary p-6">
      <ProjectEditor />
    </div>
  )

  if (!loaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-base text-t-secondary">
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
