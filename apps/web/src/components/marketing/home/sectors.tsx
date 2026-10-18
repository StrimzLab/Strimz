import layersIcon from '@iconify-icons/solar/layers-linear'
import shopIcon from '@iconify-icons/solar/shop-linear'
import repeatIcon from '@iconify-icons/solar/repeat-linear'
import caseIcon from '@iconify-icons/solar/case-linear'
import globalIcon from '@iconify-icons/solar/global-linear'
import starsIcon from '@iconify-icons/solar/stars-linear'
import cartIcon from '@iconify-icons/solar/cart-large-linear'
import billIcon from '@iconify-icons/solar/bill-list-linear'
import { MkIcon } from '../icon'
import { Marquee } from '../fx/marquee'

const ROW_ONE = [
  { icon: layersIcon, label: 'SaaS billing' },
  { icon: shopIcon, label: 'Marketplace fees' },
  { icon: repeatIcon, label: 'Subscription apps' },
  { icon: caseIcon, label: 'Agency retainers' },
] as const

const ROW_TWO = [
  { icon: globalIcon, label: 'Cross-border B2B' },
  { icon: starsIcon, label: 'Creator memberships' },
  { icon: cartIcon, label: 'Online stores' },
  { icon: billIcon, label: 'Invoiced services' },
] as const

function Chip({ icon, label }: { icon: (typeof ROW_ONE)[number]['icon']; label: string }) {
  return (
    <span className="border-border bg-card font-poppins text-foreground inline-flex h-14 items-center gap-3 whitespace-nowrap rounded-2xl border px-5 text-[15px] font-medium shadow-[0_1px_2px_rgb(5_0_32/0.04)]">
      <span className="bg-accent/10 text-accent flex size-8 items-center justify-center rounded-[10px]">
        <MkIcon icon={icon} className="size-[18px]" />
      </span>
      {label}
    </span>
  )
}

export function Sectors() {
  return (
    <section aria-labelledby="sectors-title" className="py-16 sm:py-20">
      <h2
        id="sectors-title"
        className="font-poppins text-muted-foreground mx-auto max-w-[1280px] px-5 text-center text-sm sm:px-10"
      >
        Built for businesses that bill online
      </h2>
      <div className="mt-8 space-y-3">
        <Marquee duration={46}>
          {[...ROW_ONE, ...ROW_TWO].map((c) => (
            <Chip key={c.label} {...c} />
          ))}
        </Marquee>
        <Marquee duration={52} reverse className="hidden sm:flex">
          {[...ROW_TWO, ...ROW_ONE].map((c) => (
            <Chip key={c.label} {...c} />
          ))}
        </Marquee>
      </div>
    </section>
  )
}
