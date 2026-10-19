import { HOW_IT_WORKS, networkNote, type CheckoutFlow } from '@/lib/checkout-copy'

export function HowItWorks({ flow, symbol }: { flow: CheckoutFlow; symbol: string }) {
  return (
    <div className="bg-muted/30 text-muted-foreground rounded-lg p-4 text-xs">
      <p className="text-foreground font-medium">How it works</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        {HOW_IT_WORKS[flow].map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="mt-3">{networkNote(symbol)}</p>
    </div>
  )
}
