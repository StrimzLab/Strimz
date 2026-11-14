'use client'

import { useState } from 'react'
import { CREATORS, FIRST_CREATOR } from '@/lib/creators'
import { CreatorAvatar } from './CreatorAvatar'
import { TipWidget } from './TipWidget'

export function CreatorsAndTips() {
  const [selected, setSelected] = useState(FIRST_CREATOR)

  return (
    <section id="creators" className="bg-surface scroll-mt-28 py-24">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[1fr_420px]">
        <div>
          <h2 className="font-display text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">
            On the line this week.
          </h2>
          <p className="muted mt-4 max-w-lg text-lg leading-8">
            Choose who to back. Your tip goes to them directly, not into a platform balance.
          </p>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2">
            {CREATORS.map((c) => {
              const active = c.handle === selected.handle
              return (
                <li key={c.handle}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelected(c)}
                    className={
                      'card flex w-full items-center gap-4 rounded-3xl p-4 text-left transition ' +
                      (active ? 'ring-brand-500 ring-2' : 'hover:-translate-y-0.5')
                    }
                  >
                    <CreatorAvatar creator={c} />
                    <span className="min-w-0">
                      <span className="font-display block truncate text-lg font-bold leading-tight">
                        {c.name}
                      </span>
                      <span className="muted block truncate text-sm">@{c.handle}</span>
                      <span className="muted block truncate text-sm">
                        {c.craft} · {c.city}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
        <div id="tip" className="scroll-mt-28 lg:pt-4">
          <TipWidget creator={selected} />
        </div>
      </div>
    </section>
  )
}
