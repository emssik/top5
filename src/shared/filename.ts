export function isSafeFilename(filename: string): boolean {
  return filename.length > 0 && !filename.includes('\0') && !filename.includes('..') && !filename.includes('/') && !filename.includes('\\')
}
