import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(SRC, p), 'utf8')

function readdirRecursive(root: string, dir = ''): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const rel = dir ? `${dir}/${name}` : name
    if (name === '__tests__') return []
    if (statSync(join(root, rel)).isDirectory()) return readdirRecursive(root, rel)
    return /\.tsx?$/u.test(name) ? [rel] : []
  })
}
const providers = read('components/providers.tsx')
const prompt = read('components/dashboard/passkey-mfa-prompt.tsx')
const refunds = read('components/dashboard/refunds/use-refund-signer.ts')
const settings = read('components/dashboard/passkey-settings.tsx')

describe('one passkey prompt at a time', () => {
  it("turns off Privy's own MFA screen so it never races ours", () => {
    expect(providers).toMatch(/mfa:\s*\{\s*noPromptOnMfaRequired:\s*true\s*\}/u)
  })

  it('lets the merchant cancel while the passkey prompt is waiting', () => {
    const cancel = prompt.slice(prompt.indexOf('variant="ghost"'), prompt.indexOf('Cancel'))
    expect(cancel).not.toMatch(/disabled=\{busy\}/u)
  })
})

describe('no wallet action starts without a passkey', () => {
  // With Privy's prompts off, a wallet action from an account without passkey MFA would wait on
  // an enrolment nobody answers. Every wallet use is checked first instead.
  const walletUsers = readdirRecursive(SRC).filter((f) => /useWallets\(\)/u.test(read(f)))

  it('knows every file that uses the embedded wallet', () => {
    expect(walletUsers.sort()).toEqual(
      [
        'app/(dashboard)/app/withdraw/page.tsx',
        'components/dashboard/onchain-policy-section.tsx',
        'components/dashboard/refunds/use-refund-signer.ts',
      ].sort(),
    )
  })

  it('keeps withdrawals and payout changes behind the passkey gate', () => {
    expect(read('app/(dashboard)/app/withdraw/page.tsx')).toMatch(
      /<PasskeyGate action="withdraw">/u,
    )
    const page = read('app/(dashboard)/app/settings/page.tsx')
    const gate = page.indexOf('<PasskeyGate action="change your payout wallet or owner">')
    expect(gate).toBeGreaterThan(-1)
    expect(page.indexOf('<OnchainPolicySection', gate)).toBeGreaterThan(gate)
    expect(page.indexOf('<OnchainPolicySection', gate)).toBeLessThan(
      page.indexOf('</PasskeyGate>', gate),
    )
  })
})

describe('refunds need the passkey, like withdrawals', () => {
  it('refuses to sign a refund before the passkey can confirm it', () => {
    const check = refunds.indexOf('hasPasskeyMfa(')
    expect(check).toBeGreaterThan(-1)
    expect(check).toBeLessThan(refunds.indexOf('eth_sendTransaction'))
  })
})

describe('the server hears about a new passkey straight away', () => {
  it('syncs the merchant after enrolling, since Privy sends no webhook for enrolment', () => {
    const hook = read('hooks/use-passkey-mfa.ts')
    const enrol = hook.indexOf('submitEnrollmentWithPasskey({')
    expect(enrol).toBeGreaterThan(-1)
    expect(hook.indexOf('syncSession()', enrol)).toBeGreaterThan(enrol)
  })
})

describe('passkey settings explain the confirmation', () => {
  it('says why changing a passkey asks for one', () => {
    expect(settings).toMatch(/stolen login/u)
  })
})
