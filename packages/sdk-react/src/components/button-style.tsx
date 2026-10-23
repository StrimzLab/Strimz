import * as React from 'react'

export type StrimzButtonTheme = 'auto' | 'light' | 'dark'
export type StrimzButtonSize = 'sm' | 'md' | 'lg'

export function StrimzMark({ size }: { size: number }) {
  // Inline SVG keeps the bundle dependency-free.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      role="img"
      aria-label="Strimz"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="8" cy="8" r="8" fill="#02C76A" />
      <path d="M5 9h6M5 7h6" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

interface StyleParams {
  theme: StrimzButtonTheme
  size: StrimzButtonSize
}

export function strimzButtonStyle({ theme, size }: StyleParams): React.CSSProperties {
  const dimensions = sizeMap[size]
  const palette = paletteFor(theme)
  return {
    appearance: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontWeight: 600,
    background: palette.background,
    color: palette.foreground,
    borderRadius: 10,
    paddingInline: dimensions.padX,
    paddingBlock: dimensions.padY,
    fontSize: dimensions.font,
    lineHeight: 1.2,
    transition: 'background-color 120ms ease, transform 80ms ease',
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  }
}

const sizeMap: Record<StrimzButtonSize, { padX: number; padY: number; font: number }> = {
  sm: { padX: 12, padY: 6, font: 13 },
  md: { padX: 16, padY: 10, font: 15 },
  lg: { padX: 20, padY: 14, font: 17 },
}

function paletteFor(theme: StrimzButtonTheme): { background: string; foreground: string } {
  if (theme === 'light') return { background: '#02C76A', foreground: '#FFFFFF' }
  if (theme === 'dark') return { background: '#02C76A', foreground: '#FFFFFF' }
  // auto. Same brand for both modes; the surrounding app's theme handles context.
  return { background: '#02C76A', foreground: '#FFFFFF' }
}
