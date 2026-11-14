import Link from 'next/link'
import { CREATORS } from '@/lib/creators'
import { CreatorAvatar } from './CreatorAvatar'
import { SoundLine } from './SoundLine'
import { ArrowRightIcon } from './Icons'

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 pb-10 pt-16 sm:pt-24 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h1 className="font-display text-balance text-5xl font-extrabold leading-[0.95] tracking-[-0.035em] sm:text-7xl">
            Back the voices you love.
          </h1>
          <p className="muted mt-6 max-w-xl text-lg leading-8">
            Tip a musician in Lagos, a comic in Accra or a podcaster in Nairobi. Your support
            reaches their wallet in seconds, in USDC, with nothing held back.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="#tip" className="btn btn-primary">
              Send a tip
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link href="#pro" className="btn btn-ghost">
              Join Pro, $5 a month
            </Link>
          </div>
        </div>

        <ul
          className="relative mx-auto grid w-full max-w-sm gap-3"
          aria-label="Creators on Fanline"
        >
          {CREATORS.slice(0, 3).map((c, i) => (
            <li
              key={c.handle}
              className={`card flex items-center gap-4 rounded-3xl p-4 shadow-[0_20px_50px_-30px_rgb(30_16_51/0.5)] ${['', 'sm:translate-x-7', 'sm:translate-x-2'][i]}`}
              style={{ rotate: `${[-2, 1.5, -1][i]}deg` }}
            >
              <CreatorAvatar creator={c} size={52} />
              <div className="min-w-0 flex-1">
                <p className="font-display truncate text-lg font-bold leading-tight">{c.name}</p>
                <p className="muted truncate text-sm">
                  {c.craft} · {c.city}
                </p>
              </div>
              <SoundLine bars={6} className="h-8 w-12" />
            </li>
          ))}
        </ul>
      </div>
      <SoundLine bars={72} className="mx-auto h-24 max-w-6xl px-6 opacity-80 sm:h-32" />
    </section>
  )
}
