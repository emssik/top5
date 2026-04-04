const RECENTLY_COMPLETED_MS = 60 * 60 * 1000 // 1 hour

export function isRecentlyCompleted(completedAt: string | null | undefined): boolean {
  if (!completedAt) return false
  return Date.now() - new Date(completedAt).getTime() < RECENTLY_COMPLETED_MS
}
