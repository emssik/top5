import { BrowserWindow, powerMonitor, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { IpcMain } from 'electron'
import { randomUUID } from 'crypto'
import {
  getEnergyTrackerConfig,
  saveEnergyTrackerConfig,
  appendEnergyCheckIn,
  isEnergyRating,
  notifyAllWindows
} from './store'
import type { EnergyCheckIn, EnergyTrackerConfig } from '../shared/types'

const IDLE_THRESHOLD_S = 120
const IDLE_RECHECK_MS = 60_000

let scheduledTimeout: ReturnType<typeof setTimeout> | null = null
let energyWindow: BrowserWindow | null = null

function clearScheduledTimeout(): void {
  if (scheduledTimeout) {
    clearTimeout(scheduledTimeout)
    scheduledTimeout = null
  }
}

function randomIntervalMs(config: EnergyTrackerConfig): number {
  const minMs = config.intervalMinMin * 60_000
  const maxMs = config.intervalMaxMin * 60_000
  if (maxMs <= minMs) return minMs
  return Math.round(minMs + Math.random() * (maxMs - minMs))
}

function pauseRemainingMs(config: EnergyTrackerConfig): number {
  if (!config.pausedUntil) return 0
  const remaining = Date.parse(config.pausedUntil) - Date.now()
  return Number.isFinite(remaining) && remaining > 0 ? remaining : 0
}

function showEnergyWindow(): void {
  if (energyWindow && !energyWindow.isDestroyed()) return

  const display = screen.getPrimaryDisplay()
  const { width: workWidth, height: workHeight, x: workX, y: workY } = display.workArea

  const popupWidth = 380
  const popupHeight = 320
  const x = workX + Math.round((workWidth - popupWidth) / 2)
  const y = workY + Math.round((workHeight - popupHeight) / 2)

  energyWindow = new BrowserWindow({
    width: popupWidth,
    height: popupHeight,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: true,
    roundedCorners: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  energyWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  energyWindow.setAlwaysOnTop(true, 'screen-saver')

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    energyWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#energy')
  } else {
    energyWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'energy' })
  }

  energyWindow.on('closed', () => {
    energyWindow = null
  })
}

function closeEnergyWindow(): void {
  if (energyWindow && !energyWindow.isDestroyed()) {
    energyWindow.close()
  }
  energyWindow = null
}

export function isEnergyWindowOpen(): boolean {
  return energyWindow !== null && !energyWindow.isDestroyed()
}

function tick(): void {
  scheduledTimeout = null
  const config = getEnergyTrackerConfig()
  if (!config.enabled) return

  const pauseMs = pauseRemainingMs(config)
  if (pauseMs > 0) {
    scheduledTimeout = setTimeout(tick, pauseMs)
    return
  }

  if (isEnergyWindowOpen()) {
    scheduledTimeout = setTimeout(tick, IDLE_RECHECK_MS)
    return
  }

  const idleSeconds = powerMonitor.getSystemIdleTime()
  if (idleSeconds >= IDLE_THRESHOLD_S) {
    scheduledTimeout = setTimeout(tick, IDLE_RECHECK_MS)
    return
  }

  showEnergyWindow()
  scheduleNext()
}

function scheduleNext(): void {
  if (scheduledTimeout) return
  const config = getEnergyTrackerConfig()
  if (!config.enabled) return
  scheduledTimeout = setTimeout(tick, randomIntervalMs(config))
}

export function startEnergyScheduler(): void {
  if (scheduledTimeout) return
  const config = getEnergyTrackerConfig()
  if (!config.enabled) return
  scheduleNext()
}

export function stopEnergyScheduler(): void {
  clearScheduledTimeout()
  closeEnergyWindow()
}

export function restartEnergyScheduler(): void {
  clearScheduledTimeout()
  startEnergyScheduler()
}

function buildCheckIn(payload: unknown): EnergyCheckIn | null {
  if (typeof payload !== 'object' || payload === null) return null
  const p = payload as { energy?: unknown; mood?: unknown; hungry?: unknown; note?: unknown }
  if (!isEnergyRating(p.energy) || !isEnergyRating(p.mood)) return null
  if (typeof p.hungry !== 'boolean') return null
  const result: EnergyCheckIn = {
    id: randomUUID().slice(0, 21),
    timestamp: new Date().toISOString(),
    energy: p.energy,
    mood: p.mood,
    hungry: p.hungry
  }
  if (typeof p.note === 'string' && p.note.trim().length > 0) {
    result.note = p.note.trim().slice(0, 500)
  }
  return result
}

export function registerEnergyHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('get-energy-tracker-config', () => getEnergyTrackerConfig())

  ipcMain.handle('save-energy-tracker-config', (_event, config: unknown) => {
    if (typeof config !== 'object' || config === null) return getEnergyTrackerConfig()
    const next = saveEnergyTrackerConfig(config as EnergyTrackerConfig)
    restartEnergyScheduler()
    notifyAllWindows()
    return next
  })

  ipcMain.handle('energy-pause-until', (_event, isoTimestamp: unknown) => {
    if (typeof isoTimestamp !== 'string') return getEnergyTrackerConfig()
    if (Number.isNaN(Date.parse(isoTimestamp))) return getEnergyTrackerConfig()
    const current = getEnergyTrackerConfig()
    const next = saveEnergyTrackerConfig({ ...current, pausedUntil: isoTimestamp })
    closeEnergyWindow()
    restartEnergyScheduler()
    notifyAllWindows()
    return next
  })

  ipcMain.handle('energy-resume', () => {
    const current = getEnergyTrackerConfig()
    const next = saveEnergyTrackerConfig({ ...current, pausedUntil: null })
    restartEnergyScheduler()
    notifyAllWindows()
    return next
  })

  ipcMain.handle('energy-skip', () => {
    closeEnergyWindow()
  })

  ipcMain.handle('energy-submit', (_event, payload: unknown) => {
    const checkIn = buildCheckIn(payload)
    if (!checkIn) return { error: 'validation' }
    appendEnergyCheckIn(checkIn)
    closeEnergyWindow()
    return { ok: true }
  })
}
