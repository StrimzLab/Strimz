'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@strimz/ui'
import { FAQS } from './faq-data'

// Row styling adapted from Vengeance UI's FAQ Accordion (MIT), on the accessible Radix accordion.
export function Faq() {
  return (
    <section
      aria-labelledby="faq-title"
      className="mx-auto grid max-w-[1280px] gap-10 px-5 py-20 sm:px-10 sm:py-28 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16"
    >
      <div className="lg:sticky lg:top-28 lg:self-start">
        <h2
          id="faq-title"
          className="font-sora text-foreground text-[34px] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-[48px]"
        >
          Questions, answered.
        </h2>
        <p className="font-poppins text-muted-foreground mt-4 text-base">
          Don&apos;t see yours?{' '}
          <a
            href="mailto:support@strimz.finance"
            className="text-foreground decoration-accent font-medium underline decoration-2 underline-offset-4"
          >
            Email us
          </a>
          . A person reads every message.
        </p>
      </div>
      <Accordion type="single" collapsible className="border-border border-t">
        {FAQS.map((f) => (
          <AccordionItem
            key={f.q}
            value={f.q}
            className="border-border data-[state=open]:border-l-accent data-[state=open]:bg-muted/60 border-b border-l-4 border-l-transparent transition-colors duration-300"
          >
            <AccordionTrigger className="font-sora text-foreground group relative py-5 pl-12 pr-4 text-left text-base font-semibold tracking-[-0.01em] hover:no-underline sm:text-lg [&>svg]:hidden">
              <span
                aria-hidden
                className="border-border text-muted-foreground group-data-[state=open]:border-accent group-data-[state=open]:bg-accent group-data-[state=open]:text-ink absolute left-3 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full border transition-colors duration-300"
              >
                <span className="absolute h-0.5 w-2.5 rounded-full bg-current" />
                <span className="absolute h-2.5 w-0.5 rounded-full bg-current transition-transform duration-300 group-data-[state=open]:scale-y-0" />
              </span>
              {f.q}
            </AccordionTrigger>
            <AccordionContent className="font-poppins text-muted-foreground pl-12 pr-6 text-[15px] leading-[1.75]">
              {f.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
