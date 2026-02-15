import type { RepeatingTask } from '../types'

interface Props {
  prompt: { repeatingTaskId: string; newTitle: string }
  repeatingTasks: RepeatingTask[]
  saveRepeatingTask: (rt: RepeatingTask) => Promise<void> | void
  onClose: () => void
}

export default function RepeatUpdateModal({ prompt, repeatingTasks, saveRepeatingTask, onClose }: Props) {
  const handleUpdate = async () => {
    const rt = repeatingTasks.find((t) => t.id === prompt.repeatingTaskId)
    if (rt) await saveRepeatingTask({ ...rt, title: prompt.newTitle })
    onClose()
  }

  return (
    <div
      className="modal-overlay open"
      tabIndex={-1}
      ref={(el) => el?.focus()}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'y' || e.key === 'Y') { e.preventDefault(); handleUpdate() }
        if (e.key === 'Escape' || e.key === 'n' || e.key === 'N') { e.preventDefault(); onClose() }
      }}
    >
      <div className="modal" style={{ width: 340, padding: '20px 24px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: 'var(--c-text-heading)' }}>
          Update repeating template?
        </div>
        <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 16 }}>
          Also change the title in the repeating task template?
        </div>
        <div className="form-actions" style={{ marginTop: 0 }}>
          <button className="form-btn form-btn-secondary" onClick={onClose}>No <kbd style={{ fontSize: 10, opacity: 0.5, marginLeft: 4 }}>N</kbd></button>
          <button className="form-btn form-btn-primary" onClick={handleUpdate}>Yes, update <kbd style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>Y</kbd></button>
        </div>
      </div>
    </div>
  )
}
