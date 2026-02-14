import { useMemo, useState } from 'react'
import { nanoid } from 'nanoid'
import type { Project, ProjectColor, ProjectLink } from '../types'
import { useProjects } from '../hooks/useProjects'
import {
  PROJECT_COLORS,
  assignMissingProjectColors,
  firstAvailableProjectColor,
  normalizeProject,
  normalizeProjectLinks,
  projectColorValue
} from '../utils/projects'

interface Props {
  project?: Project
  onClose?: () => void
}

interface FormState {
  name: string
  description: string
  color: ProjectColor
  links: ProjectLink[]
  code: string
}

function createDefaultLink(): ProjectLink {
  return { label: '', url: '' }
}

export default function ProjectEditor({ project, onClose }: Props) {
  const { projects, config, saveProject, archiveProject } = useProjects()
  const isCreateMode = !project

  const normalizedProjects = useMemo(() => assignMissingProjectColors(projects), [projects])
  const defaultColor = useMemo(() => {
    if (project?.color) return project.color
    return firstAvailableProjectColor(normalizedProjects)
  }, [normalizedProjects, project?.color])

  const [form, setForm] = useState<FormState>({
    name: project?.name ?? '',
    description: project?.description ?? '',
    color: defaultColor,
    links: project ? normalizeProjectLinks(project) : [],
    code: project?.code ?? ''
  })

  const codeError = (() => {
    const code = form.code.trim()
    if (!code) return null
    if (code.length < 2) return 'Min 2 characters'
    if (code.length > 6) return 'Max 6 characters'
    if (!/^[A-Z0-9]+$/.test(code)) return 'Only A-Z, 0-9'
    const duplicate = projects.some((p) => p.code === code && p.id !== project?.id)
    if (duplicate) return 'Code already used'
    return null
  })()

  const handleCancel = () => {
    onClose?.()
  }

  const handleSave = async () => {
    const trimmedName = form.name.trim()
    const trimmedCode = form.code.trim() || undefined
    if (trimmedCode && codeError) return
    const normalizedLinks = form.links
      .map((link) => ({ label: link.label.trim(), url: link.url.trim() }))
      .filter((link) => link.label.length > 0 && link.url.length > 0)

    if (isCreateMode) {
      const activeCount = normalizedProjects.filter((item) => !item.archivedAt && !item.suspendedAt).length
      const activeLimit = config.activeProjectsLimit ?? 5
      const overLimit = activeCount >= activeLimit

      const newProject: Project = normalizeProject({
        id: nanoid(),
        name: trimmedName,
        description: form.description.trim(),
        order: 0,
        deadline: null,
        totalTimeMs: 0,
        timerStartedAt: null,
        launchers: {
          vscode: null,
          iterm: null,
          obsidian: null,
          browser: null
        },
        links: normalizedLinks,
        color: form.color,
        code: trimmedCode,
        tasks: [],
        archivedAt: null,
        suspendedAt: overLimit ? new Date().toISOString() : null
      })

      await window.api.saveProject(newProject)
      onClose?.()
      return
    }

    await saveProject(normalizeProject({
      ...project,
      name: trimmedName,
      description: form.description.trim(),
      links: normalizedLinks,
      color: form.color,
      code: trimmedCode
    }))

    onClose?.()
  }

  const handleArchive = async () => {
    if (!project) return
    if (!confirm(`Archive project "${project.name || 'Untitled Project'}"?`)) return
    await archiveProject(project.id)
    onClose?.()
  }

  const updateLink = (index: number, patch: Partial<ProjectLink>) => {
    setForm((prev) => ({
      ...prev,
      links: prev.links.map((link, i) => (i === index ? { ...link, ...patch } : link))
    }))
  }

  const removeLink = (index: number) => {
    setForm((prev) => ({ ...prev, links: prev.links.filter((_, i) => i !== index) }))
  }

  return (
    <div className="modal" style={{ width: 440 }}>
      <h2>{isCreateMode ? 'Add Project' : 'Edit Project'}</h2>

      <div className="form-group">
        <label>Name</label>
        <input
          className="form-input"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Project name"
        />
      </div>

      <div className="form-group">
        <label>Code</label>
        <input
          className="form-input"
          value={form.code}
          onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) }))}
          placeholder="e.g. TOP5"
          maxLength={6}
          style={{ width: 120, fontFamily: 'monospace', letterSpacing: '0.05em' }}
        />
        {codeError && <span style={{ color: '#ef4444', fontSize: 11, marginTop: 2 }}>{codeError}</span>}
      </div>

      <div className="form-group">
        <label>Description</label>
        <textarea
          className="form-input form-textarea"
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Brief description"
        />
      </div>

      <div className="form-group">
        <label>Color</label>
        <div className="form-color-picker">
          {PROJECT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`form-color-dot ${form.color === color ? 'selected' : ''}`}
              style={{ background: projectColorValue(color) }}
              onClick={() => setForm((prev) => ({ ...prev, color }))}
              title={color}
            />
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Quick Links</label>
        <div className="form-links-list">
          {form.links.map((link, index) => (
            <div key={`${index}-${link.label}`} className="form-link-row">
              <input
                className="form-input"
                value={link.label}
                onChange={(e) => updateLink(index, { label: e.target.value })}
                placeholder="Label"
              />
              <input
                className="form-input"
                value={link.url}
                onChange={(e) => updateLink(index, { url: e.target.value })}
                placeholder="URL / command"
              />
              <button
                type="button"
                className="form-link-remove"
                onClick={() => removeLink(index)}
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="form-add-link"
          onClick={() => setForm((prev) => ({ ...prev, links: [...prev.links, createDefaultLink()] }))}
        >
          + Add link
        </button>
      </div>

      <div className="form-actions">
        {!isCreateMode && (
          <button type="button" className="form-btn form-btn-danger" onClick={handleArchive}>Archive</button>
        )}
        <button type="button" className="form-btn form-btn-secondary" onClick={handleCancel}>Cancel</button>
        <button type="button" className="form-btn form-btn-primary" onClick={handleSave}>Save</button>
      </div>
    </div>
  )
}
