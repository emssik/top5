// Mock Electron modules for testing outside Electron runtime
export const app = {
  getPath: () => '/tmp',
  whenReady: () => Promise.resolve(),
  hide: () => {}
}

export const BrowserWindow = {
  getAllWindows: () => []
}

export const ipcMain = {
  handle: () => {}
}

export const globalShortcut = {
  register: () => {},
  unregister: () => {}
}

export const screen = {
  getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }),
  getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } })
}
