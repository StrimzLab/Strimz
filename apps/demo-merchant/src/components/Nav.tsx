import { ThemeToggle } from './ThemeToggle'
import { FanlineWordmark } from './Icons'

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[hsl(var(--border))] bg-[hsl(var(--bg))]/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="/" className="flex items-center gap-2 text-[hsl(var(--fg))]">
          <FanlineWordmark className="h-6 w-[100px]" />
        </a>
        <nav className="muted hidden gap-8 text-sm md:flex">
          <a href="#creators" className="hover:text-[hsl(var(--fg))]">
            Creators
          </a>
          <a href="#pro" className="hover:text-[hsl(var(--fg))]">
            Pro
          </a>
          <a href="#how" className="hover:text-[hsl(var(--fg))]">
            How it works
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
