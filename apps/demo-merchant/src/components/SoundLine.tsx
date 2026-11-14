import type { CSSProperties } from 'react'

const HEIGHTS = [
  30, 52, 74, 46, 88, 62, 36, 70, 94, 58, 40, 76, 100, 66, 44, 82, 56, 34, 68, 90, 50, 72, 38, 60,
]

export function SoundLine({ bars = 48, className = '' }: { bars?: number; className?: string }) {
  return (
    <div aria-hidden className={`flex items-end gap-[3px] ${className}`}>
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          className="sound-bar block w-full flex-1 rounded-full"
          style={
            {
              height: `${HEIGHTS[i % HEIGHTS.length]}%`,
              animationDelay: `${(i % 7) * -0.26}s`,
              background: i % 9 === 4 ? '#ffb020' : '#ff2b62',
              opacity: 0.35 + (HEIGHTS[i % HEIGHTS.length] ?? 50) / 160,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
