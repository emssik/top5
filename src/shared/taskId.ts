export function formatTaskId(taskNumber?: number, projectCode?: string): string {
  if (taskNumber == null || !projectCode) return ''
  return `${projectCode}-${taskNumber}`
}

export function formatQuickTaskId(taskNumber?: number): string {
  if (taskNumber == null) return ''
  return `QT-${taskNumber}`
}
