/**
 * @strimz/email-templates
 *
 * Strimz transactional email templates. React Email components shared
 * by apps/api, apps/scheduler, and apps/agent. Renders to HTML at
 * send time via `renderToHtml`; never ships to a browser.
 */

export { renderToHtml } from './render.js'

// Templates
export { PaymentReceivedEmail } from './templates/PaymentReceivedEmail.js'
export { GasBalanceAlertEmail } from './templates/GasBalanceAlertEmail.js'
export { WelcomeEmail } from './templates/WelcomeEmail.js'
export { SubscriptionStartedEmail } from './templates/SubscriptionStartedEmail.js'
export { SubscriptionChargedEmail } from './templates/SubscriptionChargedEmail.js'
export { AdminInviteEmail } from './templates/AdminInviteEmail.js'
export { AdminRoleChangedEmail } from './templates/AdminRoleChangedEmail.js'
export { AdminStatusChangedEmail } from './templates/AdminStatusChangedEmail.js'

// Theme + primitives (exported for tests and future templates).
export {
  colors,
  fonts,
  radii,
  LOGO_URL,
  SUPPORT_EMAIL,
  STRIMZ_ORIGIN,
  STRIMZ_BRAND_URL,
  STRIMZ_BRAND_DISPLAY,
} from './theme.js'
export { Shell } from './components/Shell.js'
export { DetailRow } from './components/DetailRow.js'
