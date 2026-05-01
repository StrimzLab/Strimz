import { MovingText } from '@/components/shared/moving-text'

const LOGOS = ['Mercato', 'Aperture', 'Hexcell', 'Northstar', 'Pulsefin', 'Stacked'] as const

export function SocialProof() {
  return (
    <>
      <section className="relative bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/80">
            Trusted by teams shipping the next wave of stablecoin commerce
          </p>
          <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
            {LOGOS.map((n) => (
              <div
                key={n}
                className="flex items-center justify-center font-poppins text-lg font-semibold tracking-tight text-muted-foreground/60 transition-colors hover:text-foreground"
              >
                {n}
              </div>
            ))}
          </div>
        </div>
      </section>
      <MovingText />
    </>
  )
}
