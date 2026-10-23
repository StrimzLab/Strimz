'use client'

import * as React from 'react'
import { useStrimzSubscribe, type StrimzSubscriptionResult } from '../hooks/useStrimzSubscribe.js'
import type { CheckoutMode } from '../hooks/useHostedPopup.js'
import type { StrimzSubscriptionError } from '../subscription-error.js'
import {
  StrimzMark,
  strimzButtonStyle,
  type StrimzButtonSize,
  type StrimzButtonTheme,
} from './button-style.js'

export interface StrimzSubscribeButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onError'
> {
  /** Plan id from the dashboard or `subscriptionPlans.create`. */
  planId: string
  /** Hosted checkout open mode. Default `popup`. */
  mode?: CheckoutMode
  theme?: StrimzButtonTheme
  size?: StrimzButtonSize
  onSuccess?: (result: StrimzSubscriptionResult) => void
  onCancel?: () => void
  onError?: (error: StrimzSubscriptionError) => void
  /** Override the button label. Default "Subscribe with Strimz". */
  label?: React.ReactNode
}

/**
 *   <StrimzSubscribeButton planId={plan.id} onSuccess={({ subscriptionId }) => ...} />
 */
export const StrimzSubscribeButton = React.forwardRef<
  HTMLButtonElement,
  StrimzSubscribeButtonProps
>(function StrimzSubscribeButton(
  {
    planId,
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
  const subscribe = useStrimzSubscribe({ mode, onSuccess, onCancel, onError })

  const handleClick = (ev: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(ev)
    if (ev.defaultPrevented || !planId) return
    subscribe.open(planId)
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={handleClick}
      style={{ ...strimzButtonStyle({ theme, size }), ...(style ?? {}) }}
      data-strimz-subscribe-button
      data-status={subscribe.status}
      {...rest}
    >
      {label ?? defaultLabel}
    </button>
  )
})

const defaultLabel = (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
    <StrimzMark size={16} />
    Subscribe with Strimz
  </span>
)
