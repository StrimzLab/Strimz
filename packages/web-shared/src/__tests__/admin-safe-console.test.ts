import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { REPO } from './web-source'

const ADMIN = join(REPO, 'apps/admin/src')
const read = (path: string) => readFileSync(join(ADMIN, path), 'utf8')

// ADR-2026-11-23-safe-console.
describe('admin Safe console', () => {
  it('is in the nav for super admins only', () => {
    expect(read('components/admin/admin-shell.tsx')).toMatch(
      /href: '\/admin\/safe', label: 'Safe', icon: Vault, roles: \['super_admin'\]/u,
    )
  })

  it.each(['', '/[id]/signatures', '/[id]/execute', '/[id]/timelock-execute'])(
    'forwards proposals%s through the origin-checked BFF',
    (path) => {
      const route = read(`app/api/admin/safe/proposals${path}/route.ts`)
      expect(route).toMatch(/forwardAdminWrite\(req/u)
      expect(route).toMatch(/upstreamPath: [`']\/v1\/admin\/safe\/proposals/u)
    },
  )

  it('signs with the owner’s own wallet, never the embedded one', () => {
    const hook = read('hooks/use-owner-wallet.ts')
    expect(hook).toMatch(/connectorType !== 'embedded'/u)
    expect(hook).toMatch(/eth_signTypedData_v4/u)
  })

  it('offers Approve only when the browser read the call and the hash matched', () => {
    const card = read('components/admin/safe/proposal-card.tsx')
    expect(card).toMatch(/describeSafeCall\(/u)
    expect(card).toMatch(/safeTxHashOf\(/u)
    expect(card).toMatch(/open && !problem && meIsOwner && !signedByMe/u)
  })

  it('refuses to approve when the server is on another chain than the selected mode', () => {
    expect(read('app/(admin)/admin/safe/page.tsx')).toMatch(/state\.chainId !== chainId/u)
  })

  it('has a page', () => {
    expect(existsSync(join(ADMIN, 'app/(admin)/admin/safe/page.tsx'))).toBe(true)
  })
})
