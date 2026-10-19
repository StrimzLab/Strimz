import checkIcon from '@iconify-icons/solar/check-circle-bold'
import dangerIcon from '@iconify-icons/solar/danger-circle-linear'
import letterIcon from '@iconify-icons/solar/letter-linear'
import restartIcon from '@iconify-icons/solar/restart-linear'
import walletIcon from '@iconify-icons/solar/wallet-linear'
import undoIcon from '@iconify-icons/solar/undo-left-round-linear'
import { cn } from '@strimz/ui'
import { MkIcon } from '../icon'

// Final frames. BillingTools animates into them when each sheet arrives.

export function Window({
  title,
  children,
  badge,
}: {
  title: string
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="border-border bg-card w-full overflow-hidden rounded-[22px] border shadow-[0_30px_70px_-35px_rgb(5_0_32/0.45)]">
      <div className="border-border flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <p className="font-sora text-foreground min-w-0 truncate text-sm font-semibold">{title}</p>
        {badge}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

export function Pill({
  tone,
  children,
}: {
  tone: 'good' | 'warn' | 'muted'
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'font-poppins shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium',
        tone === 'good' && 'bg-accent/10 text-accent-ink dark:text-accent',
        tone === 'warn' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
        tone === 'muted' && 'bg-muted text-muted-foreground',
      )}
    >
      {children}
    </span>
  )
}

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'] as const

export function SubscriptionsMock() {
  return (
    <Window title="Pro plan" badge={<Pill tone="good">12 active</Pill>}>
      <div className="flex items-baseline justify-between">
        <p className="font-sora text-foreground text-2xl font-semibold tracking-[-0.03em]">
          $49.00{' '}
          <span className="font-poppins text-muted-foreground whitespace-nowrap text-sm font-normal tracking-normal">
            USDC a month
          </span>
        </p>
        <p className="font-poppins text-muted-foreground text-xs">Next charge in 2 days</p>
      </div>
      <div className="mt-5 grid grid-cols-7 gap-1.5">
        {MONTHS.map((m, i) => (
          <div key={m} data-cell className="space-y-1.5 text-center">
            <span
              className={cn(
                'grid aspect-square place-items-center rounded-lg',
                i < 6
                  ? 'bg-accent/15 text-accent'
                  : 'border-border text-muted-foreground border border-dashed',
              )}
            >
              {i < 6 ? <MkIcon icon={checkIcon} className="size-4" /> : null}
            </span>
            <span className="font-poppins text-muted-foreground block text-[10px]">{m}</span>
          </div>
        ))}
      </div>
      <p className="font-poppins text-muted-foreground mt-4 text-xs">
        Approved once in April and charged every month since, without asking again.
      </p>
    </Window>
  )
}

const RECOVERY = [
  {
    icon: dangerIcon,
    tone: 'text-amber-600 dark:text-amber-400',
    title: 'Charge failed',
    meta: 'Not enough USDC in the wallet',
  },
  {
    icon: letterIcon,
    tone: 'text-step-blue',
    title: 'Reminder emailed',
    meta: 'Asks the customer to top up',
  },
  {
    icon: restartIcon,
    tone: 'text-step-purple',
    title: 'Retried after 1 hour',
    meta: 'Then 3, 6, 12 and 24 hours',
  },
  { icon: checkIcon, tone: 'text-accent', title: 'Recovered', meta: '$49.00 USDC collected' },
] as const

export function RecoveryMock() {
  return (
    <Window title="Subscription #2026-0412" badge={<Pill tone="good">Active again</Pill>}>
      <ol className="relative space-y-4">
        <span aria-hidden className="bg-border absolute bottom-3 left-[15px] top-3 w-px" />
        <span
          aria-hidden
          data-progress
          className="bg-accent absolute bottom-3 left-[15px] top-3 w-px origin-top"
        />
        {RECOVERY.map((r) => (
          <li key={r.title} data-step className="relative flex items-center gap-3">
            <span
              className={cn(
                'bg-card border-border relative grid size-8 place-items-center rounded-full border',
                r.tone,
              )}
            >
              <MkIcon icon={r.icon} className="size-4" />
            </span>
            <div>
              <p className="font-poppins text-foreground text-sm font-medium">{r.title}</p>
              <p className="font-poppins text-muted-foreground text-xs">{r.meta}</p>
            </div>
          </li>
        ))}
      </ol>
    </Window>
  )
}

