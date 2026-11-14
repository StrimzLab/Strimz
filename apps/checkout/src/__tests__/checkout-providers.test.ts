import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// wagmi's hooks need React Query. Before the split, the shared root providers
// supplied it; checkout now has its own root (ADR-2026-11-14-split-web-into-workers).
const source = readFileSync(join(__dirname, '..', 'components', 'checkout-providers.tsx'), 'utf8')

describe('checkout providers', () => {
  it('give wagmi a React Query client', () => {
    expect(source).toMatch(/<QueryClientProvider client=\{queryClient\}>\s*<WagmiProvider/u)
  })
})
