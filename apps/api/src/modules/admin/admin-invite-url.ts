export function inviteAcceptUrl(dashboardUrl: string, token: string): string {
  return `${dashboardUrl.replace(/\/+$/, '')}/admin/accept-invite?token=${encodeURIComponent(token)}`
}

// Lets local and staging setups accept invites without email. Never in production.
export function inviteAcceptUrlForResponse(
  nodeEnv: string,
  dashboardUrl: string,
  token: string,
): string | undefined {
  return nodeEnv === 'production' ? undefined : inviteAcceptUrl(dashboardUrl, token)
}
