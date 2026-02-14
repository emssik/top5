import { useCallback, useEffect, useMemo, useState } from 'react'
import { useProjects } from '../hooks/useProjects'
import type { ApiConfig } from '../types'

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
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showApi, setShowApi] = useState(false)
  const [apiConfig, setApiConfig] = useState<ApiConfig | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setQuickTasksLimit(config.quickTasksLimit ?? 5)
    setActiveProjectsLimit(config.activeProjectsLimit ?? 5)
    setCleanViewFont(config.cleanViewFont || 'Caveat')
  }, [config])

  useEffect(() => {
    if (open) {
      window.api.getApiConfig().then(setApiConfig)
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

  if (!open) return null

  const handleSave = () => {
    saveConfig({
      ...config,
      quickTasksLimit: Math.max(1, Math.min(20, quickTasksLimit)),
      activeProjectsLimit: Math.max(1, Math.min(20, activeProjectsLimit)),
      cleanViewFont
    })
    onClose()
  }

  const maskedKey = apiConfig?.apiKey
    ? apiConfig.apiKey.slice(0, 8) + '...' + apiConfig.apiKey.slice(-4)
    : ''

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal" style={{ width: 440 }} onClick={(event) => event.stopPropagation()}>
        <h2>Settings</h2>

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

        <div style={{ marginTop: 16, borderTop: '1px solid var(--c-border-subtle)', paddingTop: 12 }}>
          <button
            className="form-btn form-btn-secondary"
            style={{ padding: '4px 12px', fontSize: 12 }}
            onClick={() => window.api.openDevTools()}
          >
            Open DevTools
          </button>
        </div>

        <div className="form-actions">
          <button className="form-btn form-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="form-btn form-btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}
