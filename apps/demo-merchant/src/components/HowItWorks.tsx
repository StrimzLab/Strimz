const STEPS = [
  {
    title: 'Pick a creator and an amount',
    body: 'From $2. Tips go to one creator; Pro supports everyone you follow.',
  },
  {
    title: 'Approve it in your wallet',
    body: 'One signature. No card details, no account to fill in, no network fee to pay.',
  },
  {
    title: 'They have it in seconds',
    body: 'The USDC lands in the creator’s own wallet, ready to spend or cash out.',
  },
]

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-28 border-t border-[hsl(var(--border))] py-24">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="font-display max-w-xl text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">
          From your wallet to theirs.
        </h2>
        <ol className="mt-12 grid gap-10 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="border-t-2 border-[hsl(var(--fg))] pt-5">
              <span className="font-display text-brand-500 text-sm font-bold">Step {i + 1}</span>
              <h3 className="font-display mt-2 text-2xl font-bold tracking-tight">{s.title}</h3>
              <p className="muted mt-3 leading-7">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
