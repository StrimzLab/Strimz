import type { Metadata } from 'next'
import calendarIcon from '@iconify-icons/solar/calendar-linear'
import clockIcon from '@iconify-icons/solar/clock-circle-linear'
import letterIcon from '@iconify-icons/solar/letter-linear'
import shieldIcon from '@iconify-icons/solar/shield-check-linear'
import { ContactForm } from '@/components/marketing/contact-form'
import { MkIcon } from '@/components/marketing/icon'
import { PageHero } from '@/components/marketing/page-hero'
import { PopLink } from '@/components/marketing/fx/pop-button'
import { RiseIn } from '@/components/marketing/fx/rise-in'
import { SectionBoundary } from '@/components/marketing/fx/section-boundary'
import {
  CONTACT_TOPICS,
  DEMO_MAILTO,
  PRIORITY_SUPPORT_PLANS,
  SUPPORT_EMAIL,
  mailto,
} from '@/lib/contact-topics'
import { OG_IMAGE } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Talk to Strimz. One inbox for sales, support and security, a demo on request, and a form that reaches the team.',
  openGraph: {
    title: 'Contact Strimz',
    description: 'One inbox for sales, support and security, plus demos on request.',
    url: '/contact',
    images: [OG_IMAGE],
  },
  alternates: { canonical: '/contact' },
}

function listNames(names: readonly string[]): string {
  if (names.length < 2) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

export default function ContactPage() {
  return (
    <>
      <SectionBoundary name="contact introduction">
        <PageHero
          id="contact-title"
          label="Contact"
          lines={['Talk to a', 'real person.']}
          intro="One inbox reaches the whole team. Tell us what it is about in the subject, or use the form, and it lands with the right person."
        />
      </SectionBoundary>

      <SectionBoundary name="inbox">
        <section aria-labelledby="inbox-title" className="pb-16 sm:pb-24">
          <div className="mx-auto max-w-[1280px] px-5 sm:px-10">
            <RiseIn className="border-border bg-card grid gap-10 rounded-[28px] border p-6 sm:p-10 lg:grid-cols-[1fr_1.2fr]">
              <div data-rise>
                <span className="bg-accent/10 text-accent-ink dark:text-accent grid size-11 place-items-center rounded-xl">
                  <MkIcon icon={letterIcon} className="size-5" />
                </span>
                <h2
                  id="inbox-title"
                  className="font-sora text-foreground mt-6 text-2xl font-semibold tracking-[-0.03em] sm:text-[28px]"
                >
                  Email us
                </h2>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-foreground decoration-accent mt-2 inline-block break-all font-mono text-base underline decoration-2 underline-offset-4 sm:text-lg"
                >
                  {SUPPORT_EMAIL}
                </a>
                <p className="font-poppins text-muted-foreground mt-4 max-w-sm text-sm leading-relaxed">
                  Want to see Strimz before you sign up? Ask for a demo and we will set up a call.
                </p>
                <PopLink href={DEMO_MAILTO} className="mt-6">
                  <MkIcon icon={calendarIcon} className="size-5" />
                  Book a demo
                </PopLink>
              </div>
              <div data-rise>
                <p className="font-poppins text-muted-foreground text-sm font-medium">
                  Put one of these in the subject
                </p>
                <ul className="mt-4 space-y-3">
                  {CONTACT_TOPICS.map((topic) => (
                    <li key={topic.label}>
                      <a
                        href={mailto(topic.subject)}
                        className="border-border hover:border-accent/50 focus-visible:ring-accent group flex items-start justify-between gap-4 rounded-2xl border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2"
                      >
                        <span>
                          <span className="font-sora text-foreground block text-base font-semibold">
                            {topic.label}
                          </span>
                          <span className="font-poppins text-muted-foreground mt-1 block text-sm">
                            {topic.body}
                          </span>
                        </span>
                        <span className="font-poppins text-accent-ink dark:text-accent shrink-0 text-sm font-medium group-hover:underline">
                          Email
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </RiseIn>
          </div>
        </section>
      </SectionBoundary>

      <SectionBoundary name="contact form">
        <section aria-labelledby="form-title" className="bg-muted py-16 sm:py-24">
          <div className="mx-auto grid max-w-[1280px] gap-6 px-5 sm:px-10 lg:grid-cols-[1fr_340px]">
            <div className="border-border bg-card rounded-[28px] border p-6 sm:p-10">
              <h2
                id="form-title"
                className="font-sora text-foreground text-2xl font-semibold tracking-[-0.03em] sm:text-[28px]"
              >
                Send us a message
              </h2>
              <p className="font-poppins text-muted-foreground mt-2 text-sm">
                Tell us what you are building. We will get it to the right person and reply within
                one business day.
              </p>
              <ContactForm />
            </div>

            <aside className="space-y-4">
              <div className="border-border bg-card rounded-[24px] border p-6">
                <span className="bg-accent/10 text-accent-ink dark:text-accent grid size-10 place-items-center rounded-xl">
                  <MkIcon icon={shieldIcon} className="size-5" />
                </span>
                <h3 className="font-sora text-foreground mt-5 text-lg font-semibold">
                  Priority email support
                </h3>
                <p className="font-poppins text-muted-foreground mt-2 text-sm leading-relaxed">
                  {listNames(PRIORITY_SUPPORT_PLANS)} merchants get priority email support. Every
                  plan can reach us through this form.
                </p>
                <PopLink href="/pricing" tone="neutral" size="sm" className="mt-5">
                  See plans
                </PopLink>
              </div>
              <div className="border-border bg-card rounded-[24px] border p-6">
                <span className="bg-accent/10 text-accent-ink dark:text-accent grid size-10 place-items-center rounded-xl">
                  <MkIcon icon={clockIcon} className="size-5" />
                </span>
                <h3 className="font-sora text-foreground mt-5 text-lg font-semibold">
                  Office hours
                </h3>
                <p className="font-poppins text-muted-foreground mt-2 text-sm leading-relaxed">
                  Monday to Friday, 09:00–18:00 UTC. Outside those hours we still answer security
                  and production outage emails right away.
                </p>
              </div>
            </aside>
          </div>
        </section>
      </SectionBoundary>
    </>
  )
}
