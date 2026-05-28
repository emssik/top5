// Legacy helper: strips the old "(✂N)" split prefix from a title so tasks
// created before the "finished for today" rework still render cleanly.
export function cleanSplitTitle(title: string): string {
  return title.replace(/^\(✂\d+\)\s*/, '')
}
