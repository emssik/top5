import React from 'react'

interface HabitIconProps {
  name: string
  size?: number
  stroke?: string
}

export function HabitIcon({ name, size = 16, stroke = 'currentColor' }: HabitIconProps) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke,
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'flame':
      return <svg {...props}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 17c1.5 0 3-1 3-3 0-1.5-1-2.5-2-3.5C10 9 9 7 10 5c-2 0-5 2.5-5 6.5A6.5 6.5 0 0 0 11.5 18a6 6 0 0 0 6-6c0-1.5-.5-3-1.5-4.5-1 1.5-2 2-3 2"/></svg>
    case 'book':
      return <svg {...props}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
    case 'dumbbell':
      return <svg {...props}><path d="M6 4v16M2 8v8M18 4v16M22 8v8M6 12h12"/></svg>
    case 'leaf':
      return <svg {...props}><path d="M11 20A7 7 0 0 1 4 13V6a2 2 0 0 1 2-2h7a7 7 0 0 1 0 14H11z"/><path d="M4 20l14-14"/></svg>
    case 'mic':
      return <svg {...props}><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
    case 'pen':
      return <svg {...props}><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
    case 'code':
      return <svg {...props}><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
    case 'no-sugar':
      return <svg {...props}><circle cx="12" cy="12" r="9"/><line x1="5" y1="5" x2="19" y2="19"/></svg>
    case 'note':
      return <svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
    case 'clock':
      return <svg {...props}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
    default:
      return <svg {...props}><circle cx="12" cy="12" r="4"/></svg>
  }
}
