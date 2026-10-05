import type { Metadata } from 'next'
import { ContactForm } from '@/components/marketing/contact-form'
import { Mail, MessageCircle, ShieldAlert } from 'lucide-react'
import { OG_IMAGE } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Talk to Strimz. Sales for partnerships and onboarding, support for live merchants, and a security disclosure channel for researchers.',
  openGraph: {
    title: 'Contact Strimz',
    description: 'Sales, support, and security disclosure channels for the Strimz platform.',
    url: '/contact',
    images: [OG_IMAGE],
  },
  alternates: { canonical: '/contact' },
}

const ROUTES = [
  {
    icon: Mail,
    label: 'Sales',
    addr: 'sales@strimz.finance',
    body: 'Pricing, plan upgrades, custom contracts. We reply within one business day.',
  },
  {
    icon: MessageCircle,
    label: 'Support',
    addr: 'support@strimz.finance',
    body: 'Bugs, integration questions, anything urgent in your dashboard. We read every email.',
  },
  {
    icon: ShieldAlert,
    label: 'Security',
    addr: 'security@strimz.finance',
    body: 'Responsible disclosure. PGP key is on the security page.',
  },
] as const

export default function ContactPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-background relative overflow-hidden">
        <div
          className="strimz-wave-1 absolute inset-x-0 -top-32 mx-auto h-[360px] max-w-2xl rounded-full opacity-60 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:py-24">
          <span className="font-poppins bg-accent/10 text-accent inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-[600]">
            <span className="bg-accent size-1.5 rounded-full" />
            Contact
          </span>
          <h1 className="font-sora text-foreground mt-5 text-[40px] font-[700] leading-[48px] md:text-[56px] md:leading-[60px]">
            Talk to a real person.
          </h1>
          <p className="font-poppins text-muted-foreground mx-auto mt-4 max-w-xl text-base font-[400] leading-[28px]">
            Pick the inbox that matches your question, or fill in the form below. Either way, your
            message lands with someone on our team.
          </p>
        </div>
      </section>

      {/* Routes */}
      <section className="bg-background pb-12">
        <div className="mx-auto grid max-w-5xl gap-4 px-4 sm:grid-cols-3 sm:px-6">
          {ROUTES.map((r) => (
            <a
              key={r.addr}
              href={`mailto:${r.addr}`}
              className="shadow-sub-card border-border bg-card hover:border-accent/40 rounded-[16px] border p-6 transition-colors"
            >
              <span className="shadow-sub-icon bg-accent/10 text-accent inline-flex size-10 items-center justify-center rounded-[10px]">
                <r.icon className="size-5" />
              </span>
              <div className="font-poppins text-muted-foreground mt-4 text-[11px] font-[600] uppercase tracking-widest">
                {r.label}
              </div>
              <div className="text-foreground mt-1 font-mono text-sm">{r.addr}</div>
              <p className="font-poppins text-muted-foreground mt-3 text-sm">{r.body}</p>
            </a>
          ))}
        </div>
      </section>

      {/* Form + side info */}
      <section className="bg-muted py-16">
        <div className="mx-auto grid max-w-5xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_320px]">
          <div className="shadow-sub-card border-border bg-card rounded-[20px] border p-8">
            <h2 className="font-sora text-foreground text-[24px] font-[700] md:text-[28px]">
              Send us a message
            </h2>
            <p className="font-poppins text-muted-foreground mt-2 text-sm">
              Tell us what you&apos;re building. We&apos;ll get it to the right person and reply
              within one business day.
            </p>
            <ContactForm />
          </div>

          <aside className="space-y-4">
            <div className="shadow-sub-card border-border bg-card rounded-[16px] border p-5">
              <h4 className="font-sora text-foreground text-base font-[700]">
                Need a Slack channel?
              </h4>
              <p className="font-poppins text-muted-foreground mt-2 text-sm">
                Dedicated Slack and a solutions engineer come with the Growth and Enterprise plans.
              </p>
              <a
                href="/pricing"
                className="font-poppins text-accent mt-3 inline-flex items-center text-sm font-[500] hover:underline"
              >
                See plans →
              </a>
            </div>
            <div className="shadow-sub-card border-border bg-card rounded-[16px] border p-5">
              <h4 className="font-sora text-foreground text-base font-[700]">Office hours</h4>
              <p className="font-poppins text-muted-foreground mt-2 text-sm">
                Monday – Friday, 09:00–18:00 UTC. Outside those hours we still answer security and
                production outage emails right away.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}
