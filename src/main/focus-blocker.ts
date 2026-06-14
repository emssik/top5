import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { homedir } from 'os'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { execFile } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import * as yaml from 'js-yaml'
import { is } from '@electron-toolkit/utils'
import type { IpcMain } from 'electron'

/**
 * Focus blocker.
 *
 * Soft-blocks distracting apps and Arc tabs while a focus session is active.
 * Mechanism: macOS Apple Events via `osascript` (Accessibility/Automation),
 * driven by a recursive setTimeout poll loop.
 *   - apps  → hide the frontmost process (System Events `set visible … false`)
 *   - sites → rewrite the active Arc tab to a local block page (served by a
 *             tiny localhost HTTP server) that offers a "give me 3 min" snooze.
 *
 * Config lives in ~/.mycc:
 *   - top5-focus-blocks.yaml  groups + metas (user/model-editable; never rewritten here)
 *   - top5-focus-tasks.yaml   defaultMeta + per-task selections (app-managed)
 *
 * Blocking is tied to the focus session: activated on focus start (with the
 * task's saved selection, or the default meta on first launch), cleared on stop.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Group {
  label: string
  sites: string[]
  apps: string[]
}

interface Meta {
  label: string
  groups: string[]
  sites: string[]
  apps: string[]
}

interface BlockConfig {
  groups: Record<string, Group>
  metas: Record<string, Meta>
}

export interface Selection {
  groups: string[]
  sites: string[]
  apps: string[]
}

interface TasksFile {
  defaultMeta: string | null
  byTask: Record<string, Selection>
}

// ---------------------------------------------------------------------------
// Constants / paths
// ---------------------------------------------------------------------------

const MYCC_DIR = join(homedir(), '.mycc')
const BLOCKS_FILE = join(MYCC_DIR, 'top5-focus-blocks.yaml')
const TASKS_FILE = join(MYCC_DIR, 'top5-focus-tasks.yaml')

const POLL_MS = 1500
const POPUP_MS = 5000
const SNOOZE_MS = 3 * 60_000
const COOLDOWN_STEP_MS = 5 * 60_000 // each snooze pushes the next one further out: count × step
const HTTP_PORT = 15056
const BLOCK_PAGE_PREFIX = `http://127.0.0.1:${HTTP_PORT}/blocked`

const SEED_CONFIG = `# top5 — konfiguracja focus blockera
# groups: nazwane grupy (sites = domeny, apps = nazwy procesów macOS).
# metas: zestawy łączące grupy + ewentualne dodatkowe sites/apps.
# Ten plik edytujesz ręcznie. Aplikacja go NIE nadpisuje.

groups:
  social:
    label: Social media
    sites: [x.com, twitter.com, facebook.com, instagram.com, tiktok.com, reddit.com, linkedin.com]
    apps: []
  linkedin:
    label: LinkedIn
    sites: [linkedin.com]
    apps: []
  gmail:
    label: Gmail
    sites: [mail.google.com]
    apps: []
  arc:
    label: Arc (cała przeglądarka)
    sites: []
    apps: [Arc]
  discord:
    label: Discord
    sites: []
    apps: [Discord]
  rozrywka:
    label: Rozrywka
    sites: [steampowered.com, steamcommunity.com]
    apps: [steam_osx, Steam Helper]

metas:
  wszystko:
    label: Wszystko
    groups: [social, gmail, discord, rozrywka]
    sites: []
    apps: []
  social-discord:
    label: Sociale + Discord
    groups: [social, discord]
    sites: []
    apps: []
  nic:
    label: Nic
    groups: []
    sites: []
    apps: []
`

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let activeTaskId: string | null = null
let activeTaskTitle: string | null = null
let activeSites: string[] = []
let activeApps: string[] = []
const snoozeUntil: Record<string, number> = {} // key: domain  OR  'app:' + processName — when current snooze ends
const snoozeCount: Record<string, number> = {} // how many times this item was snoozed this session
const cooldownUntil: Record<string, number> = {} // earliest time a new snooze is allowed for this item

let pollTimeout: ReturnType<typeof setTimeout> | null = null
let popupWindow: BrowserWindow | null = null
let popupCloseTimeout: ReturnType<typeof setTimeout> | null = null
let httpServer: Server | null = null
let serverListening = false // true only while the block-page server is actually bound
let popupAppName: string | null = null // which app the current popup is showing
let loopAlive = false // poll loop is running (guards against starting a 2nd loop)

// ---------------------------------------------------------------------------
// Config files
// ---------------------------------------------------------------------------

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

function loadBlockConfig(): BlockConfig {
  try {
    if (!existsSync(BLOCKS_FILE)) {
      mkdirSync(MYCC_DIR, { recursive: true })
      writeFileSync(BLOCKS_FILE, SEED_CONFIG, 'utf-8')
    }
    const parsed = yaml.load(readFileSync(BLOCKS_FILE, 'utf-8')) as Record<string, unknown> | null
    const groups: Record<string, Group> = {}
    const rawGroups = (parsed?.groups ?? {}) as Record<string, Record<string, unknown>>
    for (const [key, g] of Object.entries(rawGroups)) {
      groups[key] = {
        label: typeof g?.label === 'string' ? g.label : key,
        sites: asStringArray(g?.sites),
        apps: asStringArray(g?.apps)
      }
    }
    const metas: Record<string, Meta> = {}
    const rawMetas = (parsed?.metas ?? {}) as Record<string, Record<string, unknown>>
    for (const [key, m] of Object.entries(rawMetas)) {
      metas[key] = {
        label: typeof m?.label === 'string' ? m.label : key,
        groups: asStringArray(m?.groups),
        sites: asStringArray(m?.sites),
        apps: asStringArray(m?.apps)
      }
    }
    return { groups, metas }
  } catch (err) {
    console.error('[focus-blocker] config load failed:', err)
    return { groups: {}, metas: {} }
  }
}

function loadTasks(): TasksFile {
  try {
    if (!existsSync(TASKS_FILE)) return { defaultMeta: null, byTask: {} }
    const parsed = yaml.load(readFileSync(TASKS_FILE, 'utf-8')) as Record<string, unknown> | null
    const byTask: Record<string, Selection> = {}
    const raw = (parsed?.byTask ?? {}) as Record<string, Record<string, unknown>>
    for (const [taskId, sel] of Object.entries(raw)) {
      byTask[taskId] = {
        groups: asStringArray(sel?.groups),
        sites: asStringArray(sel?.sites),
        apps: asStringArray(sel?.apps)
      }
    }
    return {
      defaultMeta: typeof parsed?.defaultMeta === 'string' ? parsed.defaultMeta : null,
      byTask
    }
  } catch {
    return { defaultMeta: null, byTask: {} }
  }
}

function saveTasks(tasks: TasksFile): void {
  try {
    mkdirSync(MYCC_DIR, { recursive: true })
    writeFileSync(TASKS_FILE, yaml.dump(tasks, { lineWidth: 120, noRefs: true }), 'utf-8')
  } catch (err) {
    console.error('[focus-blocker] tasks save failed:', err)
  }
}

// ---------------------------------------------------------------------------
// Selection resolution
// ---------------------------------------------------------------------------

function resolveSelection(sel: Selection, config: BlockConfig): { sites: string[]; apps: string[] } {
  const sites = new Set<string>(sel.sites)
  const apps = new Set<string>(sel.apps)
  for (const gkey of sel.groups) {
    const g = config.groups[gkey]
    if (!g) continue
    g.sites.forEach((s) => sites.add(s))
    g.apps.forEach((a) => apps.add(a))
  }
  return { sites: [...sites], apps: [...apps] }
}

function defaultMetaKey(config: BlockConfig, tasks: TasksFile): string | null {
  if (tasks.defaultMeta && config.metas[tasks.defaultMeta]) return tasks.defaultMeta
  const first = Object.keys(config.metas)[0]
  return first ?? null
}

function expandMeta(metaKey: string | null, config: BlockConfig): Selection {
  const meta = metaKey ? config.metas[metaKey] : null
  if (!meta) return { groups: [], sites: [], apps: [] }
  return { groups: [...meta.groups], sites: [...meta.sites], apps: [...meta.apps] }
}

// selection saved for a task, or the default meta expanded (first launch)
function selectionForTask(taskId: string, config: BlockConfig, tasks: TasksFile): { selection: Selection; isSaved: boolean } {
  const saved = tasks.byTask[taskId]
  if (saved) return { selection: saved, isSaved: true }
  return { selection: expandMeta(defaultMetaKey(config, tasks), config), isSaved: false }
}

// ---------------------------------------------------------------------------
// osascript
// ---------------------------------------------------------------------------

function osa(script: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('osascript', ['-e', script], (err, stdout) => {
      resolve(err ? null : stdout.trim())
    })
  })
}

// Escape a string for safe interpolation inside a double-quoted AppleScript literal.
function escapeAppleScript(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

function matchedDomain(host: string, domains: string[]): string | null {
  for (const d of domains) {
    if (host === d || host.endsWith('.' + d)) return d
  }
  return null
}

// Grant a 3-min snooze for an item, unless it's still on cooldown. Each snooze
// pushes the next-allowed time further out (count × COOLDOWN_STEP_MS), so spamming
// the button gets progressively harder. Counters reset on focus stop.
function requestSnooze(key: string): { ok: boolean; cooldownMs: number } {
  const now = Date.now()
  const cd = cooldownUntil[key] ?? 0
  if (cd > now) return { ok: false, cooldownMs: cd - now }
  const count = (snoozeCount[key] ?? 0) + 1
  snoozeCount[key] = count
  snoozeUntil[key] = now + SNOOZE_MS
  cooldownUntil[key] = snoozeUntil[key] + count * COOLDOWN_STEP_MS
  return { ok: true, cooldownMs: 0 }
}

// How long until a new snooze is allowed for this item (0 = available now).
function cooldownRemaining(key: string): number {
  return Math.max(0, (cooldownUntil[key] ?? 0) - Date.now())
}

// ---------------------------------------------------------------------------
// HTTP server (block page + snooze)
// ---------------------------------------------------------------------------

function blockPageHtml(domain: string, returnUrl: string, taskTitle: string | null, cooldownMs: number): string {
  const safeDomain = domain.replace(/[<>"']/g, '')
  const returnJson = JSON.stringify(returnUrl)
  const domainJson = JSON.stringify(domain)
  const cleanTitle = (taskTitle ?? '').replace(/[<>]/g, '').trim()
  const taskBlock = cleanTitle
    ? `<div class="task"><div class="task-label">Teraz zajmij się</div><div class="task-name">${cleanTitle}</div></div>`
    : ''
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<title>Zablokowane</title><style>
  html,body{height:100%;margin:0}
  body{display:flex;align-items:center;justify-content:center;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    background:#1c1917;color:#e7e5e4}
  .card{text-align:center;max-width:520px;padding:48px 32px}
  .lock{font-size:52px;line-height:1;margin-bottom:20px}
  h1{font-size:24px;font-weight:600;margin:0 0 10px}
  .host{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#f59e0b;font-size:15px;margin-bottom:24px}
  .task{background:#292524;border:1px solid #44403c;border-radius:14px;padding:18px 22px;margin:0 0 24px}
  .task-label{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#a8a29e;margin-bottom:6px}
  .task-name{font-size:19px;font-weight:600;color:#fafaf9;line-height:1.35}
  p{font-size:14px;color:#a8a29e;margin:0 0 24px;line-height:1.5}
  button{font:inherit;font-size:14px;padding:10px 18px;border-radius:10px;border:none;cursor:pointer}
  .snooze{background:#f59e0b;color:#1c1917;font-weight:600}
  .snooze:hover{background:#fbbf24}
  .snooze:disabled{background:#57534e;color:#a8a29e;cursor:not-allowed}
  .small{font-size:12px;color:#78716c;margin-top:18px}
</style></head><body><div class="card">
  <div class="lock">🚫</div>
  <h1>Strona zablokowana przez focus</h1>
  <div class="host">${safeDomain}</div>
  ${taskBlock}
  <p>Wróć do roboty. Jak naprawdę musisz tu zajrzeć, masz 3 minuty.</p>
  <button class="snooze" id="snz">Daj mi 3 min</button>
  <div class="small" id="hint">po 3 minutach strona znów zostanie zablokowana</div>
</div>
<script>
  var btn = document.getElementById('snz');
  var hint = document.getElementById('hint');
  var timer = null;
  function fmt(ms){var s=Math.ceil(ms/1000);var m=Math.floor(s/60);var ss=s%60;return m+':'+(ss<10?'0':'')+ss;}
  function startCooldown(ms){
    if(timer){clearInterval(timer);timer=null;}
    if(ms<=0){btn.disabled=false;btn.textContent='Daj mi 3 min';hint.textContent='po 3 minutach strona znów zostanie zablokowana';return;}
    btn.disabled=true;
    var end=Date.now()+ms;
    function step(){
      var rem=end-Date.now();
      if(rem<=0){clearInterval(timer);timer=null;btn.disabled=false;btn.textContent='Daj mi 3 min';hint.textContent='po 3 minutach strona znów zostanie zablokowana';return;}
      btn.textContent='kolejny snooze za '+fmt(rem);
      hint.textContent='snooze chwilowo zablokowany';
    }
    step();
    timer=setInterval(step,1000);
  }
  btn.addEventListener('click',function(){
    if(btn.disabled) return;
    fetch('/snooze?domain='+encodeURIComponent(${domainJson}))
      .then(function(r){return r.json();})
      .then(function(d){ if(d&&d.ok){location.replace(${returnJson});} else {startCooldown((d&&d.cooldownMs)||0);} })
      .catch(function(){ location.replace(${returnJson}); });
  });
  startCooldown(${cooldownMs});
</script>
</body></html>`
}

function startHttpServer(): void {
  if (httpServer) return
  const server = createServer((req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${HTTP_PORT}`)
      if (url.pathname === '/snooze') {
        const domain = url.searchParams.get('domain') ?? ''
        const result = domain ? requestSnooze(domain) : { ok: false, cooldownMs: 0 }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
        return
      }
      if (url.pathname === '/blocked') {
        const domain = url.searchParams.get('domain') ?? ''
        const returnUrl = url.searchParams.get('url') ?? 'about:blank'
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(blockPageHtml(domain, returnUrl, activeTaskTitle, cooldownRemaining(domain)))
        return
      }
      res.writeHead(404)
      res.end()
    } catch {
      res.writeHead(500)
      res.end()
    }
  })
  server.on('listening', () => {
    serverListening = true
  })
  server.on('error', (err) => {
    console.error('[focus-blocker] http server error:', err)
    serverListening = false
    httpServer = null
  })
  server.on('close', () => {
    serverListening = false
  })
  server.listen(HTTP_PORT, '127.0.0.1')
  httpServer = server
}

function stopHttpServer(): void {
  if (httpServer) {
    httpServer.close()
    httpServer = null
  }
  serverListening = false
}

// ---------------------------------------------------------------------------
// App-block popup
// ---------------------------------------------------------------------------

function showBlockPopup(appName: string): void {
  if (popupCloseTimeout) {
    clearTimeout(popupCloseTimeout)
    popupCloseTimeout = null
  }

  // A popup for a DIFFERENT app is still showing → replace it so the name and
  // cooldown shown (and the snooze target) match the app actually blocked now.
  if (popupWindow && !popupWindow.isDestroyed() && popupAppName !== appName) {
    const old = popupWindow
    popupWindow = null
    popupAppName = null
    old.removeAllListeners('closed')
    old.destroy()
  }

  if (!popupWindow || popupWindow.isDestroyed()) {
    const display = screen.getPrimaryDisplay()
    const { width: workWidth, x: workX, y: workY } = display.workArea
    const popupWidth = 360
    const popupHeight = 110
    const x = workX + Math.round((workWidth - popupWidth) / 2)
    const y = workY + 28

    popupWindow = new BrowserWindow({
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

    popupWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    popupWindow.setAlwaysOnTop(true, 'screen-saver')

    const hash = `focus-block?name=${encodeURIComponent(appName)}&cd=${cooldownRemaining('app:' + appName)}`
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      popupWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#' + hash)
    } else {
      popupWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash })
    }

    popupWindow.on('closed', () => {
      popupWindow = null
      popupAppName = null
    })
    popupAppName = appName
  }

  popupCloseTimeout = setTimeout(closeBlockPopup, POPUP_MS)
}

function closeBlockPopup(): void {
  if (popupCloseTimeout) {
    clearTimeout(popupCloseTimeout)
    popupCloseTimeout = null
  }
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close()
  }
  popupWindow = null
  popupAppName = null
}

// ---------------------------------------------------------------------------
// Poll loop
// ---------------------------------------------------------------------------

async function tick(): Promise<void> {
  pollTimeout = null
  if (!activeTaskId) return

  const now = Date.now()
  const front = await osa(
    'tell application "System Events" to get name of first process whose frontmost is true'
  )

  if (front) {
    if (activeApps.includes(front) && (snoozeUntil['app:' + front] ?? 0) <= now) {
      await osa(`tell application "System Events" to set visible of process "${escapeAppleScript(front)}" to false`)
      showBlockPopup(front)
    } else if (front === 'Arc' && activeSites.length > 0 && serverListening) {
      const url = await osa('tell application "Arc" to get URL of active tab of front window')
      const host = url ? hostnameOf(url) : null
      if (host) {
        const domain = matchedDomain(host, activeSites)
        if (domain && (snoozeUntil[domain] ?? 0) <= now) {
          const page = `${BLOCK_PAGE_PREFIX}?domain=${encodeURIComponent(domain)}&url=${encodeURIComponent(url!)}`
          await osa(`tell application "Arc" to set URL of active tab of front window to "${page}"`)
        }
      }
    }
  }

  scheduleNext()
}

function scheduleNext(): void {
  if (pollTimeout || !activeTaskId) return
  pollTimeout = setTimeout(() => {
    void tick()
  }, POLL_MS)
}

// ---------------------------------------------------------------------------
// Activation (driven by focus session)
// ---------------------------------------------------------------------------

function applyActiveSelection(sel: Selection): void {
  const config = loadBlockConfig()
  const resolved = resolveSelection(sel, config)
  activeSites = resolved.sites
  activeApps = resolved.apps
}

export function onFocusStart(taskId: string | null, taskTitle?: string | null): void {
  if (!taskId) return
  const config = loadBlockConfig()
  const tasks = loadTasks()
  const { selection } = selectionForTask(taskId, config, tasks)
  // Fresh blocking session (initial start OR task switch) — drop any carried-over
  // snooze/cooldown counters so the new task starts clean.
  for (const key of Object.keys(snoozeUntil)) delete snoozeUntil[key]
  for (const key of Object.keys(snoozeCount)) delete snoozeCount[key]
  for (const key of Object.keys(cooldownUntil)) delete cooldownUntil[key]
  activeTaskId = taskId
  activeTaskTitle = taskTitle ?? null
  applyActiveSelection(selection)
  startHttpServer()
  // pollTimeout is null mid-tick too, so guard on a dedicated flag — otherwise a
  // task switch mid-poll would spawn a second concurrent loop.
  if (!loopAlive) {
    loopAlive = true
    void tick()
  }
}

export function onFocusStop(): void {
  // Best-effort: if Arc's active tab is parked on our block page, send it back to
  // the original URL so ending focus doesn't strand the user on a block page.
  restoreActiveArcTabIfBlocked()
  activeTaskId = null
  activeTaskTitle = null
  activeSites = []
  activeApps = []
  loopAlive = false
  for (const key of Object.keys(snoozeUntil)) delete snoozeUntil[key]
  for (const key of Object.keys(snoozeCount)) delete snoozeCount[key]
  for (const key of Object.keys(cooldownUntil)) delete cooldownUntil[key]
  if (pollTimeout) {
    clearTimeout(pollTimeout)
    pollTimeout = null
  }
  closeBlockPopup()
  // The HTTP server stays up for the app's lifetime (closed in stopFocusBlocker) so
  // a block page never becomes a dead "connection refused" page after focus ends.
}

// If Arc's active tab currently shows our block page, navigate it back to the
// original URL. Guarded on Arc actually running so we never relaunch a quit browser.
function restoreActiveArcTabIfBlocked(): void {
  void (async () => {
    const running = await osa('tell application "System Events" to (name of processes) contains "Arc"')
    if (running !== 'true') return
    const url = await osa('tell application "Arc" to get URL of active tab of front window')
    if (!url || !url.startsWith(BLOCK_PAGE_PREFIX)) return
    try {
      const orig = new URL(url).searchParams.get('url')
      if (orig) {
        await osa(`tell application "Arc" to set URL of active tab of front window to "${escapeAppleScript(orig)}"`)
      }
    } catch {
      // best effort — ignore
    }
  })()
}

export function stopFocusBlocker(): void {
  onFocusStop()
  stopHttpServer()
}

/**
 * Garbage-collect per-task block selections for tasks that no longer exist.
 * Completed tasks still exist as objects (reversible), so they keep their
 * config; only deleted tasks/projects get pruned. Call on app startup.
 */
