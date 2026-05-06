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
      <section className="border-y border-[#E5E7EB] bg-[#F9FAFB]">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8 lg:px-16">
          <p className="text-center font-poppins text-[11px] font-[500] uppercase tracking-[0.22em] text-[#58556A]">
            Built for
          </p>
          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4">
            {SECTORS.map((s) => (
              <div
                key={s.label}
                className="flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border border-[#E5E7EB] bg-white px-3 py-3 transition-colors hover:border-[#02C76A]/40"
              >
                <s.icon className="size-4 shrink-0 text-[#02C76A]" />
                <span className="font-poppins text-[13px] font-[500] text-[#050020]">
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
