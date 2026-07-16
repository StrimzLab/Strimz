import { StarIcon } from './Icons'
import { TipWidget } from './TipWidget'

/**
 * The centrepiece of the demo: a mock creator profile with the tip
 * widget wired into a real Strimz payment session. `creatorHandle` is
 * echoed back into the payment metadata so the merchant dashboard
 * shows exactly which creator the tip was for — the pattern a real
 * Fanline backend would use to route payouts.
 */
export function CreatorSpotlight() {
  return (
    <section id="creators" className="border-t border-[hsl(var(--border))] py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-10 md:grid-cols-[1.15fr_1fr]">
          <div className="card rounded-3xl p-10">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="from-brand-400 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br to-purple-500 text-2xl font-semibold text-white">
                  M
                </div>
                <span className="bg-brand-500 absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border-2 border-[hsl(var(--card))]">
                  <StarIcon className="h-3 w-3 text-white" />
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-2xl font-semibold">Mira Kaseki</h3>
                  <span className="bg-brand-500/10 text-brand-500 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
                    verified
                  </span>
                </div>
                <p className="muted text-sm">@mira · Electronic + ambient</p>
              </div>
            </div>
            <p className="muted mt-6 leading-7">
              &ldquo;I quit Patreon in April. My Fanline tips clear the same afternoon they&rsquo;re
              sent — no more waiting three weeks for a payout that might get held. The tools are
              boring in the best way.&rdquo;
            </p>
            <div className="mt-8 flex gap-6 text-sm">
              <div>
                <div className="font-display text-2xl font-semibold">4.2k</div>
                <div className="muted">Fans</div>
              </div>
              <div>
                <div className="font-display text-2xl font-semibold">$18,240</div>
                <div className="muted">This month</div>
              </div>
              <div>
                <div className="font-display text-2xl font-semibold">4.9</div>
                <div className="muted">Rating</div>
              </div>
            </div>
          </div>

          <TipWidget creatorHandle="mira" />
        </div>
      </div>
    </section>
  )
}
