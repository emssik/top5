import { useState } from 'react'
import { nanoid } from 'nanoid'
import type { Project } from '../types'
import { useProjects } from '../hooks/useProjects'

interface Props {
  project?: Project
  onClose?: () => void
}

export default function ProjectEditor({ project, onClose }: Props) {
  const { saveProject } = useProjects()
  const isCreateMode = !project

  const [form, setForm] = useState({
    name: project?.name ?? '',
    description: project?.description ?? '',
    deadline: project?.deadline || '',
    vscode: project?.launchers.vscode || '',
    iterm: project?.launchers.iterm || '',
    obsidian: project?.launchers.obsidian || '',
    browser: project?.launchers.browser || ''
  })

  const handleCancel = () => {
    if (isCreateMode) {
      window.api.closeNewProjectWindow()
    } else {
      onClose?.()
    }
  }

  const handleSave = async () => {
    if (isCreateMode) {
      const newProject: Project = {
        id: nanoid(),
        name: form.name,
        description: form.description,
        order: 0,
        deadline: form.deadline || null,
        totalTimeMs: 0,
        timerStartedAt: null,
        launchers: {
          vscode: form.vscode || null,
          iterm: form.iterm || null,
          obsidian: form.obsidian || null,
          browser: form.browser || null
        },
        tasks: [],
        archivedAt: null,
        suspendedAt: null
      }
      await window.api.saveProject(newProject)
      window.api.closeNewProjectWindow()
    } else {
      await saveProject({
        ...project,
        name: form.name,
        description: form.description,
        deadline: form.deadline || null,
        launchers: {
          vscode: form.vscode || null,
          iterm: form.iterm || null,
          obsidian: form.obsidian || null,
          browser: form.browser || null
        }
      })
      onClose?.()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      handleSave()
    }
  }

  const pickFolder = async (key: 'vscode' | 'iterm') => {
    const path = await window.api.pickFolder()
    if (path) setForm((f) => ({ ...f, [key]: path }))
  }

  const pickObsidianNote = async () => {
    const result = await window.api.pickObsidianNote()
    if (!result) return
    if (result.uri) {
      setForm((f) => ({ ...f, obsidian: result.uri! }))
    } else {
      setForm((f) => ({ ...f, obsidian: result.path }))
    }
  }

  const textField = (label: string, key: keyof typeof form, placeholder: string) => (
    <div>
      <label className="block text-xs text-t-secondary mb-1">{label}</label>
      <input
        type={key === 'deadline' ? 'date' : 'text'}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-t-heading text-sm placeholder:text-t-muted focus:outline-none focus:border-t-secondary"
      />
    </div>
  )

  const pathField = (label: string, key: keyof typeof form, placeholder: string, onBrowse: () => void) => (
    <div>
      <label className="block text-xs text-t-secondary mb-1">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          placeholder={placeholder}
          className="w-full pl-3 pr-8 py-1.5 rounded-lg bg-surface border border-border text-t-heading text-sm placeholder:text-t-muted focus:outline-none focus:border-t-secondary"
        />
        <button
          onClick={onBrowse}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-t-muted hover:text-t-primary transition-colors"
          title="Browse"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        </button>
      </div>
    </div>
  )

  return (
    <div className="rounded-xl bg-card border border-border p-4" onKeyDown={handleKeyDown}>
      <div className="space-y-3">
        {textField('Project Name', 'name', 'My Project')}
        {textField('Description', 'description', 'Brief description...')}
        {textField('Deadline', 'deadline', '')}

        <div className="pt-2 border-t border-border-subtle">
          <p className="text-xs text-t-secondary mb-2">Launchers</p>
          <div className="grid grid-cols-2 gap-2">
            {pathField('VS Code Path', 'vscode', '/path/to/project', () => pickFolder('vscode'))}
            {pathField('Terminal Path', 'iterm', '/path/to/project', () => pickFolder('iterm'))}
            {pathField('Obsidian Note', 'obsidian', 'Pick a note...', pickObsidianNote)}
            {textField('Browser URL', 'browser', 'https://...')}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button
          onClick={handleCancel}
          className="px-3 py-1.5 rounded-lg text-t-secondary hover:text-t-heading text-sm transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  )
}
