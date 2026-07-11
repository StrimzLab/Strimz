import Link from 'next/link'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { ArrowRightIcon } from '@/components/Icons'

/**
 * Hosted checkout redirects here after a successful payment. `type`
 * differentiates the copy for tips vs subscription — we don't do
 * anything with the amount server-side; the SDK's webhook is what
 * actually credits the merchant.
 */
export default async function ThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; amount?: string }>
}) {
  const params = await searchParams
  const isSubscription = params.type === 'sub'

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-500/10 text-green-500">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-7 w-7"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7" />
          </svg>
        </div>
        <h1 className="font-display mt-6 text-4xl font-semibold tracking-tight">
          {isSubscription ? 'Welcome to Fanline Pro!' : 'Tip received.'}
        </h1>
        <p className="muted mx-auto mt-4 max-w-xl text-lg leading-8">
          {isSubscription ? (
            <>You&rsquo;re now supporting your favourite creators every month.</>
          ) : (
            <>Your ${params.amount ?? ''} USDC just landed in the creator&rsquo;s wallet.</>
          )}
        </p>
        <Link
          href="/"
          className="bg-brand-500 hover:bg-brand-600 mt-10 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white"
        >
          Back to Fanline
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </main>
      <Footer />
    </>
  )
}
