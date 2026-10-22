'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowLeftRight,
  BarChart3,
  Check,
  Copy,
  CreditCard,
  Home,
  Layers,
  Plus,
  Receipt,
  Users,
} from 'lucide-react'
import { FieldLabel, cn } from '@strimz/ui'
import blueLogoSrc from '@/../public/logo/blueLogo.png'
import whiteLogoSrc from '@/../public/logo/whiteLogo.png'
import { ScrollTrigger, gsap, useGSAP } from '../motion/gsap'
import { TOUR_LABELS as L } from './tour-data'

const W = 960
const H = 600

const NAME = 'Team'
const PRICE = '80.00'
const MRR = [1240, 1320] as const
const SUBSCRIBERS = [31, 32] as const
const WEEK = [860, 940] as const

type Page = 'plans' | 'detail' | 'home'
const URL: Record<Page, string> = {
  plans: 'strimz.finance/app/plans',
  detail: 'strimz.finance/app/plans/plan_9xq2',
  home: 'strimz.finance/app',
}

const usdc = (n: number) =>
  `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`

interface Point {
  x: number
  y: number
}

export default function TourScene({
  reducedMotion,
  replay,
  onStep,
}: {
  reducedMotion: boolean
  replay: number
  onStep: (step: number) => void
}) {
  const fit = useRef<HTMLDivElement>(null)
  const cam = useRef<HTMLDivElement>(null)
  const tl = useRef<gsap.core.Timeline | null>(null)
  const stepRef = useRef(onStep)
  stepRef.current = onStep
  const [scale, setScale] = useState(0)
  const [built, setBuilt] = useState(false)
  const [page, setPage] = useState<Page>(reducedMotion ? 'home' : 'plans')

  useEffect(() => {
    const el = fit.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / W)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const { contextSafe } = useGSAP({ scope: cam })
  const measurable = scale > 0

  useEffect(() => {
    if (!measurable) return
    let cancelled = false
    const build = contextSafe(() => {
      if (cancelled || !cam.current || tl.current) return
      const timeline = buildTimeline(cam.current, {
        onStep: (step) => stepRef.current(step),
        onPage: setPage,
      })
      tl.current = timeline
      if (reducedMotion) timeline.progress(1)
      else
        ScrollTrigger.create({
          trigger: fit.current,
          start: 'top 60%',
          onEnter: () => {
            if (timeline.progress() === 0) timeline.play()
          },
        })
      setBuilt(true)
    })
    void document.fonts.ready.then(build)
    return () => {
      cancelled = true
    }
  }, [measurable, reducedMotion, contextSafe])

  useEffect(
    () => () => {
      tl.current = null
    },
    [],
  )

  useEffect(() => {
    if (replay > 0) tl.current?.restart()
  }, [replay])

  useEffect(() => {
    let paused = false
    const onVisibility = () => {
      const t = tl.current
      if (!t) return
      if (document.hidden && t.isActive()) {
        t.pause()
        paused = true
      } else if (!document.hidden && paused) {
        t.resume()
        paused = false
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  return (
    <div ref={fit} aria-hidden className="relative aspect-[8/5] w-full select-none">
      <div
        className="border-border bg-background absolute left-0 top-0 origin-top-left overflow-hidden rounded-[14px] border shadow-[0_40px_80px_-40px_rgb(5_0_32/0.45)]"
        style={{ width: W, height: H, transform: `scale(${scale})`, opacity: built ? 1 : 0 }}
      >
        <div
          ref={cam}
          className="relative size-full origin-top-left"
          style={{ width: W, height: H }}
        >
          <ChromeBar url={URL[page]} />
          <div className="flex h-[calc(100%-36px)]">
            <Sidebar active={page === 'home' ? 'Home' : 'Plans'} />
            <main className="relative min-w-0 flex-1 p-7">
              <PlansPage />
              <DetailPage />
              <HomePage />
            </main>
          </div>
          <NewPlanDialog />
          <Toast />
          <span
            data-ripple
            className="border-accent pointer-events-none absolute left-0 top-0 -ml-5 -mt-5 size-10 rounded-full border-2 opacity-0"
          />
          <Cursor />
        </div>
      </div>
    </div>
  )
}

function buildTimeline(
  root: HTMLElement,
  { onStep, onPage }: { onStep: (step: number) => void; onPage: (page: Page) => void },
) {
  const q = gsap.utils.selector(root)
  const one = (sel: string) => q(sel)[0] as HTMLElement
  const camBox = root.getBoundingClientRect()
  const ratio = camBox.width / W
  const at = (sel: string, dx = 0.5, dy = 0.5): Point => {
    const r = one(sel).getBoundingClientRect()
    return {
      x: (r.left - camBox.left + r.width * dx) / ratio,
      y: (r.top - camBox.top + r.height * dy) / ratio,
    }
  }

  const p = {
    newPlan: at('[data-new-plan]'),
    name: at('[data-input="name"]', 0.3),
    price: at('[data-input="price"]', 0.3),
    create: at('[data-create]'),
    teamRow: at('[data-team-row]', 0.12),
    copy: at('[data-copy]'),
    toast: at('[data-toast]'),
    home: at('[data-nav="Home"]', 0.3),
    mrr: at('[data-kpi="mrr"]'),
    recent: at('[data-recent]', 0.5, 0.2),
  }
  const recentRowHeight = one('[data-new-payment]').offsetHeight

  const focus = (pt: Point, s: number) => ({
    x: gsap.utils.clamp(W - W * s, 0, W / 2 - pt.x * s),
    y: gsap.utils.clamp(H - H * s, 0, H / 2 - pt.y * s),
    scale: s,
  })

  gsap.set(root, { transformOrigin: '0 0', x: 0, y: 0, scale: 1 })
  gsap.set('[data-cursor]', { x: 700, y: 470, autoAlpha: 1 })
  gsap.set(['[data-page="detail"]', '[data-page="home"]'], { autoAlpha: 0 })
  gsap.set(['[data-overlay]', '[data-dialog]', '[data-team-row]', '[data-toast]'], {
    autoAlpha: 0,
  })
  gsap.set('[data-new-payment]', { height: 0, autoAlpha: 0 })

  const text = {
    name: one('[data-typed="name"]'),
    price: one('[data-typed="price"]'),
    mrr: one('[data-count="mrr"]'),
    subs: one('[data-count="subs"]'),
    week: one('[data-count="week"]'),
  }
  const placeholders = q('[data-placeholder]') as HTMLElement[]
  const carets = { name: one('[data-caret="name"]'), price: one('[data-caret="price"]') }

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } })

  const move = (to: Point, duration = 1.1, position?: gsap.Position) => {
    tl.to('[data-cursor]', { x: to.x, duration, ease: 'power2.inOut' }, position)
    tl.to('[data-cursor]', { y: to.y, duration, ease: 'sine.inOut' }, '<')
  }
  const camera = (pt: Point, s: number, duration = 1.1, position: gsap.Position = '<') => {
    tl.to(root, { ...focus(pt, s), duration }, position)
  }
  const click = (pt: Point, target?: string) => {
    tl.set('[data-ripple]', { x: pt.x, y: pt.y, scale: 0.4, autoAlpha: 0.6 })
    tl.to(
      '[data-cursor]',
      { scale: 0.82, duration: 0.12, yoyo: true, repeat: 1, ease: 'power1.out' },
      '<',
    )
    if (target) tl.to(target, { scale: 0.95, duration: 0.12, yoyo: true, repeat: 1 }, '<')
    tl.to('[data-ripple]', { scale: 2.2, autoAlpha: 0, duration: 0.6, ease: 'power2.out' }, '<')
  }
  const type = (field: 'name' | 'price', value: string) => {
    const proxy = { n: 0 }
    tl.to(proxy, {
      n: value.length,
      duration: value.length * 0.16,
      ease: `steps(${value.length})`,
      onUpdate: () => {
        text[field].textContent = value.slice(0, Math.round(proxy.n))
      },
    })
  }

  tl.addLabel('create')
  move(p.newPlan)
  camera(p.newPlan, 1.4)
  click(p.newPlan, '[data-new-plan]')
  tl.addLabel('dialog', '+=0.15')
  tl.to('[data-overlay]', { autoAlpha: 1, duration: 0.35 }, 'dialog')
  tl.fromTo(
    '[data-dialog]',
    { autoAlpha: 0, scale: 0.94, y: 14 },
    { autoAlpha: 1, scale: 1, y: 0, duration: 0.55, ease: 'back.out(1.4)' },
    'dialog',
  )
  camera({ x: W / 2, y: H / 2 }, 1.2, 0.9, 'dialog')
  move(p.name, 1, 'dialog+=0.3')
  click(p.name)
  tl.addLabel('typeName')
  type('name', NAME)
  move(p.price, 0.8, '+=0.2')
  click(p.price)
  tl.addLabel('typePrice')
  type('price', PRICE)
  tl.addLabel('typed')
  move(p.create, 0.8, '+=0.25')
  click(p.create, '[data-create]')
  tl.addLabel('created', '+=0.1')
  tl.to(['[data-dialog]', '[data-overlay]'], { autoAlpha: 0, duration: 0.3 }, 'created')
  tl.fromTo(
    '[data-team-row]',
    { autoAlpha: 0, y: -8 },
    { autoAlpha: 1, y: 0, duration: 0.5, ease: 'back.out(1.6)' },
    'created+=0.2',
  )
  camera(p.teamRow, 1.3, 1, 'created+=0.1')
  tl.fromTo(
    '[data-team-ring]',
    { autoAlpha: 1 },
    { autoAlpha: 0, duration: 0.6, ease: 'power1.out' },
    'created+=1.6',
  )

  tl.addLabel('copy', '+=0.3')
  move(p.teamRow, 0.9, 'copy')
  click(p.teamRow)
  tl.addLabel('detail', '+=0.05')
  tl.to('[data-page="plans"]', { autoAlpha: 0, duration: 0.3 }, 'detail')
  tl.to('[data-page="detail"]', { autoAlpha: 1, duration: 0.35 }, 'detail+=0.15')
  camera({ x: W / 2, y: H / 2 }, 1, 0.8, 'detail')
  move(p.copy, 1.1, 'detail+=0.5')
  camera(p.copy, 1.4)
  click(p.copy, '[data-copy]')
  tl.fromTo(
    '[data-toast]',
    { autoAlpha: 0, y: 16 },
    { autoAlpha: 1, y: 0, duration: 0.45, ease: 'back.out(1.6)' },
    '+=0.05',
  )
  camera({ x: (p.copy.x + p.toast.x) / 2, y: (p.copy.y + p.toast.y) / 2 }, 1.25, 0.8, '<')
  tl.to('[data-toast]', { autoAlpha: 0, duration: 0.3 }, '+=1.1')

  tl.addLabel('paid')
  camera({ x: W / 2, y: H / 2 }, 1, 0.9, 'paid')
  move(p.home, 1.1, 'paid')
  click(p.home)
  tl.addLabel('home', '+=0.05')
  tl.to('[data-page="detail"]', { autoAlpha: 0, duration: 0.3 }, 'home')
  tl.to('[data-page="home"]', { autoAlpha: 1, duration: 0.35 }, 'home+=0.15')
  tl.to('[data-cursor]', { autoAlpha: 0, duration: 0.4 }, 'home+=0.4')
  camera(p.recent, 1.3, 1, 'home+=0.6')
  tl.to(
    '[data-new-payment]',
    { height: recentRowHeight, autoAlpha: 1, duration: 0.55, ease: 'power3.out' },
    'home+=1.2',
  )
  tl.addLabel('count', '+=0.3')
  camera(p.mrr, 1.35, 0.9, 'count')
  const count = { mrr: MRR[0], subs: SUBSCRIBERS[0], week: WEEK[0] }
  tl.to(
    count,
    {
      mrr: MRR[1],
      subs: SUBSCRIBERS[1],
      week: WEEK[1],
      duration: 0.9,
      ease: 'power2.out',
      onUpdate: () => {
        text.mrr.textContent = usdc(count.mrr)
        text.subs.textContent = String(Math.round(count.subs))
        text.week.textContent = usdc(count.week)
      },
    },
    'count+=0.7',
  )
  tl.to(root, { ...focus({ x: W / 2, y: H / 2 }, 1), duration: 1.1 }, '+=1')

  const labels = tl.labels as Record<string, number>
  let lastStep = -1
  let lastPage: Page | null = null
  const paint = () => {
    const t = tl.time()
    const step = t >= (labels.paid ?? 0) ? 2 : t >= (labels.copy ?? 0) ? 1 : 0
    const page: Page =
      t >= (labels.home ?? 0) ? 'home' : t >= (labels.detail ?? 0) ? 'detail' : 'plans'
    if (step !== lastStep) onStep((lastStep = step))
    if (page !== lastPage) onPage((lastPage = page))
    const typingName = t >= (labels.typeName ?? 0) && t < (labels.typePrice ?? 0)
    const typingPrice = t >= (labels.typePrice ?? 0) && t < (labels.created ?? 0)
    carets.name.style.visibility = typingName ? 'visible' : 'hidden'
    carets.price.style.visibility = typingPrice ? 'visible' : 'hidden'
    for (const el of placeholders) {
      const field = el.dataset.placeholder as 'name' | 'price'
      el.style.display = text[field].textContent ? 'none' : ''
    }
  }
  tl.eventCallback('onUpdate', paint)
  tl.eventCallback('onStart', paint)
  return tl
}

function ChromeBar({ url }: { url: string }) {
  return (
    <div className="border-border bg-muted flex h-9 items-center gap-2 border-b px-4">
      <span className="bg-window-close size-2.5 rounded-full" />
      <span className="bg-window-minimize size-2.5 rounded-full" />
      <span className="bg-window-zoom size-2.5 rounded-full" />
      <div className="bg-card ml-3 flex w-[340px] items-center gap-1.5 rounded-md px-3 py-1 ring-1 ring-black/5">
        <span className="bg-accent size-1 shrink-0 rounded-full" />
        <span className="text-muted-foreground truncate font-mono text-[11px]">{url}</span>
      </div>
    </div>
  )
}

const NAV = [
  {
    label: 'Overview',
    links: [
      ['Home', Home],
      ['Analytics', BarChart3],
    ],
  },
  {
    label: 'Payments',
    links: [
      ['Payment links', CreditCard],
      ['Transactions', ArrowLeftRight],
      ['Plans', Layers],
      ['Subscriptions', Receipt],
      ['Invoices', Receipt],
    ],
  },
  { label: 'Customers', links: [['Customers', Users]] },
] as const

function Sidebar({ active }: { active: string }) {
  return (
    <aside className="border-border bg-muted flex w-[200px] shrink-0 flex-col border-r">
      <div className="border-border flex h-14 items-center border-b px-5">
        <Image src={blueLogoSrc} alt="" className="h-auto w-[92px] dark:hidden" />
        <Image src={whiteLogoSrc} alt="" className="hidden h-auto w-[92px] dark:block" />
      </div>
      <nav className="space-y-5 p-3 pt-4">
        {NAV.map((section) => (
          <div key={section.label}>
            <div className="font-poppins text-muted-foreground/80 mb-1.5 px-3 text-[9px] font-[600] uppercase tracking-[0.18em]">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.links.map(([label, Icon]) => (
                <div
                  key={label}
                  data-nav={label}
                  className={cn(
                    'font-poppins flex items-center gap-2.5 rounded-md border px-3 py-1.5 text-[13px] transition-colors duration-300',
                    label === active
                      ? 'shadow-sidebar-link border-border bg-card text-foreground font-[500]'
                      : 'text-muted-foreground border-transparent',
                  )}
                >
                  <Icon className={cn('size-3.5', label === active && 'text-accent')} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}

function PageTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-w-0">
      <h3 className="font-sora text-foreground text-[22px] font-semibold tracking-[-0.02em]">
        {title}
      </h3>
      <p className="font-poppins text-muted-foreground mt-1 text-[13px]">{description}</p>
    </div>
  )
}

function ActivePill() {
  return (
    <span className="bg-accent/10 text-accent-ink dark:text-accent rounded-full px-2 py-0.5 text-[11px] font-medium">
      active
    </span>
  )
}

function PlansPage() {
  return (
    <section data-page="plans" className="absolute inset-7">
      <div className="flex items-start justify-between gap-6">
        <PageTitle title="Plans" description={L.plans} />
        <span
          data-new-plan
          className="bg-accent font-poppins inline-flex h-9 shrink-0 items-center rounded-md px-3 text-sm font-medium text-white"
        >
          <Plus className="mr-1.5 size-4" /> {L.newPlan}
        </span>
      </div>
      <div className="border-border bg-card font-poppins mt-6 overflow-hidden rounded-xl border text-[13px]">
        <div className="border-border text-muted-foreground grid grid-cols-[1.2fr_1.6fr_1fr_1fr] border-b px-5 py-3 text-xs">
          <span>Plan</span>
          <span>Price</span>
          <span>Trial</span>
          <span>Status</span>
        </div>
        <PlanRow name="Starter" price="20.00 USDC / month" trial="7 days" />
        <div data-team-row className="relative">
          <span
            data-team-ring
            className="ring-accent/60 bg-accent/5 pointer-events-none absolute inset-1 rounded-lg ring-2"
          />
          <PlanRow name={NAME} price={`${PRICE} USDC / month`} trial="None" />
        </div>
      </div>
    </section>
  )
}

function PlanRow({ name, price, trial }: { name: string; price: string; trial: string }) {
  return (
    <div className="border-border grid grid-cols-[1.2fr_1.6fr_1fr_1fr] items-center border-b px-5 py-3.5 last:border-b-0">
      <span className="text-foreground font-medium">{name}</span>
      <span className="text-foreground font-mono text-xs">{price}</span>
      <span className="text-muted-foreground">{trial}</span>
      <span>
        <ActivePill />
      </span>
    </div>
  )
}

function DetailPage() {
  return (
    <section data-page="detail" className="font-poppins absolute inset-7">
      <span className="text-muted-foreground inline-flex items-center gap-1 text-[13px]">
        <ArrowLeft className="size-3.5" /> Plans
      </span>
      <div className="mt-3 flex items-center gap-3">
        <h3 className="font-sora text-foreground text-[22px] font-semibold">{NAME}</h3>
        <ActivePill />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 text-[13px]">
        <div className="border-border bg-card space-y-3 rounded-xl border p-5">
          <Detail label="Price" value={`${PRICE} USDC`} />
          <Detail label="Interval" value="Every month" />
          <Detail label="Trial" value="None" />
        </div>
        <div className="border-border bg-card space-y-3 rounded-xl border p-5">
          <div className="text-foreground font-medium">{L.signUpLink}</div>
          <div className="border-border/60 bg-muted/30 flex items-center gap-2 rounded-md border p-2">
            <code className="text-foreground min-w-0 flex-1 truncate text-xs">
              strimz.finance/sub/plan_9xq2
            </code>
            <span
              data-copy
              className="border-border bg-card text-foreground inline-flex size-8 items-center justify-center rounded-md border"
            >
              <Copy className="size-3.5" />
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  )
}

const KPIS = [
  { key: 'mrr', label: L.mrr, value: usdc(MRR[0]), note: 'From active subscriptions' },
  {
    key: 'subs',
    label: L.subscribers,
    value: String(SUBSCRIBERS[0]),
    note: 'Paying you every period',
  },
  { key: 'week', label: 'Last 7 days', value: usdc(WEEK[0]), note: 'Confirmed payments' },
] as const

const RECENT = [
  { name: 'Starter', id: 'cs_4mVt81kQ', amount: usdc(20) },
  { name: 'Pro', id: 'cs_9cPa33nR', amount: usdc(49) },
] as const

function HomePage() {
  return (
    <section data-page="home" className="font-poppins absolute inset-7">
      <PageTitle title="Welcome back" description="What's happening across your billing surface." />
      <div className="mt-5 grid grid-cols-3 gap-3">
        {KPIS.map((k) => (
          <div
            key={k.key}
            data-kpi={k.key}
            className="border-border/60 bg-card shadow-sub-card rounded-xl border p-4"
          >
            <div className="text-muted-foreground text-xs font-medium">{k.label}</div>
            <div
              data-count={k.key}
              className="font-sora text-foreground mt-2 text-lg font-bold tabular-nums tracking-tight"
            >
              {k.value}
            </div>
            <div className="text-muted-foreground mt-0.5 text-[11px]">{k.note}</div>
          </div>
        ))}
      </div>
      <div
        data-recent
        className="border-border/60 bg-card shadow-sub-card mt-4 rounded-xl border p-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-foreground text-sm font-semibold">{L.recent}</h4>
          <span className="text-accent text-xs font-medium">View all →</span>
        </div>
        <div data-new-payment className="overflow-hidden">
          <div className="pb-2">
            <RecentRow name={NAME} id="cs_7Hq2r5Zd" amount={usdc(80)} fresh />
          </div>
        </div>
        <div className="space-y-2">
          {RECENT.map((r) => (
            <RecentRow key={r.id} {...r} />
          ))}
        </div>
      </div>
    </section>
  )
}

function RecentRow({
  name,
  id,
  amount,
  fresh = false,
}: {
  name: string
  id: string
  amount: string
  fresh?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg border p-2.5',
        fresh ? 'border-accent/40 bg-accent/5' : 'border-border/60',
      )}
    >
      <div className="min-w-0">
        <div className="text-foreground text-[13px] font-medium">{name}</div>
        <code className="text-muted-foreground text-[11px]">{id}…</code>
      </div>
      <div className="text-foreground font-mono text-[13px]">{amount}</div>
    </div>
  )
}

function Field({
  id,
  label,
  placeholder,
  className,
}: {
  id: 'name' | 'price'
  label: string
  placeholder: string
  className?: string
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <FieldLabel required>{label}</FieldLabel>
      <div
        data-input={id}
        className="border-border bg-background flex h-9 items-center rounded-md border px-3 text-sm"
      >
        <span data-typed={id} className="text-foreground" />
        <span
          data-caret={id}
          className="bg-foreground invisible ml-px h-4 w-px animate-[tk-blink_1s_steps(1)_infinite] motion-reduce:animate-none"
        />
        <span data-placeholder={id} className="text-muted-foreground">
          {placeholder}
        </span>
      </div>
    </div>
  )
}

function SelectBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1.5">
      <FieldLabel required>{label}</FieldLabel>
      <div className="border-border bg-background text-foreground flex h-9 items-center justify-between rounded-md border px-3 text-sm">
        {value}
        <span className="text-muted-foreground text-xs">▾</span>
      </div>
    </div>
  )
}

function NewPlanDialog() {
  return (
    <>
      <div data-overlay className="absolute inset-0 bg-black/40 opacity-0" />
      <div
        data-dialog
        className="border-border bg-card font-poppins absolute left-1/2 top-[70px] w-[400px] -translate-x-1/2 rounded-xl border p-6 opacity-0 shadow-2xl"
      >
        <h4 className="font-sora text-foreground text-lg font-semibold">{L.dialogTitle}</h4>
        <p className="text-muted-foreground mt-1.5 text-[13px] leading-snug">
          Plans cannot be edited after creation. To change the price, create a new plan and archive
          the old one.
        </p>
        <div className="mt-4 space-y-3">
          <Field id="name" label={L.planName} placeholder="Pro" />
          <div className="grid grid-cols-2 gap-3">
            <Field id="price" label={L.price} placeholder="29.00" />
            <SelectBox label={L.currency} value="USDC" />
          </div>
          <SelectBox label={L.interval} value="Monthly" />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <span className="border-border text-foreground inline-flex h-9 items-center rounded-md border px-3 text-sm">
            Cancel
          </span>
          <span
            data-create
            className="bg-accent inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-white"
          >
            {L.createPlan}
          </span>
        </div>
      </div>
    </>
  )
}

function Toast() {
  return (
    <div
      data-toast
      className="border-border bg-card font-poppins text-foreground absolute bottom-6 right-6 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm opacity-0 shadow-lg"
    >
      <Check className="text-accent size-4" />
      {L.copied}
    </div>
  )
}

function Cursor() {
  return (
    <svg
      data-cursor
      width="22"
      height="22"
      viewBox="0 0 24 24"
      className="pointer-events-none absolute left-0 top-0 drop-shadow-md"
    >
      <path
        d="M4 2.5 19.5 12l-6.6 1.4L9.6 20 4 2.5Z"
        className="fill-foreground stroke-background"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}
