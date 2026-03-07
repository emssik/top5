import { useState } from 'react'
import type { ProjectLink } from '../types'
import { openProjectLink } from '../utils/projects'

const LINK_TYPES = [
  { label: 'VS Code', placeholder: '/path/to/project' },
  { label: 'iTerm', placeholder: '/path/to/project' },
  { label: 'Obsidian', placeholder: 'vault name or obsidian:// URI' },
  { label: 'Browser', placeholder: 'https://...' },
  { label: 'Custom', placeholder: 'URL or path' }
]

interface Props {
  links: ProjectLink[]
  onSave: (links: ProjectLink[]) => void
  onClose: () => void
  projectName?: string
}

export default function TaskLinksPopover({ links, onSave, onClose, projectName }: Props) {
  const [items, setItems] = useState<ProjectLink[]>(links.length > 0 ? links : [])

  const updateItem = (index: number, patch: Partial<ProjectLink>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const addItem = () => {
    setItems((prev) => [...prev, { label: 'Browser', url: '' }])
  }

  return (
    <div className="task-links-popover" onClick={(e) => e.stopPropagation()}>
      <div className="task-links-header">
        <span>Task Links</span>
        <button className="task-links-close" onClick={onClose}>&times;</button>
      </div>
      {items.map((item, index) => (
        <div key={index} className="task-links-row">
          <select
            value={LINK_TYPES.find((t) => t.label === item.label) ? item.label : 'Custom'}
            onChange={(e) => updateItem(index, { label: e.target.value })}
          >
            {LINK_TYPES.map((t) => (
              <option key={t.label} value={t.label}>{t.label}</option>
            ))}
          </select>
          {(!LINK_TYPES.find((t) => t.label === item.label)) && (
            <input
              className="form-input"
              placeholder="Label"
              value={item.label}
              onChange={(e) => updateItem(index, { label: e.target.value })}
            />
          )}
          <input
            className="form-input"
            placeholder={LINK_TYPES.find((t) => t.label === item.label)?.placeholder ?? 'URL or path'}
            value={item.url}
            onChange={(e) => updateItem(index, { url: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') onSave(items) }}
          />
          <button className="task-links-open" onClick={() => openProjectLink(item, projectName)} title="Open link">▶</button>
          <button className="task-links-remove" onClick={() => removeItem(index)} title="Remove">&times;</button>
        </div>
      ))}
      <div className="task-links-actions">
        <button className="task-links-add" onClick={addItem}>+ Add link</button>
        <button className="task-links-save" onClick={() => onSave(items)}>Save</button>
      </div>
    </div>
  )
}
