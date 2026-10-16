import { XCircle } from 'lucide-react'

export function CancelledPanel() {
  return (
    <div className="border-border bg-muted/30 rounded-xl border px-5 py-6 text-center">
      <div className="bg-muted mx-auto flex h-12 w-12 items-center justify-center rounded-full">
        <XCircle className="text-muted-foreground size-7" />
      </div>
      <h2 className="font-poppins text-foreground mt-3 text-base font-semibold tracking-tight">
        Payment cancelled
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Nothing was charged. You can close this window.
      </p>
    </div>
  )
}
