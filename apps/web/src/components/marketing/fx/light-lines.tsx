import { cn } from '@strimz/ui'
import { LIGHTS, LINES } from './light-lines-data'

// Adapted from Vengeance UI's Light Lines (MIT). CSS-driven so it costs no JavaScript per frame.
export function LightLines({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      <svg
        className="absolute left-1/2 h-full w-[1920px] max-w-none -translate-x-1/2"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="light-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#95FECC" stopOpacity="0" />
            <stop offset="0.5" stopColor="#03FC86" />
            <stop offset="1" stopColor="#95FECC" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g fill="#95FECC" opacity="0.09">
          {LINES.map(([x, w]) => (
            <rect key={x} x={x} width={w} height={1080} />
          ))}
        </g>
        <g fill="url(#light-fade)">
          {LIGHTS.map((light, i) => (
            <path
              key={light.d}
              d={light.d}
              className={light.up ? 'light-up' : 'light-down'}
              style={{
                animationDuration: `${6 + ((i * 7) % 17)}s`,
                animationDelay: `-${(i * 3.1) % 9}s`,
              }}
            />
          ))}
        </g>
      </svg>
    </div>
  )
}
