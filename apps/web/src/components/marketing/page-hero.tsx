import { introOrder } from './motion/intro'

export function PageHero({
  label,
  lines,
  intro,
  id,
}: {
  label: string
  lines: readonly [string, string]
  intro: string
  id: string
}) {
  return (
    <section aria-labelledby={id} className="pb-14 pt-16 sm:pt-24">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-10">
        <p
          data-intro
          data-fade
          style={introOrder(0)}
          className="font-poppins bg-card text-foreground ring-border inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-medium ring-1"
        >
          <span className="bg-accent size-1.5 rounded-full" />
          {label}
        </p>
        <h1
          id={id}
          className="font-sora text-foreground mt-5 max-w-4xl text-[40px] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[60px] lg:text-[72px]"
        >
          <span className="sr-only">{lines.join(' ')}</span>
          {lines.map((line) => (
            <span key={line} aria-hidden className="block overflow-hidden pb-[0.08em]">
              <span data-intro data-line style={introOrder(0)} className="block">
                {line}
              </span>
            </span>
          ))}
        </h1>
        <p
          data-intro
          data-fade
          style={introOrder(1)}
          className="font-poppins text-muted-foreground mt-6 max-w-2xl text-base leading-relaxed sm:text-lg"
        >
          {intro}
        </p>
      </div>
    </section>
  )
}
