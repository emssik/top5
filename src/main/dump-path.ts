import { realpathSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { extname, join } from 'node:path'

const BLOCKED_EXTENSIONS = new Set([
  '.app', '.command', '.sh', '.tool', '.workflow', '.terminal',
  '.jar', '.fileloc', '.webloc', '.inetloc', '.pkg', '.mpkg'
])

// The path is untrusted (dump text can come from e-mail): only existing,
// non-executable regular files may reach shell.openPath.
export function openableDumpPath(raw: unknown, home: string = homedir()): string | null {
  if (typeof raw !== 'string' || raw.includes('\0')) return null
  let path: string
  if (raw.startsWith('/')) path = raw
  else if (raw.startsWith('~/')) path = join(home, raw.slice(2))
  else return null
  try {
    const real = realpathSync(path)
    const st = statSync(real)
    if (!st.isFile()) return null
    // ponytail: volumes without POSIX permissions (exFAT, some SMB shares) set x on every
    // file, so nothing opens from there; growth path: an extension allowlist for such volumes.
    if (st.mode & 0o111) return null
    if (BLOCKED_EXTENSIONS.has(extname(real).toLowerCase())) return null
    return real
  } catch {
    return null
  }
}
