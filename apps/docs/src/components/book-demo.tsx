import { bookDemoUrl } from '@strimz/web-shared/lib/site-urls'

export function BookDemo() {
  return (
    <p>
      Prefer a walkthrough?{' '}
      <a href={bookDemoUrl} target="_blank" rel="noopener noreferrer">
        Book a demo
        <span className="sr-only"> (opens in a new tab)</span>
      </a>{' '}
      and we&apos;ll show you Strimz on a call.
    </p>
  )
}
