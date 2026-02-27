import { useEffect } from 'react'
import { useProjects } from './hooks/useProjects'
import Dashboard from './components/Dashboard'
import FocusMode from './components/FocusMode'
import CheckInPopup from './components/CheckInPopup'
import FocusMenuPopup from './components/FocusMenuPopup'
import OperationLogView from './components/OperationLogView'
import QuickAddWindow from './components/QuickAddWindow'

export default function App() {
  const { loaded, loadData, config } = useProjects()
  const windowHash = window.location.hash
  const isFocusWindow = windowHash === '#focus'
  const isCheckInWindow = windowHash === '#checkin'
  const isFocusMenuWindow = windowHash === '#focus-menu'
  const isOperationLogWindow = windowHash.startsWith('#operation-log')
  const isQuickAddWindow = windowHash === '#quick-add'
  const isAuxWindow = isCheckInWindow || isFocusMenuWindow || isOperationLogWindow || isQuickAddWindow
  const isMainOrFocus = !isAuxWindow

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

  // Load data for main window and focus window (both use useProjects store)
  useEffect(() => {
    if (!isMainOrFocus) return

    loadData()

    const cleanup = window.api.onReloadData(() => {
      loadData()
    })
    return cleanup
  }, [isMainOrFocus, loadData])

  // Apply theme to <html> in the main app and focus windows.
  useEffect(() => {
    if (!isMainOrFocus) return

    if (config.theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
  }, [isMainOrFocus, config.theme])

  if (isFocusWindow) return loaded ? <FocusMode /> : null
  if (isCheckInWindow) return <CheckInPopup />
  if (isFocusMenuWindow) return <FocusMenuPopup />
  if (isOperationLogWindow) return <OperationLogView />
  if (isQuickAddWindow) return <QuickAddWindow />

  if (!loaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-base text-t-secondary">
        Loading...
      </div>
    )
  }

  return <Dashboard />
}
