// Re-exports the Privy guard under its old name so existing imports still
// resolve. New code should import `PrivyAuthGuard` directly.
export { PrivyAuthGuard as JwtGuard } from './privy.guard.js'
