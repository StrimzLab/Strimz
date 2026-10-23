'use client'

import * as React from 'react'
import { useStrimzCheckout, type CheckoutMode } from '../hooks/useStrimzCheckout.js'
import {
  StrimzMark,
  strimzButtonStyle,
  type StrimzButtonSize,
  type StrimzButtonTheme,
} from './button-style.js'

export type StrimzPayButtonTheme = StrimzButtonTheme
export type StrimzPayButtonSize = StrimzButtonSize

export interface StrimzPayButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onError'
> {
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
        style={{ ...strimzButtonStyle({ theme, size }), ...(style ?? {}) }}
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
