import { useState } from 'react'

interface Props {
  projectId: string
  taskId: string
  onClose: () => void
}

export function MyccCommentPopover({ projectId, taskId, onClose }: Props) {
  const [comment, setComment] = useState('')

  const send = async () => {
    const result = await window.api.sendTaskToMyCC(projectId, taskId, comment.trim() || undefined)
    if (!result) {
      alert('Failed to send task to MyCC')
    }
    onClose()
  }

  return (
    <div className="mycc-comment-popover">
      <textarea
        className="mycc-comment-input"
        placeholder="Comment (optional)..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        autoFocus
        rows={3}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            send()
          }
          if (e.key === 'Escape') onClose()
        }}
      />
      <div className="mycc-comment-actions">
        <button className="mycc-comment-cancel" onClick={onClose}>Cancel</button>
        <button className="mycc-comment-send" onClick={send}>Send</button>
      </div>
    </div>
  )
}
