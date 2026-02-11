import { useEffect, useState } from 'react'
import type { AppData } from '../types'

export default function CheckInPopup() {
  const [taskTitle, setTaskTitle] = useState('')
  const [projectName, setProjectName] = useState('')
  const [projectId, setProjectId] = useState('')
  const [taskId, setTaskId] = useState('')

  useEffect(() => {
    window.api.getAppData().then((data: AppData) => {
      const focusPid = data.config.focusProjectId ?? ''
      const focusTid = data.config.focusTaskId ?? ''
      setProjectId(focusPid)
      setTaskId(focusTid)

      if (focusPid === '__standalone__') {
        const qt = (data.quickTasks ?? []).find((t) => t.id === focusTid)
        setProjectName('Quick Task')
        setTaskTitle(qt?.title ?? '')
      } else {
        const project = data.projects.find((p) => p.id === focusPid)
        const task = project?.tasks.find((t) => t.id === focusTid)
        setProjectName(project?.name ?? '')
        setTaskTitle(task?.title ?? '')
      }
    })
  }, [])

  const handleResponse = (response: 'yes' | 'no' | 'a_little') => {
    window.api.saveFocusCheckIn({
      id: crypto.randomUUID(),
      projectId,
      taskId,
      timestamp: new Date().toISOString(),
      response
    })
    window.api.dismissCheckIn()
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center p-4 rounded-xl bg-card/95 border border-border/50">
      <p className="text-[11px] text-t-secondary mb-1">Ostatnie 15 min</p>
      <p className="text-[13px] text-t-primary font-medium text-center mb-4 leading-tight">
        Pracowałeś nad{' '}
        <span className="text-blue-400">{taskTitle || 'zadaniem'}</span>?
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => handleResponse('yes')}
          className="px-4 py-1.5 rounded-lg text-[12px] font-medium bg-emerald-600/80 hover:bg-emerald-500/80 text-white transition-colors"
        >
          Tak
        </button>
        <button
          onClick={() => handleResponse('a_little')}
          className="px-4 py-1.5 rounded-lg text-[12px] font-medium bg-amber-600/80 hover:bg-amber-500/80 text-white transition-colors"
        >
          Trochę
        </button>
        <button
          onClick={() => handleResponse('no')}
          className="px-4 py-1.5 rounded-lg text-[12px] font-medium bg-surface/80 hover:bg-hover/80 text-t-heading transition-colors"
        >
          Nie
        </button>
      </div>
    </div>
  )
}
