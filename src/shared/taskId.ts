export function formatTaskId(taskNumber?: number, projectCode?: string): string {
  if (taskNumber == null || !projectCode) return ''
  return `${projectCode}-${taskNumber}`
}

export function formatQuickTaskId(taskNumber?: number): string {
  if (taskNumber == null) return ''
  return `QT-${taskNumber}`
}

const sanitizeForFs = (s: string) => s.replace(/[/\\:*?"<>|]/g, '-').replace(/\.{2,}/g, '.').trim()

export function computeNotePath(taskBadge: string | undefined, taskTitle: string, projectName?: string): string {
  const prefix = taskBadge ? `${sanitizeForFs(taskBadge)} ` : ''
  const truncated = taskTitle.length > 40 ? taskTitle.slice(0, 40) + '\u2026' : taskTitle
  const safeName = `${prefix}${sanitizeForFs(truncated)}`
  const folderName = projectName ? sanitizeForFs(projectName) : 'QuickTasks'
  return `top5.storage/${folderName}/${safeName}`
}
