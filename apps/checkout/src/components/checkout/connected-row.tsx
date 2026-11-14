import { Wallet } from 'lucide-react'

export function ConnectedRow({ address, onChange }: { address: string; onChange: () => void }) {
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`
  return (
    <div className="font-poppins border-border bg-muted flex items-center justify-between rounded-md border px-3 py-2 text-xs">
      <span className="flex items-center gap-2">
        <Wallet className="text-accent size-3.5" />
        <span className="text-muted-foreground">Paying from</span>
        <span className="text-foreground font-medium tabular-nums">{short}</span>
      </span>
      <button
        type="button"
        onClick={onChange}
        className="text-muted-foreground hover:text-foreground font-[500]"
      >
        Change
      </button>
    </div>
  )
}
