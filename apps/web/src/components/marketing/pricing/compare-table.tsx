import checkIcon from '@iconify-icons/solar/check-circle-bold'
import minusIcon from '@iconify-icons/solar/minus-circle-linear'
import { PLAN_COMPARISON, PRICING_PLANS } from '@/lib/pricing-plans'
import { MkIcon } from '../icon'
import { PopLink } from '../fx/pop-button'

export function CompareTable() {
  return (
    <section aria-labelledby="compare-title" className="bg-muted py-20 sm:py-28">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-10">
        <h2
          id="compare-title"
          className="font-sora text-foreground text-[34px] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-[48px]"
        >
          Compare every plan.
        </h2>
        <div className="border-border bg-card relative mt-10 overflow-x-auto rounded-[24px] border">
          <table className="font-poppins w-full min-w-[720px] border-collapse text-sm">
            <caption className="sr-only">Features and fees on each Strimz plan</caption>
            <thead>
              <tr className="border-border border-b">
                <th
                  scope="col"
                  className="bg-card text-muted-foreground sticky left-0 z-10 px-5 py-4 text-left font-medium"
                >
                  Feature
                </th>
                {PRICING_PLANS.map((p) => (
                  <th
                    key={p.tier}
                    scope="col"
                    className="font-sora text-foreground px-5 py-4 text-left text-base font-semibold"
                  >
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLAN_COMPARISON.map((row) => (
                <tr key={row.label} className="border-border border-b last:border-b-0">
                  <th
                    scope="row"
                    className="bg-card text-muted-foreground sticky left-0 z-10 px-5 py-4 text-left font-normal"
                  >
                    {row.label}
                  </th>
                  {row.values.map((v, i) => (
                    <td key={i} className="text-foreground px-5 py-4 tabular-nums">
                      {typeof v === 'boolean' ? (
                        v ? (
                          <>
                            <MkIcon icon={checkIcon} className="text-accent size-5" />
                            <span className="sr-only">Included</span>
                          </>
                        ) : (
                          <>
                            <MkIcon icon={minusIcon} className="text-muted-foreground/50 size-5" />
                            <span className="sr-only">Not included</span>
                          </>
                        )
                      ) : (
                        v
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-border border-t">
                <td className="bg-card sticky left-0 z-10 px-5 py-5" />
                {PRICING_PLANS.map((p) => (
                  <td key={p.tier} className="px-5 py-5">
                    <PopLink
                      href={p.cta.href}
                      size="sm"
                      tone={p.featured ? 'primary' : 'neutral'}
                      className="whitespace-nowrap"
                    >
                      {p.cta.label}
                    </PopLink>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
