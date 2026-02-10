import type { FocusCheckIn } from '../types'

export function checkInMinutes(response: FocusCheckIn['response']): number {
  switch (response) {
    case 'yes': return 15
    case 'a_little': return 7
    case 'no': return 0
  }
}

export function calcTaskTime(checkIns: FocusCheckIn[], taskId: string): number {
  return checkIns
    .filter((c) => c.taskId === taskId)
    .reduce((sum, c) => sum + checkInMinutes(c.response), 0)
}

export function calcProjectTime(checkIns: FocusCheckIn[], projectId: string): number {
  return checkIns
    .filter((c) => c.projectId === projectId)
    .reduce((sum, c) => sum + checkInMinutes(c.response), 0)
}

export function formatCheckInTime(minutes: number): string {
  if (minutes === 0) return '0m'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }
  return `${mins}m`
}
