'use client'

import * as React from 'react'
import { useStrimzCheckout, type CheckoutMode } from '../hooks/useStrimzCheckout.js'

export type StrimzPayButtonTheme = 'auto' | 'light' | 'dark'
export type StrimzPayButtonSize = 'sm' | 'md' | 'lg'

export interface StrimzPayButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onError'> {
  /** Strimz session id created via `@strimz/sdk` on your backend. */
  sessionId: string
  /** Hosted checkout open mode. Default `popup`. */
  mode?: CheckoutMode
  /** Visual theme. `auto` follows the user's `prefers-color-scheme`. */
  theme?: StrimzPayButtonTheme
  /** Button size token. Default `md`. */
  size?: StrimzPayButtonSize
  /** Called on a successful payment with the on-chain transaction hash. */
  onSuccess?: (txHash?: string) => void
  /** Called when the payer closes the checkout without completing. */
  onCancel?: () => void
  /** Called when the checkout reports an error. */
  onError?: (error: Error) => void
  /** Override the button label. Default "Pay with Strimz". */
  label?: React.ReactNode
}

/**
 * Drop-in pay button. Opens Strimz hosted checkout in a popup or redirect.
 *
 *   <StrimzPayButton sessionId={sess.id} onSuccess={(tx) => router.push('/done')} />
 */
export const StrimzPayButton = React.forwardRef<HTMLButtonElement, StrimzPayButtonProps>(
  function StrimzPayButton(
    {
      sessionId,
      mode = 'popup',
      theme = 'auto',
      size = 'md',
      onSuccess,
      onCancel,
      onError,
      label,
      onClick,
      style,
      ...rest
    },
    ref,
  ) {
    const checkout = useStrimzCheckout({ mode, onSuccess, onCancel, onError })

    const handleClick = (ev: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(ev)
      if (ev.defaultPrevented || !sessionId) return
      checkout.open(sessionId)
    }

    return (
      <button
        ref={ref}
        type="button"
        onClick={handleClick}
        style={{ ...buttonStyle({ theme, size }), ...(style ?? {}) }}
        data-strimz-pay-button
        data-status={checkout.status}
        {...rest}
      >
        {label ?? defaultLabel}
      </button>
    )
  },
)

const defaultLabel = (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
    <StrimzMark size={16} />
    Pay with Strimz
  </span>
)

function StrimzMark({ size }: { size: number }) {
  // Inline SVG keeps the bundle dependency-free.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      role="img"
      aria-label="Strimz"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="8" cy="8" r="8" fill="#02C76A" />
      <path d="M5 9h6M5 7h6" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

interface StyleParams {
  theme: StrimzPayButtonTheme
  size: StrimzPayButtonSize
}

function buttonStyle({ theme, size }: StyleParams): React.CSSProperties {
  const dimensions = sizeMap[size]
  const palette = paletteFor(theme)
  return {
    appearance: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontWeight: 600,
    background: palette.background,
    color: palette.foreground,
    borderRadius: 10,
    paddingInline: dimensions.padX,
    paddingBlock: dimensions.padY,
    fontSize: dimensions.font,
    lineHeight: 1.2,
    transition: 'background-color 120ms ease, transform 80ms ease',
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  }
}

const sizeMap: Record<StrimzPayButtonSize, { padX: number; padY: number; font: number }> = {
  sm: { padX: 12, padY: 6, font: 13 },
  md: { padX: 16, padY: 10, font: 15 },
  lg: { padX: 20, padY: 14, font: 17 },
}

function paletteFor(theme: StrimzPayButtonTheme): { background: string; foreground: string } {
  if (theme === 'light') return { background: '#02C76A', foreground: '#FFFFFF' }
  if (theme === 'dark') return { background: '#02C76A', foreground: '#FFFFFF' }
  // auto — same brand for both modes; the surrounding app's theme handles context
  return { background: '#02C76A', foreground: '#FFFFFF' }
}
