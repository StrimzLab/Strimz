import { Loader2 } from 'lucide-react'
import { cn } from '@strimz/ui'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean
  loadingText?: string
}

/**
 * Big-block submit button with a baked-in loading state. Uses the
 * signature `strimz-cta-shadow` so it reads as the primary action on
 * any auth surface.
 */
export function SubmitButton({
  isLoading = false,
  loadingText = 'Submitting…',
  children,
  className,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      type="submit"
      disabled={disabled || isLoading}
      className={cn(
        'strimz-cta-shadow flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#02C76A] font-poppins text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-70',
        className,
      )}
      {...rest}
    >
      {isLoading ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  )
}
