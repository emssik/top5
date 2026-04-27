export type EnergyPauseKind = '1h' | '2h' | 'eod'

export function pauseUntilIso(kind: EnergyPauseKind): string {
  if (kind === 'eod') {
    const eod = new Date()
    eod.setHours(23, 59, 59, 999)
    return eod.toISOString()
  }
  const minutes = kind === '1h' ? 60 : 120
  return new Date(Date.now() + minutes * 60_000).toISOString()
}