export function pruneFocusTasks(liveTaskIds: Iterable<string>): void {
  const tasks = loadTasks()
  const ids = liveTaskIds instanceof Set ? liveTaskIds : new Set(liveTaskIds)
  let changed = false
  for (const taskId of Object.keys(tasks.byTask)) {
    if (!ids.has(taskId)) {
      delete tasks.byTask[taskId]
      changed = true
    }
  }
  if (changed) saveTasks(tasks)
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------

interface BlockState {
  selection: Selection
  isSaved: boolean
  groups: { key: string; label: string }[]
  metas: { key: string; label: string; groups: string[]; sites: string[]; apps: string[] }[]
  defaultMeta: string | null
}

function blockStateForTask(taskId: string): BlockState {
  const config = loadBlockConfig()
  const tasks = loadTasks()
  const { selection, isSaved } = selectionForTask(taskId, config, tasks)
  return {
    selection,
    isSaved,
    groups: Object.entries(config.groups).map(([key, g]) => ({ key, label: g.label })),
    metas: Object.entries(config.metas).map(([key, m]) => ({
      key,
      label: m.label,
      groups: m.groups,
      sites: m.sites,
      apps: m.apps
    })),
    defaultMeta: defaultMetaKey(config, tasks)
  }
}

function sanitizeSelection(input: unknown): Selection {
  const v = (input ?? {}) as Record<string, unknown>
  return {
    groups: asStringArray(v.groups),
    sites: asStringArray(v.sites).map((s) => s.trim().toLowerCase()).filter(Boolean),
    apps: asStringArray(v.apps).map((a) => a.trim()).filter(Boolean)
  }
}

export function registerFocusBlockerHandlers(ipcMain: IpcMain): void {
  // Returns the block config/selection for a task (active focus task by default).
  ipcMain.handle('focus-blocker-state', (_event, taskId: unknown) => {
    if (typeof taskId !== 'string' || !taskId) return null
    return blockStateForTask(taskId)
  })

  // Saves the selection for a task and (optionally) sets the default meta.
  // Re-applies blocking if this is the currently-active focus task.
  ipcMain.handle('focus-blocker-save', (_event, taskId: unknown, selection: unknown, setDefaultMeta: unknown) => {
    if (typeof taskId !== 'string' || !taskId) return null
    const sel = sanitizeSelection(selection)
    const tasks = loadTasks()
    tasks.byTask[taskId] = sel
    if (typeof setDefaultMeta === 'string' && setDefaultMeta) tasks.defaultMeta = setDefaultMeta
    saveTasks(tasks)
    if (activeTaskId === taskId) applyActiveSelection(sel)
    return blockStateForTask(taskId)
  })

  // Snooze a blocked app for 3 minutes (from the app-block popup).
  ipcMain.handle('focus-blocker-snooze-app', (_event, appName: unknown) => {
    if (typeof appName !== 'string' || !appName) return { ok: false, cooldownMs: 0 }
    const result = requestSnooze('app:' + appName)
    if (result.ok) {
      // Un-hide the app — without this the snooze gives nothing (the app stays hidden).
      void osa(`tell application "System Events" to set visible of process "${escapeAppleScript(appName)}" to true`)
      closeBlockPopup()
    }
    return result
  })
}
