import Link from 'next/link'
import { AuroraBackground, AuroraGrid } from '@/components/effects/aurora-background'
import { Logo } from '@/components/shared/logo'
import { ThemeToggle } from '@/components/theme-toggle'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <AuroraBackground />
      <AuroraGrid />

      <header className="relative z-10 mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Back to site
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center px-4 pb-16 sm:px-6">
        {children}
      </main>
    </div>
  )
}
