import { useCallback, useEffect, useMemo, useState } from 'react'
import { useProjects } from '../hooks/useProjects'
import type { ApiConfig, EnergyTrackerConfig } from '../types'

interface Props {
  open: boolean
  onClose: () => void
}

const CLEAN_VIEW_FONTS = ['Caveat', 'Patrick Hand', 'Kalam', 'Architects Daughter']

const SHORTCUT_ROWS: Array<{ action: string; shortcut: string }> = [
  { action: 'Clean view', shortcut: '⌘ Shift C' },
  { action: 'New task', shortcut: 'N' },
  { action: 'Focus mode', shortcut: '⌘ Shift F' },
  { action: 'Project 1–5', shortcut: '⌘ 1-5' },
  { action: 'Quick notes', shortcut: '⌘ Shift N' },
  { action: 'Toggle theme', shortcut: '⌘ Shift T' }
]

export default function Settings({ open, onClose }: Props) {
  const { config, saveConfig } = useProjects()
  const [quickTasksLimit, setQuickTasksLimit] = useState(config.quickTasksLimit ?? 5)
  const [activeProjectsLimit, setActiveProjectsLimit] = useState(config.activeProjectsLimit ?? 5)
  const [cleanViewFont, setCleanViewFont] = useState(config.cleanViewFont || 'Caveat')
  const [baseFontSize, setBaseFontSize] = useState(config.baseFontSize ?? 13)
  const [obsidianStoragePath, setObsidianStoragePath] = useState(config.obsidianStoragePath || '')
  const [obsidianVaultName, setObsidianVaultName] = useState(config.obsidianVaultName || '')
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showApi, setShowApi] = useState(false)
  const [apiConfig, setApiConfig] = useState<ApiConfig | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showEnergy, setShowEnergy] = useState(false)
  const [energyConfig, setEnergyConfig] = useState<EnergyTrackerConfig | null>(null)
  const [energyMin, setEnergyMin] = useState(60)
  const [energyMax, setEnergyMax] = useState(120)

  useEffect(() => {
    setQuickTasksLimit(config.quickTasksLimit ?? 5)
    setActiveProjectsLimit(config.activeProjectsLimit ?? 5)
    setCleanViewFont(config.cleanViewFont || 'Caveat')
    setBaseFontSize(config.baseFontSize ?? 13)
    setObsidianStoragePath(config.obsidianStoragePath || '')
    setObsidianVaultName(config.obsidianVaultName || '')
  }, [config])

  useEffect(() => {
    if (open) {
      window.api.getApiConfig().then(setApiConfig)
      window.api.getEnergyTrackerConfig().then((cfg) => {
        setEnergyConfig(cfg)
        setEnergyMin(cfg.intervalMinMin)
        setEnergyMax(cfg.intervalMaxMin)
      })
    }
  }, [open])

  const syncLabel = useMemo(() => {
    return navigator.userAgent.includes('Mac') ? 'Enabled (iCloud)' : 'Enabled'
  }, [])

  const handleToggleApi = useCallback(async () => {
    if (!apiConfig) return
    const next = await window.api.saveApiConfig({ enabled: !apiConfig.enabled })
    setApiConfig(next)
  }, [apiConfig])

  const handleRegenerateKey = useCallback(async () => {
    if (!apiConfig) return
    const next = await window.api.saveApiConfig({
      apiKey: 'top5_' + crypto.randomUUID()
    })
    setApiConfig(next)
    setShowApiKey(true)
  }, [apiConfig])

  const handleCopyKey = useCallback(() => {
    if (!apiConfig?.apiKey) return
    navigator.clipboard.writeText(apiConfig.apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [apiConfig])

  const handleToggleEnergy = useCallback(async () => {
    if (!energyConfig) return
    const next = await window.api.saveEnergyTrackerConfig({ ...energyConfig, enabled: !energyConfig.enabled })
    setEnergyConfig(next)
  }, [energyConfig])

  const handleSaveEnergyInterval = useCallback(async () => {
    if (!energyConfig) return
    const next = await window.api.saveEnergyTrackerConfig({
      ...energyConfig,
      intervalMinMin: energyMin,
      intervalMaxMin: energyMax
    })
    setEnergyConfig(next)
    setEnergyMin(next.intervalMinMin)
    setEnergyMax(next.intervalMaxMin)
  }, [energyConfig, energyMin, energyMax])

  const handlePauseEnergy = useCallback(async (kind: '1h' | '2h' | 'eod') => {
    let isoTimestamp: string
    if (kind === 'eod') {
      const eod = new Date()
      eod.setHours(23, 59, 59, 999)
      isoTimestamp = eod.toISOString()
    } else {
      const minutes = kind === '1h' ? 60 : 120
      isoTimestamp = new Date(Date.now() + minutes * 60_000).toISOString()
    }
    const next = await window.api.energyPauseUntil(isoTimestamp)
    setEnergyConfig(next)
  }, [])

  const handleResumeEnergy = useCallback(async () => {
    const next = await window.api.energyResume()
    setEnergyConfig(next)
  }, [])

  if (!open) return null

  const handleSave = () => {
    saveConfig({
      ...config,
      quickTasksLimit: Math.max(1, Math.min(20, quickTasksLimit)),
      activeProjectsLimit: Math.max(1, Math.min(20, activeProjectsLimit)),
      cleanViewFont,
      baseFontSize: Math.max(10, Math.min(18, baseFontSize)),
      obsidianStoragePath: obsidianStoragePath.trim() || undefined,
      obsidianVaultName: obsidianVaultName.trim() || undefined
    })
    onClose()
  }

  const maskedKey = apiConfig?.apiKey
    ? apiConfig.apiKey.slice(0, 8) + '...' + apiConfig.apiKey.slice(-4)
    : ''

  return (
    <div className="modal-overlay open" onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }} tabIndex={-1} ref={(el) => el?.focus()}>
      <div className="modal" style={{ width: 440 }} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2>Settings</h2>
          <span
            style={{ fontSize: 12, opacity: 0.45, cursor: 'pointer' }}
            onClick={() => window.api.openDevTools()}
          >
            DevTools
          </span>
        </div>

        <div className="modal-row">
          <label>Theme</label>
          <span className="value">{config.theme === 'light' ? 'Light' : 'Dark'} (toggle in sidebar)</span>
        </div>

        <div className="modal-row" style={{ alignItems: 'flex-start', display: 'block' }}>
          <label style={{ display: 'block', marginBottom: 8 }}>Clean view font</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
            {CLEAN_VIEW_FONTS.map((font) => (
              <button
                key={font}
                className={`form-btn ${cleanViewFont === font ? 'form-btn-primary' : 'form-btn-secondary'}`}
                style={{ textAlign: 'left', fontFamily: `'${font}', cursive` }}
                onClick={() => setCleanViewFont(font)}
              >
                {font}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-row">
          <label>Base font size</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="range"
              min={10}
              max={18}
              step={1}
              value={baseFontSize}
              onChange={(e) => {
                const v = Number(e.target.value)
                setBaseFontSize(v)
                window.api.setZoomFactor(v / 13)
              }}
              style={{ width: 100 }}
            />
            <span className="value" style={{ minWidth: 32, textAlign: 'center' }}>{baseFontSize}px</span>
          </div>
        </div>

        <div className="modal-row">
          <label>Active projects limit</label>
          <input
            type="number"
            min={1}
            max={20}
            value={activeProjectsLimit}
            onChange={(event) => setActiveProjectsLimit(Math.max(1, Math.min(20, Number(event.target.value) || 5)))}
            className="form-input"
            style={{ width: 68, textAlign: 'center', padding: '5px 8px' }}
          />
        </div>

        <div className="modal-row">
          <label>Task limit</label>
          <input
            type="number"
            min={1}
            max={20}
            value={quickTasksLimit}
            onChange={(event) => setQuickTasksLimit(Math.max(1, Math.min(20, Number(event.target.value) || 5)))}
            className="form-input"
            style={{ width: 68, textAlign: 'center', padding: '5px 8px' }}
          />
        </div>

        <div className="modal-row">
          <label>iCloud sync</label>
          <span className="value">{syncLabel}</span>
        </div>

        <div className="modal-row">
          <label>Data location</label>
          <span className="value" style={{ fontSize: 11, opacity: 0.75 }}>~/.config/top5</span>
        </div>

        <div className="modal-row" style={{ alignItems: 'flex-start', display: 'block' }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Obsidian Vault</label>
          <input
            className="form-input"
            style={{ width: '100%', padding: '5px 8px', fontSize: 12, marginBottom: 6 }}
            placeholder="Vault name (e.g. my-vault)"
            value={obsidianVaultName}
            onChange={(e) => setObsidianVaultName(e.target.value)}
          />
          <div style={{ position: 'relative' }}>
            <input
              className="form-input"
              style={{ width: '100%', padding: '5px 26px 5px 8px', fontSize: 12 }}
              placeholder="Vault path (e.g. /Users/you/my-vault)"
              value={obsidianStoragePath}
              onChange={(e) => setObsidianStoragePath(e.target.value)}
            />
            <button
              style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: 14, opacity: 0.5, lineHeight: 1 }}
              title="Browse…"
              onClick={async () => {
                const dir = await window.api.selectDirectory()
                if (dir) setObsidianStoragePath(dir)
              }}
            >
              📂
            </button>
          </div>
          <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>
            Notes are saved to vault-path/top5.storage/; vault name is used for obsidian:// links
          </div>
        </div>

        <div style={{ marginTop: 16, borderTop: '1px solid var(--c-border-subtle)', paddingTop: 12 }}>
          <div className={`done-toggle ${showApi ? 'open' : ''}`} onClick={() => setShowApi((v) => !v)} style={{ fontWeight: 600, color: 'var(--c-text-heading)' }}>
            <span>HTTP API</span>
            <span className="chevron">▸</span>
          </div>
          <div className={`done-list ${showApi ? 'open' : ''}`}>
            {apiConfig && (
              <>
                <div className="modal-row">
                  <label>Status</label>
                  <button
                    className={`form-btn ${apiConfig.enabled ? 'form-btn-primary' : 'form-btn-secondary'}`}
                    style={{ padding: '4px 12px', fontSize: 12 }}
                    onClick={handleToggleApi}
                  >
                    {apiConfig.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                <div className="modal-row">
                  <label>Port</label>
                  <span className="value" style={{ fontSize: 12 }}>{apiConfig.port}</span>
                </div>
                {apiConfig.apiKey && (
                  <>
                    <div className="modal-row" style={{ alignItems: 'flex-start', display: 'block' }}>
                      <label style={{ display: 'block', marginBottom: 4 }}>API Key</label>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <code style={{ fontSize: 11, opacity: 0.85, flex: 1, wordBreak: 'break-all' }}>
                          {showApiKey ? apiConfig.apiKey : maskedKey}
                        </code>
                        <button
                          className="form-btn form-btn-secondary"
                          style={{ padding: '2px 8px', fontSize: 11, whiteSpace: 'nowrap' }}
                          onClick={() => setShowApiKey((v) => !v)}
                        >
                          {showApiKey ? 'Hide' : 'Show'}
                        </button>
                        <button
                          className="form-btn form-btn-secondary"
                          style={{ padding: '2px 8px', fontSize: 11, whiteSpace: 'nowrap' }}
                          onClick={handleCopyKey}
                        >
                          {copied ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    <div className="modal-row">
                      <label />
                      <button
                        className="form-btn form-btn-secondary"
                        style={{ padding: '4px 12px', fontSize: 12 }}
                        onClick={handleRegenerateKey}
                      >
                        Regenerate key
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div style={{ marginTop: 16, borderTop: '1px solid var(--c-border-subtle)', paddingTop: 12 }}>
          <div className={`done-toggle ${showEnergy ? 'open' : ''}`} onClick={() => setShowEnergy((v) => !v)} style={{ fontWeight: 600, color: 'var(--c-text-heading)' }}>
            <span>Energy tracker</span>
            <span className="chevron">▸</span>
          </div>
          <div className={`done-list ${showEnergy ? 'open' : ''}`}>
            {energyConfig && (
              <>
                <div className="modal-row">
                  <label>Status</label>
                  <button
                    className={`form-btn ${energyConfig.enabled ? 'form-btn-primary' : 'form-btn-secondary'}`}
                    style={{ padding: '4px 12px', fontSize: 12 }}
                    onClick={handleToggleEnergy}
                  >
                    {energyConfig.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                <div className="modal-row">
                  <label>Interval (min)</label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="number"
                      min={1}
                      max={480}
                      value={energyMin}
                      onChange={(e) => setEnergyMin(Math.max(1, Math.min(480, Number(e.target.value) || 1)))}
                      onBlur={handleSaveEnergyInterval}
                      className="form-input"
                      style={{ width: 60, textAlign: 'center', padding: '5px 8px' }}
                    />
                    <span style={{ opacity: 0.5, fontSize: 11 }}>–</span>
                    <input
                      type="number"
                      min={1}
                      max={480}
                      value={energyMax}
                      onChange={(e) => setEnergyMax(Math.max(1, Math.min(480, Number(e.target.value) || 1)))}
                      onBlur={handleSaveEnergyInterval}
                      className="form-input"
                      style={{ width: 60, textAlign: 'center', padding: '5px 8px' }}
                    />
                    <span style={{ opacity: 0.5, fontSize: 11 }}>min</span>
                  </div>
                </div>
                <div className="modal-row">
                  <label>Pauza</label>
                  {energyConfig.pausedUntil && Date.parse(energyConfig.pausedUntil) > Date.now() ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className="value" style={{ fontSize: 11, opacity: 0.75 }}>
                        do {new Date(energyConfig.pausedUntil).toLocaleTimeString('pl', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        className="form-btn form-btn-secondary"
                        style={{ padding: '2px 8px', fontSize: 11 }}
                        onClick={handleResumeEnergy}
                      >
                        Wznów
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="form-btn form-btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => handlePauseEnergy('1h')}>1h</button>
                      <button className="form-btn form-btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => handlePauseEnergy('2h')}>2h</button>
                      <button className="form-btn form-btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => handlePauseEnergy('eod')}>do końca dnia</button>
                    </div>
                  )}
                </div>
                <div className="modal-row">
                  <label />
                  <span className="value" style={{ fontSize: 11, opacity: 0.5 }}>energy.jsonl</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ marginTop: 16, borderTop: '1px solid var(--c-border-subtle)', paddingTop: 12 }}>
          <div className={`done-toggle ${showShortcuts ? 'open' : ''}`} onClick={() => setShowShortcuts((value) => !value)} style={{ fontWeight: 600, color: 'var(--c-text-heading)' }}>
            <span>Keyboard Shortcuts</span>
            <span className="chevron">▸</span>
          </div>
          <div className={`done-list ${showShortcuts ? 'open' : ''}`}>
            {SHORTCUT_ROWS.map((row) => (
              <div key={row.action} className="modal-row">
                <label>{row.action}</label>
                <span className="value">
                  <kbd className="settings-kbd">{row.shortcut}</kbd>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="form-actions">
          <button className="form-btn form-btn-secondary" onClick={() => {
            window.api.setZoomFactor((config.baseFontSize ?? 13) / 13)
            onClose()
          }}>Cancel</button>
          <button className="form-btn form-btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}
