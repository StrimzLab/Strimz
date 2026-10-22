import cartIcon from '@iconify-icons/solar/cart-large-2-linear'
import checkIcon from '@iconify-icons/solar/check-circle-bold'
import codeIcon from '@iconify-icons/solar/code-square-linear'
import linkIcon from '@iconify-icons/solar/link-round-linear'
import walletIcon from '@iconify-icons/solar/wallet-linear'
import { MkIcon } from '../icon'
import { Pill, Window } from '../home/billing-mocks'

const ORDER_STEPS = [
  { icon: cartIcon, title: 'Order #1042 checked out', meta: '2 items, 60.00 USDC' },
  { icon: codeIcon, title: 'payment.completed', meta: 'Signed webhook received' },
  { icon: checkIcon, title: 'Order marked paid', meta: 'Your order system updated itself' },
] as const

export function OrderMock() {
  return (
    <Window title="Order #1042" badge={<Pill tone="good">Paid</Pill>}>
      <ol className="space-y-2">
        {ORDER_STEPS.map((s) => (
          <li
            key={s.title}
            className="border-border bg-background flex items-center gap-3 rounded-xl border p-3"
          >
            <MkIcon icon={s.icon} className="text-accent size-5 shrink-0" />
            <div className="min-w-0">
              <p className="font-poppins text-foreground text-[13px] font-medium">{s.title}</p>
              <p className="font-poppins text-muted-foreground text-[11px]">{s.meta}</p>
            </div>
          </li>
        ))}
      </ol>
    </Window>
  )
}

const PRODUCTS = [
  { name: 'Members club', price: '8.00 USDC', note: 'a month' },
  { name: 'Lightroom presets', price: '15.00 USDC', note: 'one-off' },
  { name: 'Portfolio review', price: '40.00 USDC', note: 'one-off' },
] as const

export function StorefrontMock() {
  return (
    <Window title="strimz.finance/store/studio-ade" badge={<Pill tone="muted">Storefront</Pill>}>
      <div className="flex items-center gap-3">
        <span className="bg-accent/15 text-accent-ink dark:text-accent font-sora grid size-10 place-items-center rounded-full text-sm font-semibold">
          SA
        </span>
        <div>
          <p className="font-sora text-foreground text-sm font-semibold">Studio Ade</p>
          <p className="font-poppins text-muted-foreground text-[11px]">Photography and presets</p>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {PRODUCTS.map((p) => (
          <li
            key={p.name}
            className="border-border bg-background flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5"
          >
            <span className="font-poppins text-foreground text-[13px] font-medium">{p.name}</span>
            <span className="font-poppins text-muted-foreground whitespace-nowrap text-[12px] tabular-nums">
              <span className="text-foreground font-medium">{p.price}</span> {p.note}
            </span>
          </li>
        ))}
      </ul>
    </Window>
  )
}

export function EurcLinkMock() {
  return (
    <Window title="Invoice 2026-0107" badge={<Pill tone="good">Settled</Pill>}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-poppins text-muted-foreground text-xs">Billed to</p>
          <p className="font-poppins text-foreground text-sm font-medium">Client in Lisbon</p>
        </div>
        <p className="font-sora text-foreground whitespace-nowrap text-xl font-semibold tabular-nums">
          8,000.00 <span className="text-muted-foreground text-xs font-normal">EURC</span>
        </p>
      </div>
      <div className="border-accent/40 bg-accent/5 mt-4 flex items-center gap-3 rounded-2xl border p-3">
        <span className="bg-accent text-ink grid size-9 shrink-0 place-items-center rounded-xl">
          <MkIcon icon={linkIcon} className="size-5" />
        </span>
        <p className="font-poppins text-foreground min-w-0 truncate font-mono text-xs">
          strimz.finance/pay/ps_8f2a…
        </p>
      </div>
      <div className="border-border mt-3 flex items-center gap-3 rounded-xl border p-3">
        <MkIcon icon={walletIcon} className="text-accent size-5 shrink-0" />
        <p className="font-poppins text-muted-foreground text-[12px]">
          Settled to your wallet. Your client paid no gas.
        </p>
      </div>
    </Window>
  )
}
