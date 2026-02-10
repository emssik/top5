# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-02-10

### Added

- Drag-and-drop reordering for project tiles in the dashboard
- Configurable action shortcuts for project selection (Cmd+1-5), quick notes, and focus toggle
- IPC bridge for shortcut-driven UI actions (`onShortcutAction` preload API)
- Expand/collapse state for project tiles lifted to Dashboard for external control

### Changed

- Replaced `electron-store` with YAML-based file storage at `~/.config/top5/data.yaml` using `js-yaml`
- Automatic migration from legacy electron-store JSON format on first launch
- Refactored store module to use in-memory cache with file-backed persistence
- Extracted `showAndFocus` helper in shortcuts module for consistent window activation

## [1.0.0] - 2026-02-10

### Added

- Electron + React 18 + TypeScript application scaffold with electron-vite
- Dashboard view with project grid limited to 5 projects
- Project tiles with integrated launchers (VS Code, iTerm, Obsidian, browser)
- Inline project editor with native macOS file pickers
- Focus mode: frameless always-on-top mini-widget visible on all Spaces
- Per-project time tracking with start/stop, survives app restart
- Per-project task list with focus-on-task support
- Global quick notes scratchpad
- Configurable global keyboard shortcuts (Cmd+Shift+Space toggle, Cmd+1-5 project switch)
- Settings panel for shortcut configuration
- Persistent local storage via electron-store
- Zustand state management with electron-store bridge
- Tailwind CSS v4 styling
- macOS DMG build target via electron-builder
