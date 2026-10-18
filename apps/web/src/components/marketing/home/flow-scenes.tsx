import checkIcon from '@iconify-icons/solar/check-circle-bold'
import linkIcon from '@iconify-icons/solar/link-round-linear'
import codeIcon from '@iconify-icons/solar/code-linear'
import shopIcon from '@iconify-icons/solar/shop-linear'
import qrIcon from '@iconify-icons/solar/qr-code-linear'
import walletIcon from '@iconify-icons/solar/wallet-linear'
import letterIcon from '@iconify-icons/solar/letter-linear'
import repeatIcon from '@iconify-icons/solar/repeat-linear'
import { cn } from '@strimz/ui'
import { MkIcon } from '../icon'

// Each scene renders its final frame. The pinned timeline animates from earlier states, so phones,
// reduced motion and no-JS all see the finished picture.

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="font-poppins text-muted-foreground text-[11px]">{label}</p>
      <div className="border-border bg-background font-poppins text-foreground flex h-10 items-center rounded-xl border px-3 text-sm">
        {children}
      </div>
    </div>
  )
}

export function CreateScene() {
  return (
    <div data-scene="create" className="space-y-4 p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <p className="font-sora text-foreground text-[15px] font-semibold">New plan</p>
        <span className="font-poppins bg-accent/10 text-accent-ink dark:text-accent rounded-full px-2.5 py-0.5 text-[11px] font-medium">
          Draft
        </span>
      </div>
      <Field label="Name">
        <span data-type-name className="inline-block overflow-hidden whitespace-nowrap">
          Pro
        </span>
        <span data-caret className="bg-accent ml-0.5 h-4 w-px" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Price">
          <span data-price className="tabular-nums">
            49.00
          </span>
        </Field>
        <div className="space-y-1.5">
          <p className="font-poppins text-muted-foreground text-[11px]">Currency</p>
          <div className="border-border bg-muted relative grid h-10 grid-cols-2 rounded-xl border p-1">
            <span
              data-currency-pill
              className="bg-card absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg shadow-sm"
            />
            <span className="font-poppins text-foreground relative z-10 grid place-items-center text-xs font-medium">
              USDC
            </span>
            <span className="font-poppins text-muted-foreground relative z-10 grid place-items-center text-xs">
              EURC
            </span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Billing">Every month</Field>
        <div className="space-y-1.5">
          <p className="font-poppins text-muted-foreground text-[11px]">Free trial</p>
          <div className="border-border bg-background flex h-10 items-center justify-between rounded-xl border px-3">
            <span className="font-poppins text-foreground text-sm">14 days</span>
            <span className="bg-accent relative h-5 w-9 rounded-full">
              <span
                data-toggle-knob
                className="bg-ink-foreground absolute right-0.5 top-0.5 size-4 rounded-full shadow"
              />
            </span>
          </div>
        </div>
      </div>
      <div className="relative">
        <span
          data-create-button
          className="font-poppins bg-foreground text-background flex h-11 items-center justify-center rounded-xl text-sm font-semibold"
        >
          Create plan
        </span>
        <span
          data-created
          className="font-poppins bg-accent text-ink absolute inset-0 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold"
        >
          <MkIcon icon={checkIcon} className="size-5" />
          Plan created
        </span>
      </div>
    </div>
  )
}

const CHANNELS = [
  { icon: linkIcon, label: 'Payment link' },
  { icon: codeIcon, label: 'Embed on your site' },
  { icon: shopIcon, label: 'Storefront' },
] as const

// A fixed pattern that reads as a QR code; it encodes nothing, so it carries no label claiming otherwise.
const QR = [
  '1111111010111111',
  '1000001001100001',
  '1011101011101101',
  '1011101000101101',
  '1011101011101101',
  '1000001010100001',
  '1111111010111111',
  '0000000011000000',
  '1101011100110110',
  '0110100101011011',
  '1011011010110100',
  '0000000010011011',
  '1111111001101010',
  '1000001011010110',
  '1011101010011101',
  '1111111011011011',
]

export function ShareScene() {
  return (
    <div data-scene="share" className="space-y-4 p-5 sm:p-6">
      <p className="font-sora text-foreground text-[15px] font-semibold">Share your checkout</p>
      <div
        data-link
        className="border-accent/40 bg-accent/5 flex items-center gap-3 rounded-2xl border p-3"
      >
        <span className="bg-accent text-ink grid size-9 shrink-0 place-items-center rounded-xl">
          <MkIcon icon={linkIcon} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-poppins text-muted-foreground text-[11px]">Pro, $49.00 a month</p>
          <p className="text-foreground truncate font-mono text-[13px]">strimz.finance/pay/pro</p>
        </div>
        <span
          data-copied
          className="font-poppins text-accent-ink dark:text-accent text-xs font-medium"
        >
          Copied
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-3 sm:gap-4">
        <ul className="min-w-0 space-y-2">
          {CHANNELS.map((c) => (
            <li
              key={c.label}
              data-channel
              className="border-border bg-background font-poppins text-foreground flex h-11 items-center gap-2.5 whitespace-nowrap rounded-xl border px-3 text-[13px] sm:text-sm"
            >
              <MkIcon icon={c.icon} className="text-accent size-[18px]" />
              {c.label}
            </li>
          ))}
        </ul>
        <div
          data-qr
          className="border-border bg-background grid size-[112px] place-items-center rounded-2xl border p-2.5 sm:size-[148px] sm:p-3"
        >
          <div className="grid size-full grid-cols-[repeat(16,1fr)] gap-px">
            {QR.join('')
              .split('')
              .map((bit, i) => (
                <span
                  key={i}
                  className={cn('rounded-[1px]', bit === '1' ? 'bg-foreground' : 'bg-transparent')}
                />
              ))}
          </div>
        </div>
      </div>
      <p className="font-poppins text-muted-foreground flex items-center gap-2 text-xs">
        <MkIcon icon={qrIcon} className="size-4" />
        Print it, post it, or send it in an invoice.
      </p>
    </div>
  )
}

