/** Shown by each app's loading.tsx while the next page arrives (#537). */
export function RouteLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      role="status"
      className="mk-route-loader flex min-h-[50vh] w-full items-center justify-center"
    >
      <span aria-hidden className="mk-loader text-brand-text" />
      <span className="sr-only">{label}</span>
    </div>
  )
}
