import { useState } from 'react'
import type { Project } from '../types'

interface Props {
  projects: Project[]
  onSave: (codes: Record<string, string>) => void
}

export default function ProjectCodeMigration({ projects, onSave }: Props) {
  const [codes, setCodes] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const p of projects) {
      initial[p.id] = p.code ?? ''
    }
    return initial
  })

  const projectsWithoutCode = projects.filter((p) => !p.code)

  const allCodes = Object.values(codes).filter((c) => c.length > 0)
  const hasDuplicates = new Set(allCodes).size !== allCodes.length

  const errors: Record<string, string | null> = {}
  for (const p of projectsWithoutCode) {
    const code = codes[p.id] ?? ''
    if (!code) {
      errors[p.id] = 'Required'
    } else if (code.length < 2) {
      errors[p.id] = 'Min 2 characters'
    } else if (!/^[A-Z0-9]+$/.test(code)) {
      errors[p.id] = 'Only A-Z, 0-9'
    } else if (allCodes.filter((c) => c === code).length > 1) {
      errors[p.id] = 'Duplicate'
    } else {
      errors[p.id] = null
    }
  }

  const canSave = projectsWithoutCode.every((p) => !errors[p.id]) && !hasDuplicates

  return (
    <div className="modal-overlay open" style={{ zIndex: 9999 }}>
      <div className="modal" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <h2>Set Project Codes</h2>
        <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 16 }}>
          Each project needs a unique code (2-6 characters) for task IDs.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {projectsWithoutCode.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name || 'Untitled'}
              </span>
              <input
                className="form-input"
                value={codes[p.id] ?? ''}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
                  setCodes((prev) => ({ ...prev, [p.id]: val }))
                }}
                placeholder="CODE"
                maxLength={6}
                style={{ width: 90, fontFamily: 'monospace', letterSpacing: '0.05em', textAlign: 'center' }}
              />
              {errors[p.id] && (
                <span style={{ color: '#ef4444', fontSize: 11, minWidth: 80 }}>{errors[p.id]}</span>
              )}
            </div>
          ))}
        </div>

        <div className="form-actions" style={{ marginTop: 20 }}>
          <button
            type="button"
            className="form-btn form-btn-primary"
            disabled={!canSave}
            onClick={() => onSave(codes)}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
