// Mock Electron modules for testing outside Electron runtime
export const app = {
  getPath: () => '/tmp',
  whenReady: () => Promise.resolve()
}

export const BrowserWindow = {
  getAllWindows: () => []
}

export const ipcMain = {
  handle: () => {}
}
