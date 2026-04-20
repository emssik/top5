import React from 'react'

export function HeatmapLegend() {
  return (
    <div className="legend">
      <span>mniej</span>
      <span className="heat-cell" />
      <span className="heat-cell l1" />
      <span className="heat-cell l2" />
      <span className="heat-cell l3" />
      <span className="heat-cell l4" />
      <span>więcej</span>
      <span className="legend-gap" />
      <span className="heat-cell freeze" />
      <span>freeze</span>
      <span className="heat-cell skip" />
      <span>skip</span>
      <span className="heat-cell miss" />
      <span>miss</span>
    </div>
  )
}
