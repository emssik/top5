import { Notification } from 'electron'
import { execFile } from 'node:child_process'
import type { IpcMain } from 'electron'
import { getGameGateConfig, saveGameGateConfig, getAppData, notifyAllWindows } from './store'
import type { GameGateConfig } from '../shared/types'

/**
 * Gamified game-time gate.
 *
 * CrossOver (the only thing it runs is the game) stays killed unless the user
 * has "tokens" — game time earned from real focus sessions. Two states:
 *   - closed: no open session OR balance ≤ 0 OR focus is active → CrossOver is
 *     killed on sight, so the game can't come up.
 *   - open session: the user spent tokens to open the gate → CrossOver may run,
 *     tokens burn in real time; when they hit 0 the gate slams shut.
 *
 * Balance model (no per-tick disk writes): tokenBalanceSec is the *frozen*
 * balance. During an open session sessionStartedAt is set and the live balance
 * = tokenBalanceSec − elapsed. tokenBalanceSec is only decremented when the
 * session is frozen (stopped / burned out / focus started).
 */

const SESSION_TICK_MS = 5_000 // precise burn + warning while playing
const IDLE_TICK_MS = 10_000 // slower sweep to kill a game that tries to come up
const LOW_WARN_SEC = 600 // warn 10 min before tokens run out
// Two markers cover the whole bottle:
//  - 'Applications/CrossOver' → native macOS processes (main app, wineserver,
//    wine wrapper, Steam Menu Helper) whose path lives under ~/Applications.
//  - 'CX_GRAPHICS_BACKEND' → the Windows/wine processes (steamwebhelper.exe, the
//    game itself) whose command line is windowsy ("C:\...") and carries no macOS
//    path, but which all inherit this CrossOver env var. This is the marker that
//    catches the Steam helper "services" the path match alone would leave behind.
const GAME_PROCESS_MATCHES = ['Applications/CrossOver', 'CX_GRAPHICS_BACKEND']

let scheduledTimeout: ReturnType<typeof setTimeout> | null = null
let lowWarned = false
let lastTickAt = 0 // wall-clock of the previous tick — detects sleep/suspend gaps

function clearScheduledTimeout(): void {
  if (scheduledTimeout) {
    clearTimeout(scheduledTimeout)
    scheduledTimeout = null
  }
}

function isFocusActive(): boolean {
  return getAppData().config.focusTaskId != null
}

// Live balance in seconds: frozen balance minus time already spent this session.
function effectiveBalanceSec(cfg: GameGateConfig): number {
  if (!cfg.sessionStartedAt) return cfg.tokenBalanceSec
  const started = Date.parse(cfg.sessionStartedAt)
  if (Number.isNaN(started)) return cfg.tokenBalanceSec
  const elapsed = (Date.now() - started) / 1000
  // Clamp both ends: never below 0, never above the frozen balance (a backward
  // clock jump would otherwise make elapsed negative and inflate the balance).
  return Math.min(cfg.tokenBalanceSec, Math.max(0, cfg.tokenBalanceSec - elapsed))
}

// Kill every CrossOver/wine process. -f matches the full command line; each
// marker catches one half of the bottle (native macOS + windowsy wine procs).
// exit 1 = nothing running → ignored.
function killGame(): void {
  for (const match of GAME_PROCESS_MATCHES) {
    execFile('pkill', ['-f', match], () => {})
  }
}

function showLowWarning(remainingSec: number): void {
  const min = Math.max(1, Math.round(remainingSec / 60))
  try {
    new Notification({
      title: '🎮 Czas gry się kończy',
      body: `Zostało ~${min} min. Zapisz grę — potem CrossOver zostanie zamknięty.`
    }).show()
  } catch {
    // notifications may be unavailable — non-critical
  }
}

// Collapse an open session into a frozen balance (session end).
function freezeSession(cfg: GameGateConfig): void {
  const frozen = Math.round(effectiveBalanceSec(cfg))
  saveGameGateConfig({ ...cfg, tokenBalanceSec: frozen, sessionStartedAt: null })
  lowWarned = false
  notifyAllWindows()
}