export function RefundsMock() {
  return (
    <Window title="Refund" badge={<Pill tone="good">Completed</Pill>}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="font-poppins text-muted-foreground text-xs">Partial refund to</p>
          <p className="font-poppins text-foreground break-all text-sm font-medium">
            jordan@northwind.example
          </p>
        </div>
        <p className="font-sora text-foreground whitespace-nowrap text-xl font-semibold tracking-[-0.02em]">
          −
          <span data-refund className="tabular-nums">
            20.00
          </span>{' '}
          <span className="text-muted-foreground text-xs font-normal">EURC</span>
        </p>
      </div>
      <div className="mt-5 space-y-2">
        {[
          { icon: undoIcon, label: 'Refund created', note: 'Up to the amount paid' },
          {
            icon: walletIcon,
            label: 'You approve it in your wallet',
            note: 'Strimz never holds your money',
          },
          { icon: checkIcon, label: 'Customer refunded', note: 'Dashboard updates by itself' },
        ].map((s) => (
          <div
            key={s.label}
            data-step
            className="border-border bg-background flex items-center gap-3 rounded-xl border p-3"
          >
            <MkIcon icon={s.icon} className="text-accent size-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-poppins text-foreground text-[13px] font-medium">{s.label}</p>
              <p className="font-poppins text-muted-foreground text-[11px]">{s.note}</p>
            </div>
          </div>
        ))}
      </div>
    </Window>
  )
}

const LINES = [
  { item: 'Website retainer, October', qty: 1, amount: 1200 },
  { item: 'Extra design hours', qty: 6, amount: 540 },
] as const

export function InvoicesMock() {
  return (
    <Window
      title="Invoice 2026-0042"
      badge={
        <span data-status className="relative inline-grid">
          <Pill tone="good">Paid</Pill>
        </span>
      }
    >
      <div className="flex justify-between">
        <div>
          <p className="font-poppins text-muted-foreground text-xs">Billed to</p>
          <p className="font-poppins text-foreground text-sm font-medium">Northwind GmbH</p>
        </div>
        <div className="text-right">
          <p className="font-poppins text-muted-foreground text-xs">Due</p>
          <p className="font-poppins text-foreground text-sm">Net 14</p>
        </div>
      </div>
      <table className="font-poppins mt-5 w-full text-[13px]">
        <tbody>
          {LINES.map((l) => (
            <tr key={l.item} data-line className="border-border border-b">
              <td className="text-foreground py-2.5">{l.item}</td>
              <td className="text-muted-foreground py-2.5 text-center">{l.qty}</td>
              <td className="text-foreground py-2.5 text-right tabular-nums">
                {l.amount.toLocaleString('en-US')}.00
              </td>
            </tr>
          ))}
          <tr>
            <td className="text-foreground pt-3 font-semibold" colSpan={2}>
              Total
            </td>
            <td className="font-sora text-foreground whitespace-nowrap pt-3 text-right text-base font-semibold tabular-nums">
              1,740.00 EURC
            </td>
          </tr>
        </tbody>
      </table>
      <div className="relative mt-5">
        <span className="font-poppins bg-foreground text-background flex h-10 items-center justify-center rounded-xl text-sm font-semibold">
          Pay 1,740.00 EURC
        </span>
        <span
          data-stamp
          className="font-sora border-accent text-accent-ink dark:text-accent bg-card/90 absolute -top-[70px] left-[28%] rotate-[-10deg] rounded-xl border-2 px-3 py-1 text-base font-bold tracking-[0.04em] backdrop-blur-sm sm:-top-[188px] sm:left-[38%] sm:text-lg"
        >
          PAID
        </span>
      </div>
    </Window>
  )
}

// Monthly recurring revenue in thousands of dollars, growing about 3% a month.
const POINTS = [8.9, 9.1, 9.0, 9.4, 9.8, 9.7, 10.2, 10.6, 10.9, 11.3, 11.9, 12.5]

export function AnalyticsMock() {
  // The axis starts at $7k so the growth reads at this size.
  const [min, max] = [7, 13.5]
  const path = POINTS.map(
    (p, i) =>
      `${i === 0 ? 'M' : 'L'} ${(i / (POINTS.length - 1)) * 300} ${100 - ((p - min) / (max - min)) * 90}`,
  ).join(' ')
  return (
    <Window title="Revenue" badge={<Pill tone="muted">Last 12 months</Pill>}>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Monthly recurring', value: '$12,480' },
          { label: 'Monthly churn', value: '3.2%' },
          { label: 'Next 90 days', value: '+9%' },
        ].map((k) => (
          <div key={k.label} className="bg-muted rounded-xl p-3">
            <p className="font-poppins text-muted-foreground text-[10px]">{k.label}</p>
            <p className="font-sora text-foreground mt-1 text-base font-semibold tracking-[-0.02em]">
              {k.value}
            </p>
          </div>
        ))}
      </div>
      <svg
        viewBox="0 0 300 100"
        className="mt-4 h-32 w-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#02C76A" stopOpacity="0.3" />
            <stop offset="1" stopColor="#02C76A" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path data-area d={`${path} L 300 100 L 0 100 Z`} fill="url(#rev-fill)" />
        <path
          data-line-path
          d={path}
          fill="none"
          stroke="#02C76A"
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
      <p className="font-poppins text-muted-foreground mt-2 text-[11px]">
        Sample figures. Yours come from your own payments.
      </p>
    </Window>
  )
}
