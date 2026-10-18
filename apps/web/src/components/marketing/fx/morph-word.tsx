import { useId } from 'react'

// Adapted from Vengeance UI's Morph Text (MIT). Pure CSS, so it also runs without JavaScript;
// reduced motion shows the first word only.
export function MorphWord({
  words,
  interval = 2.6,
}: {
  words: readonly string[]
  interval?: number
}) {
  const filter = `morph-${useId().replace(/:/g, '')}`
  const total = interval * words.length
  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), '')
  return (
    <span aria-hidden className="relative inline-grid align-bottom">
      <svg className="absolute size-0">
        <filter id={filter}>
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -9"
          />
        </filter>
      </svg>
      <span className="invisible col-start-1 row-start-1 whitespace-nowrap">{longest}</span>
      <span className="col-start-1 row-start-1" style={{ filter: `url(#${filter})` }}>
        {words.map((word, i) => (
          <span
            key={word}
            className="morph-word absolute left-0 top-0 whitespace-nowrap"
            style={{
              animationDuration: `${total}s`,
              animationDelay: `${i * interval - total * 0.05}s`,
            }}
          >
            {word}
          </span>
        ))}
      </span>
    </span>
  )
}
