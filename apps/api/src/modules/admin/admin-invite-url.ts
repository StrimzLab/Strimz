export function inviteAcceptUrl(adminUrl: string, token: string): string {
  return `${adminUrl.replace(/\/+$/, '')}/admin/accept-invite?token=${encodeURIComponent(token)}`
}

// Lets local and staging setups accept invites without email. Never in production.
export function inviteAcceptUrlForResponse(
  nodeEnv: string,
  adminUrl: string,
  token: string,
): string | undefined {
  return nodeEnv === 'production' ? undefined : inviteAcceptUrl(adminUrl, token)
}
