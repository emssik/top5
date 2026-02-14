import { formatTaskId, formatQuickTaskId } from '../../shared/taskId'

interface Props {
  taskNumber?: number
  projectCode?: string
  kind: 'quick' | 'pinned' | 'project'
}

export default function TaskIdBadge({ taskNumber, projectCode, kind }: Props) {
  const label = kind === 'quick'
    ? formatQuickTaskId(taskNumber)
    : formatTaskId(taskNumber, projectCode)

  if (!label) return null

  return (
    <span
      style={{
        fontFamily: 'monospace',
        fontSize: 10,
        opacity: 0.4,
        marginRight: 4,
        whiteSpace: 'nowrap'
      }}
    >
      {label}
    </span>
  )
}
