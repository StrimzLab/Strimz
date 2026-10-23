/**
 * @strimz/sdk-react
 *
 * Drop-in React components and hooks for Strimz hosted checkout.
 * All exports are 'use client'. They cannot run during SSR or RSC.
 */

export {
  StrimzProvider,
  useStrimzContext,
  type StrimzProviderProps,
  type StrimzContextValue,
} from './provider.js'

export { useStrimzClient } from './hooks/useStrimzClient.js'
export {
  useStrimzSession,
  type UseStrimzSessionResult,
  type UseStrimzSessionOptions,
} from './hooks/useStrimzSession.js'
export {
  useStrimzCheckout,
  type UseStrimzCheckoutOptions,
  type UseStrimzCheckoutResult,
  type CheckoutMode,
} from './hooks/useStrimzCheckout.js'

export {
  StrimzPayButton,
  type StrimzPayButtonProps,
  type StrimzPayButtonTheme,
  type StrimzPayButtonSize,
} from './components/StrimzPayButton.js'
export {
  StrimzCheckoutEmbed,
  type StrimzCheckoutEmbedProps,
  type StrimzCheckoutTheme,
} from './components/StrimzCheckoutEmbed.js'
export {
  useStrimzSubscribe,
  type UseStrimzSubscribeOptions,
  type UseStrimzSubscribeResult,
  type StrimzSubscriptionResult,
} from './hooks/useStrimzSubscribe.js'
export {
  StrimzSubscribeButton,
  type StrimzSubscribeButtonProps,
} from './components/StrimzSubscribeButton.js'
export {
  StrimzSubscriptionEmbed,
  type StrimzSubscriptionEmbedProps,
} from './components/StrimzSubscriptionEmbed.js'
export { StrimzCheckoutError } from './checkout-error.js'
export { StrimzSubscriptionError } from './subscription-error.js'
