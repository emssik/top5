import { useEffect } from 'react'
import { useProjects } from './hooks/useProjects'
import Dashboard from './components/Dashboard'
import FocusMode from './components/FocusMode'
import CompactBar from './components/CompactBar'
import CheckInPopup from './components/CheckInPopup'
import StatsView from './components/StatsView'

export default function App() {
  const { loaded, loadData, config } = useProjects()

  // Separate windows with hash routing — apply theme from stored config
  if (window.location.hash === '#checkin' || window.location.hash === '#stats') {
    useEffect(() => {
      window.api.getAppData().then((data) => {
        if (data.config.theme === 'light') {
          document.documentElement.setAttribute('data-theme', 'light')
        }
      })
    }, [])

    if (window.location.hash === '#checkin') return <CheckInPopup />
    return <StatsView />
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

  // Apply theme to <html>
  useEffect(() => {
    if (config.theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
  }, [config.theme])

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
