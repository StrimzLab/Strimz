import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/common.ts',
    'src/merchants.ts',
    'src/api-keys.ts',
    'src/customers.ts',
    'src/payment-sessions.ts',
    'src/transactions.ts',
    'src/subscriptions.ts',
    'src/refunds.ts',
    'src/webhooks.ts',
    'src/compliance.ts',
    'src/agents.ts',
    'src/storefronts.ts',
    'src/invoices.ts',
    'src/events.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  target: 'es2022',
  outDir: 'dist',
})
