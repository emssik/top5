import { useState } from 'react'
import type { Project } from '../types'
import { useProjects } from '../hooks/useProjects'

interface Props {
  project: Project
  onClose: () => void
}

export default function ProjectEditor({ project, onClose }: Props) {
  const { saveProject } = useProjects()
  const [form, setForm] = useState({
    name: project.name,
    description: project.description,
    deadline: project.deadline || '',
    vscode: project.launchers.vscode || '',
    iterm: project.launchers.iterm || '',
    obsidian: project.launchers.obsidian || '',
    browser: project.launchers.browser || ''
  })

  const handleSave = async () => {
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
    onClose()
  }

  const pickFolder = async (key: 'vscode' | 'iterm') => {
    const path = await window.api.pickFolder()
    if (path) setForm((f) => ({ ...f, [key]: path }))
  }

  const pickObsidianNote = async () => {
    const result = await window.api.pickObsidianNote()
    if (!result) return
    if (result.uri) {
      setForm((f) => ({ ...f, obsidian: result.uri }))
    } else {
      setForm((f) => ({ ...f, obsidian: result.path }))
    }
  }

  const textField = (label: string, key: keyof typeof form, placeholder: string) => (
    <div>
      <label className="block text-xs text-neutral-500 mb-1">{label}</label>
      <input
        type={key === 'deadline' ? 'date' : 'text'}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-200 text-sm placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500"
      />
    </div>
  )

  const pathField = (label: string, key: keyof typeof form, placeholder: string, onBrowse: () => void) => (
    <div>
      <label className="block text-xs text-neutral-500 mb-1">{label}</label>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          placeholder={placeholder}
          className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-200 text-sm placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500"
        />
        <button
          onClick={onBrowse}
          className="px-2.5 py-1.5 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-neutral-300 text-xs transition-colors flex-shrink-0"
        >
          Browse
        </button>
      </div>
    </div>
  )

  return (
    <div className="rounded-xl bg-neutral-900 border border-neutral-700 p-4">
      <div className="space-y-3">
        {textField('Project Name', 'name', 'My Project')}
        {textField('Description', 'description', 'Brief description...')}
        {textField('Deadline', 'deadline', '')}

        <div className="pt-2 border-t border-neutral-800">
          <p className="text-xs text-neutral-500 mb-2">Launchers</p>
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
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 text-sm transition-colors"
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
