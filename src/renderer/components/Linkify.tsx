import React from 'react'

const URL_RE = /https?:\/\/[^\s<>)"',]+/g

export function Linkify({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  let last = 0

  for (const match of text.matchAll(URL_RE)) {
    const url = match[0]
    const idx = match.index!
    if (idx > last) parts.push(text.slice(last, idx))
    parts.push(
      <a
        key={idx}
        className="task-link"
        href="#"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          window.api.openExternal(url)
        }}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>
    )
    last = idx + url.length
  }

  if (last === 0) return <>{text}</>
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}
