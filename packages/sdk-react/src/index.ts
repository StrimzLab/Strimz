/**
 * @strimz/sdk-react
 *
 * Drop-in React components and hooks for Strimz hosted checkout.
 * All exports are 'use client' — they cannot run during SSR / RSC.
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
} from './components/StrimzCheckoutEmbed.js'
