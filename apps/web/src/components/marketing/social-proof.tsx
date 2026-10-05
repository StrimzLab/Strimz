import { Briefcase, Building2, Globe, Layers, Sparkles, Users } from 'lucide-react'
import { MovingText } from '@/components/shared/moving-text'

const SECTORS = [
  { icon: Layers, label: 'SaaS billing' },
  { icon: Building2, label: 'Marketplace fees' },
  { icon: Briefcase, label: 'Subscription apps' },
  { icon: Users, label: 'DAO treasuries' },
  { icon: Globe, label: 'Cross-border B2B' },
  { icon: Sparkles, label: 'Creator payouts' },
] as const

/**
 * "Built for" sector strip. Pre-launch substitute for fake customer
 * logos. Soft-tinted background to break the visual rhythm between the
 * white hero and the white "How it works" section that follows.
 *
 * `whitespace-nowrap` on each chip keeps the captions on a single line
 * even when the grid squeezes them at intermediate widths.
 */
export function SocialProof() {
  return (
    <>
      <section className="border-border bg-muted border-y">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8 lg:px-16">
          <p className="font-poppins text-muted-foreground text-center text-[11px] font-[500] uppercase tracking-[0.22em]">
            Built for
          </p>
          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4">
            {SECTORS.map((s) => (
              <div
                key={s.label}
                className="border-border bg-card hover:border-accent/40 flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border px-3 py-3 transition-colors"
              >
                <s.icon className="text-accent size-4 shrink-0" />
                <span className="font-poppins text-foreground text-[13px] font-[500]">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <MovingText />
    </>
  )
}
