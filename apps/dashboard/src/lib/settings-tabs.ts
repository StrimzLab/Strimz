export const SETTINGS_TABS = ['business', 'payout', 'notifications', 'team', 'billing'] as const
export type SettingsTab = (typeof SETTINGS_TABS)[number]

/** `?tab=security` opens the business tab, where the passkey settings live. */
export const SECURITY_TAB = 'security'

export function settingsTabFor(param: string | null): SettingsTab {
  if (param === SECURITY_TAB) return 'business'
  return (SETTINGS_TABS as readonly string[]).includes(param ?? '')
    ? (param as SettingsTab)
    : 'business'
}
