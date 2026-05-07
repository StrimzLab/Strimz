import { ContactForm } from '@/components/marketing/contact-form'
import { Mail, MessageCircle, ShieldAlert } from 'lucide-react'

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
      <section className="relative overflow-hidden bg-white">
        <div
          className="strimz-wave-1 absolute inset-x-0 -top-32 mx-auto h-[360px] max-w-2xl rounded-full opacity-60 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:py-24">
          <span className="font-poppins inline-flex items-center gap-1.5 rounded-full bg-[#02C76A]/10 px-3 py-1 text-[12px] font-[600] text-[#02C76A]">
            <span className="size-1.5 rounded-full bg-[#02C76A]" />
            Contact
          </span>
          <h1 className="font-sora mt-5 text-[40px] font-[700] leading-[48px] text-[#050020] md:text-[56px] md:leading-[60px]">
            Talk to a real person.
          </h1>
          <p className="font-poppins mx-auto mt-4 max-w-xl text-base font-[400] leading-[28px] text-[#58556A]">
            Pick the inbox that matches your question, or fill in the form below. Either way, your
            message lands with someone on our team.
          </p>
        </div>
      </section>

      {/* Routes */}
      <section className="bg-white pb-12">
        <div className="mx-auto grid max-w-5xl gap-4 px-4 sm:grid-cols-3 sm:px-6">
          {ROUTES.map((r) => (
            <a
              key={r.addr}
              href={`mailto:${r.addr}`}
              className="shadow-sub-card rounded-[16px] border border-[#E5E7EB] bg-white p-6 transition-colors hover:border-[#02C76A]/40"
            >
              <span className="shadow-sub-icon inline-flex size-10 items-center justify-center rounded-[10px] bg-[#02C76A]/10 text-[#02C76A]">
                <r.icon className="size-5" />
              </span>
              <div className="font-poppins mt-4 text-[11px] font-[600] uppercase tracking-widest text-[#58556A]">
                {r.label}
              </div>
              <div className="mt-1 font-mono text-sm text-[#050020]">{r.addr}</div>
              <p className="font-poppins mt-3 text-sm text-[#58556A]">{r.body}</p>
            </a>
          ))}
        </div>
      </section>

      {/* Form + side info */}
      <section className="bg-[#F9FAFB] py-16">
        <div className="mx-auto grid max-w-5xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_320px]">
          <div className="shadow-sub-card rounded-[20px] border border-[#E5E7EB] bg-white p-8">
            <h2 className="font-sora text-[24px] font-[700] text-[#050020] md:text-[28px]">
              Send us a message
            </h2>
            <p className="font-poppins mt-2 text-sm text-[#58556A]">
              Tell us what you&apos;re building. We&apos;ll get it to the right person and reply
              within one business day.
            </p>
            <ContactForm />
          </div>

          <aside className="space-y-4">
            <div className="shadow-sub-card rounded-[16px] border border-[#E5E7EB] bg-white p-5">
              <h4 className="font-sora text-base font-[700] text-[#050020]">
                Need a Slack channel?
              </h4>
              <p className="font-poppins mt-2 text-sm text-[#58556A]">
                Dedicated Slack and a solutions engineer come with the Growth and Enterprise plans.
              </p>
              <a
                href="/pricing"
                className="font-poppins mt-3 inline-flex items-center text-sm font-[500] text-[#02C76A] hover:underline"
              >
                See plans →
              </a>
            </div>
            <div className="shadow-sub-card rounded-[16px] border border-[#E5E7EB] bg-white p-5">
              <h4 className="font-sora text-base font-[700] text-[#050020]">Office hours</h4>
              <p className="font-poppins mt-2 text-sm text-[#58556A]">
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
