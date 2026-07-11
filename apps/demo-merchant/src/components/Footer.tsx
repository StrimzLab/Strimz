import { FanlineWordmark } from './Icons'

export function Footer() {
  return (
    <footer className="border-t border-[hsl(var(--border))]">
      <div className="muted mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-10 text-sm md:flex-row">
        <FanlineWordmark className="h-6 w-[100px]" />
        <p>
          A demo dApp integrating{' '}
          <a
            href="https://strimz.finance"
            className="hover:text-brand-500 font-medium text-[hsl(var(--fg))]"
          >
            Strimz
          </a>{' '}
          on Arc testnet.
        </p>
        <div className="flex gap-6">
          <a href="#creators" className="hover:text-[hsl(var(--fg))]">
            Creators
          </a>
          <a href="#pro" className="hover:text-[hsl(var(--fg))]">
            Pro
          </a>
        </div>
      </div>
    </footer>
  )
}
