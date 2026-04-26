import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// @testing-library/react auto-cleans only when vitest globals are enabled.
// We keep globals off, so wire cleanup manually.
afterEach(() => {
  cleanup()
})
