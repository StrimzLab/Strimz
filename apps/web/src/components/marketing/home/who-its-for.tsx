'use client'

import Link from 'next/link'
import arrowIcon from '@iconify-icons/solar/arrow-right-linear'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@strimz/ui'
import { MkIcon } from '../icon'
import { RiseIn } from '../fx/rise-in'
import { USE_CASE_ICON } from '../nav-data'
import { USE_CASES } from '../use-cases/data'
import { USE_CASE_MOCKS } from '../use-cases/mock-map'

export function WhoItsFor() {
  return (
    <section aria-labelledby="who-title" className="py-20 sm:py-28">
      <RiseIn className="mx-auto max-w-[1280px] px-5 sm:px-10">
        <div data-rise className="max-w-[640px]">
          <h2
            id="who-title"
            className="font-sora text-foreground text-[34px] font-semibold leading-[1.05] tracking-[-0.04em] sm:text-[48px]"
          >
            Who it&apos;s for
          </h2>
          <p className="font-poppins text-muted-foreground mt-4 text-[17px] leading-relaxed">
            Pick the kind of business you run to see what Strimz does for it.
          </p>
        </div>

        <Tabs defaultValue={USE_CASES[0]?.id} className="mt-10">
          <TabsList data-rise aria-label="Kinds of business" className="h-auto rounded-2xl p-1.5">
            {USE_CASES.map((u) => (
              <TabsTrigger
                key={u.id}
                value={u.id}
                className="gap-2 rounded-xl px-4 py-2.5 text-[15px]"
              >
                <MkIcon
                  icon={USE_CASE_ICON[u.id]}
                  className="group-data-[state=active]:text-accent size-[18px]"
                />
                {u.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div data-rise className="mt-6 grid grid-cols-[minmax(0,1fr)]">
            {USE_CASES.map((u) => {
              const Mock = USE_CASE_MOCKS[u.mock]
              return (
                <TabsContent
                  key={u.id}
                  value={u.id}
                  forceMount
                  className="border-border bg-card mt-0 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-8 rounded-[28px] border p-6 transition-[opacity,transform,visibility] duration-300 ease-out [grid-area:1/1] data-[state=inactive]:invisible data-[state=inactive]:translate-y-2 data-[state=inactive]:opacity-0 motion-reduce:transition-none sm:p-10 lg:grid-cols-2 lg:items-center lg:gap-14"
                >
                  <div className="min-w-0">
                    <h3 className="font-sora text-foreground text-2xl font-semibold leading-tight tracking-[-0.03em] sm:text-[30px]">
                      {u.title}
                    </h3>
                    <dl className="mt-8 space-y-6">
                      <div>
                        <dt className="font-poppins text-muted-foreground text-sm">The problem</dt>
                        <dd className="font-poppins text-foreground mt-1.5 text-[17px] leading-relaxed">
                          {u.pain}
                        </dd>
                      </div>
                      <div className="border-accent border-l-2 pl-4">
                        <dt className="font-poppins text-accent-ink dark:text-accent text-sm font-medium">
                          With Strimz
                        </dt>
                        <dd className="font-poppins text-foreground mt-1.5 text-[17px] leading-relaxed">
                          {u.fix}
                        </dd>
                      </div>
                    </dl>
                    <Link
                      href={`/use-cases#${u.id}`}
                      className="font-poppins text-foreground decoration-accent group/link mt-8 inline-flex items-center gap-1.5 text-[15px] font-medium underline decoration-2 underline-offset-[6px]"
                    >
                      See the {u.label} use case
                      <MkIcon
                        icon={arrowIcon}
                        className="size-4 transition-transform duration-200 group-hover/link:translate-x-1"
                      />
                    </Link>
                  </div>
                  <div className="mx-auto w-full min-w-0 max-w-[460px]">
                    <Mock />
                  </div>
                </TabsContent>
              )
            })}
          </div>
        </Tabs>
      </RiseIn>
    </section>
  )
}
