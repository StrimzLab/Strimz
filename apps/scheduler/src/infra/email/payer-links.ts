export function manageSubscriptionUrl(checkoutOrigin: string, subscriptionId: string): string {
  return `${checkoutOrigin.replace(/\/+$/, '')}/manage?subscription=${encodeURIComponent(subscriptionId)}`
}