export function ApproveScene() {
  return (
    <div data-scene="approve" className="flex h-full items-center justify-center p-5 sm:p-6">
      <div
        data-wallet
        className="border-border bg-background w-full max-w-[320px] rounded-[26px] border p-5 shadow-[0_30px_60px_-30px_rgb(5_0_32/0.45)]"
      >
        <div className="flex items-center gap-2">
          <span className="bg-ink text-accent grid size-8 place-items-center rounded-full">
            <MkIcon icon={walletIcon} className="size-[18px]" />
          </span>
          <p className="font-poppins text-foreground text-sm font-medium">
            Your customer&apos;s wallet
          </p>
        </div>
        <p className="font-poppins text-muted-foreground mt-5 text-xs">Approve a subscription</p>
        <p className="font-sora text-foreground mt-1 text-[28px] font-semibold tracking-[-0.03em]">
          49.00 <span className="text-muted-foreground text-base font-medium">USDC / month</span>
        </p>
        <dl className="font-poppins mt-4 space-y-2 text-xs">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">To</dt>
            <dd className="text-foreground">Acme Studio</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Network fee</dt>
            <dd className="text-accent-ink dark:text-accent font-medium">Paid by Strimz</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Cancel</dt>
            <dd className="text-foreground">Any time, from the wallet</dd>
          </div>
        </dl>
        <div className="relative mt-5 h-11">
          <span
            data-approve
            className="font-poppins bg-foreground text-background absolute inset-0 flex items-center justify-center rounded-xl text-sm font-semibold"
          >
            Approve
          </span>
          <span
            data-approving
            className="font-poppins bg-muted text-foreground absolute inset-0 flex items-center justify-center gap-2 rounded-xl text-sm font-medium opacity-0"
          >
            <span className="border-foreground/20 border-t-accent size-4 animate-spin rounded-full border-2" />
            Confirming on Arc
          </span>
          <span
            data-approved
            className="font-poppins bg-accent text-ink absolute inset-0 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold"
          >
            <MkIcon icon={checkIcon} className="size-5" />
            Approved
          </span>
        </div>
      </div>
    </div>
  )
}

const RENEWALS = [
  { date: 'Oct 18', status: 'Paid', done: true },
  { date: 'Nov 18', status: 'Scheduled', done: false },
  { date: 'Dec 18', status: 'Scheduled', done: false },
] as const

export function PaidScene() {
  return (
    <div data-scene="paid" className="space-y-4 p-5 sm:p-6">
      <div className="bg-ink grain relative overflow-hidden rounded-2xl p-5">
        <div
          aria-hidden
          className="absolute -right-16 -top-16 size-48 rounded-full bg-[radial-gradient(closest-side,rgb(2_199_106/0.35),transparent)]"
        />
        <p className="font-poppins text-ink-muted relative text-xs">Your wallet</p>
        <p className="font-sora relative mt-1 text-[34px] font-semibold tracking-[-0.03em] text-white">
          +
          <span data-balance className="tabular-nums">
            49.00
          </span>{' '}
          <span className="text-accent-soft text-base font-medium">USDC</span>
        </p>
        <p className="font-poppins relative mt-1 text-xs text-white/60">
          Settled on Arc. No fee on your first $1,000.
        </p>
      </div>
      <ol className="relative space-y-3 pl-6">
        <span aria-hidden className="bg-border absolute bottom-2 left-[7px] top-2 w-px" />
        <span
          aria-hidden
          data-renew-line
          className="bg-accent absolute left-[7px] top-2 h-[calc(100%-16px)] w-px origin-top"
        />
        {RENEWALS.map((r) => (
          <li key={r.date} data-renewal className="relative flex items-center justify-between">
            <span
              aria-hidden
              className={cn(
                'absolute -left-6 top-1/2 size-[15px] -translate-y-1/2 rounded-full border-2',
                r.done ? 'border-accent bg-accent' : 'border-accent bg-background',
              )}
            />
            <span className="font-poppins text-foreground text-sm">{r.date}</span>
            <span
              className={cn(
                'font-poppins text-xs',
                r.done ? 'text-accent-ink dark:text-accent font-medium' : 'text-muted-foreground',
              )}
            >
              {r.status}
            </span>
          </li>
        ))}
      </ol>
      <div className="grid grid-cols-2 gap-2">
        <span
          data-notify
          className="border-border bg-background font-poppins text-foreground flex h-10 items-center gap-2 rounded-xl border px-3 text-xs"
        >
          <MkIcon icon={letterIcon} className="text-accent size-4" />
          Receipt emailed
        </span>
        <span
          data-notify
          className="border-border bg-background font-poppins text-foreground flex h-10 items-center gap-2 rounded-xl border px-3 text-xs"
        >
          <MkIcon icon={repeatIcon} className="text-accent size-4" />
          Renews monthly
        </span>
      </div>
    </div>
  )
}
