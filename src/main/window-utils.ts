import { BrowserWindow, screen } from 'electron'

/** Clamp window bounds so it's fully visible within the work area, then show + focus. */
export function showWindowVisible(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  const bounds = win.getBounds()
  const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y })
  const wa = display.workArea
  let { x, y, width, height } = bounds
  if (width > wa.width) width = wa.width
  if (height > wa.height) height = wa.height
  if (x < wa.x) x = wa.x
  if (y < wa.y) y = wa.y
  if (x + width > wa.x + wa.width) x = wa.x + wa.width - width
  if (y + height > wa.y + wa.height) y = wa.y + wa.height - height
  if (x !== bounds.x || y !== bounds.y || width !== bounds.width || height !== bounds.height) {
    win.setBounds({ x, y, width, height })
  }
  win.show()
  win.focus()
}
