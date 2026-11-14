'use client'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

export function SegmentedToggle<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (next: T) => void
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={[
            'h-8 rounded-md border px-2.5 text-xs font-medium transition-colors',
            value === option.value
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border/60 hover:bg-muted',
          ].join(' ')}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
