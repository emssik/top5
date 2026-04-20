export function fireConfetti(anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect()
  const colors = ['#7fae6d', '#e9a825', '#3c6aa8', '#d88a3e', '#d67bb0']
  for (let i = 0; i < 14; i++) {
    const el = document.createElement('div')
    el.className = 'confetti'
    el.style.left = (rect.left + rect.width / 2) + 'px'
    el.style.top = (rect.top + rect.height / 2) + 'px'
    el.style.background = colors[i % colors.length]
    el.style.transform = `rotate(${Math.random() * 360}deg) translateX(${(Math.random() - 0.5) * 60}px)`
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 1100)
  }
}

export function showHabitToast(message: string): void {
  const el = document.createElement('div')
  el.className = 'habit-toast'
  el.textContent = message
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2000)
}
