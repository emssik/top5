import { useEffect, useState } from 'react'
import type { AppData } from '../types'

export default function CheckInPopup() {
  const [taskTitle, setTaskTitle] = useState('')
  const [projectName, setProjectName] = useState('')
  const [projectId, setProjectId] = useState('')
  const [taskId, setTaskId] = useState('')

  useEffect(() => {
    window.api.getAppData().then((data: AppData) => {
      const project = data.projects.find((p) => p.id === data.config.focusProjectId)
      const task = project?.tasks.find((t) => t.id === data.config.focusTaskId)
      setProjectName(project?.name ?? '')
      setTaskTitle(task?.title ?? '')
      setProjectId(data.config.focusProjectId ?? '')
      setTaskId(data.config.focusTaskId ?? '')
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
    <div className="h-screen flex flex-col items-center justify-center p-4 rounded-xl bg-neutral-900/95 border border-neutral-700/50">
      <p className="text-[11px] text-neutral-400 mb-1">Ostatnie 15 min</p>
      <p className="text-[13px] text-neutral-100 font-medium text-center mb-4 leading-tight">
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
          className="px-4 py-1.5 rounded-lg text-[12px] font-medium bg-neutral-700/80 hover:bg-neutral-600/80 text-neutral-200 transition-colors"
        >
          Nie
        </button>
      </div>
    </div>
  )
}
