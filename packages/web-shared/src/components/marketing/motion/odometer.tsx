import { odometerCells } from './odometer-cells'

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

/** Each digit is a 0–9 strip that rolls to its value. The accessible text is the plain value. */
export function Odometer({ value, className }: { value: string; className?: string }) {
  const cells = odometerCells(value)
  return (
    <span className={`inline-flex tabular-nums ${className ?? ''}`}>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true" className="inline-flex">
        {cells.map((cell, i) =>
          cell.kind === 'static' ? (
            <span key={`${i}-${cell.char}`}>{cell.char}</span>
          ) : (
            <span
              key={`${cells.length - i}`}
              className="relative inline-block h-[1lh] overflow-hidden"
            >
              <span
                className="ease-out-quint flex flex-col transition-transform duration-700 motion-reduce:transition-none"
                style={{ transform: `translateY(${-cell.value * 10}%)` }}
              >
                {DIGITS.map((d) => (
                  <span key={d} className="block h-[1lh]">
                    {d}
                  </span>
                ))}
              </span>
            </span>
          ),
        )}
      </span>
    </span>
  )
}