function tick(): void {
  scheduledTimeout = null
  let cfg = getGameGateConfig()
  if (!cfg.enabled) return // loop is off

  const sessionActive = cfg.sessionStartedAt != null

  // Sleep/suspend guard: if far more than one tick elapsed since the last tick,
  // the app wasn't really running (system sleep, long stall) — don't burn that
  // dead time. Shift session start forward by the excess so the user isn't
  // charged for time they couldn't have been playing.
  const nowTs = Date.now()
  if (sessionActive && lastTickAt > 0 && cfg.sessionStartedAt) {
    const gap = nowTs - lastTickAt
    if (gap > SESSION_TICK_MS * 3) {
      const started = Date.parse(cfg.sessionStartedAt)
      if (!Number.isNaN(started)) {
        cfg = saveGameGateConfig({ ...cfg, sessionStartedAt: new Date(started + (gap - SESSION_TICK_MS)).toISOString() })
      }
    }
  }
  lastTickAt = nowTs

  // Focus and gaming are mutually exclusive — an active focus closes an open
  // session (so tokens don't burn while you're not playing) and blocks the game.
  if (isFocusActive()) {
    if (sessionActive) freezeSession(cfg)
    killGame()
    scheduleNext()
    return
  }

  if (sessionActive) {
    const remaining = effectiveBalanceSec(cfg)
    if (remaining <= 0) {
      freezeSession(cfg) // burned out → frozen at 0
      killGame()
    } else if (remaining <= LOW_WARN_SEC && !lowWarned) {
      lowWarned = true
      showLowWarning(remaining)
    }
    // gate open with tokens left → leave the game alone
  } else {
    killGame() // gate closed → game must stay dead
  }

  scheduleNext()
}

function scheduleNext(): void {
  if (scheduledTimeout) return
  const cfg = getGameGateConfig()
  if (!cfg.enabled) return
  const ms = cfg.sessionStartedAt ? SESSION_TICK_MS : IDLE_TICK_MS
  scheduledTimeout = setTimeout(tick, ms)
}

/** Open the gate: spend-mode on. Requires tokens and no active focus. */
export function startGameSession(): GameGateConfig {
  const cfg = getGameGateConfig()
  if (!cfg.enabled) return cfg
  if (cfg.sessionStartedAt) return cfg // already open
  if (isFocusActive()) return cfg // focus blocks gaming
  if (cfg.tokenBalanceSec <= 0) return cfg // nothing to spend
  lowWarned = false
  lastTickAt = Date.now() // fresh gap baseline for the new session
  const next = saveGameGateConfig({ ...cfg, sessionStartedAt: new Date().toISOString() })
  clearScheduledTimeout()
  scheduleNext()
  notifyAllWindows()
  return next
}

/** Close the gate: freeze remaining tokens for later and kill the game. */
export function stopGameSession(): GameGateConfig {
  const cfg = getGameGateConfig()
  if (cfg.sessionStartedAt) freezeSession(cfg)
  killGame()
  clearScheduledTimeout()
  scheduleNext()
  return getGameGateConfig()
}

/** Earn tokens from a finished focus session (called on focus stop). */
export function addGameTokens(focusSec: number): void {
  const cfg = getGameGateConfig()
  if (!cfg.enabled || focusSec <= 0) return
  const earned = Math.round(focusSec * cfg.earnRatio)
  if (earned <= 0) return
  saveGameGateConfig({ ...cfg, tokenBalanceSec: cfg.tokenBalanceSec + earned })
  notifyAllWindows()
}

export function startGameGate(): void {
  const cfg = getGameGateConfig()
  // Crash recovery: a session left open by a previous run means the app died
  // while the gate was open — the game may have run unmetered. Charge the full
  // elapsed time and close the gate.
  if (cfg.sessionStartedAt) {
    const frozen = Math.round(effectiveBalanceSec(cfg))
    saveGameGateConfig({ ...cfg, tokenBalanceSec: frozen, sessionStartedAt: null })
  }
  if (!getGameGateConfig().enabled) return
  clearScheduledTimeout()
  scheduleNext()
}

export function stopGameGate(): void {
  // Freeze an open session on graceful quit so the remaining balance is saved —
  // otherwise the next launch's crash-recovery would charge the whole time the
  // app was closed and wipe the balance.
  const cfg = getGameGateConfig()
  if (cfg.sessionStartedAt) freezeSession(cfg)
  clearScheduledTimeout()
}

export function restartGameGate(): void {
  clearScheduledTimeout()
  startGameGate()
}

export function registerGameGateHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('get-game-gate-config', () => getGameGateConfig())

  ipcMain.handle('game-set-enabled', (_event, enabled: unknown) => {
    const cfg = getGameGateConfig()
    const next = saveGameGateConfig({ ...cfg, enabled: !!enabled })
    restartGameGate()
    notifyAllWindows()
    return next
  })

  ipcMain.handle('game-start-session', () => startGameSession())
  ipcMain.handle('game-stop-session', () => stopGameSession())
}
