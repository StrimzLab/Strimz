export const DEV_LINKS = [
  { href: '/docs/sdks/server', label: 'Server SDK' },
  { href: '/docs/sdks/react', label: 'React pay button' },
  { href: '/docs/api/overview', label: 'OpenAPI' },
] as const

export const CODE_TABS = [
  {
    value: 'checkout',
    file: 'checkout.tsx',
    language: 'tsx',
    code: `import { StrimzPayButton } from '@strimz/sdk-react'

export function Checkout({ sessionId }: { sessionId: string }) {
  const done = () => location.assign('/thanks')
  return <StrimzPayButton sessionId={sessionId} onSuccess={done} />
}`,
  },
  {
    value: 'webhooks',
    file: 'webhooks.ts',
    language: 'ts',
    code: `import { verifyWebhookSignature } from '@strimz/sdk'

app.post('/webhooks/strimz', async (req, res) => {
  const body = req.rawBody.toString()
  const sig = req.headers['strimz-signature'] as string
  const { valid } = await verifyWebhookSignature(body, sig, secret)
  res.status(valid ? 200 : 401).end()
})`,
  },
] as const
