import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(WEB_ROOT, path), 'utf8')

describe('agent escrow is hidden for launch', () => {
  const agents = read('src/app/(dashboard)/app/agents/page.tsx')

  it('has no Jobs tab, job dialog or commerce settings on the agents page', () => {
    expect(agents).not.toMatch(/JobsTab|CreateAgentJobDialog|CommerceSettingsDialog/u)
  })

  it('shows the commerce card as coming soon from the capability flag', () => {
    expect(agents).toMatch(/AGENT_CAPABILITIES\.commerce\.available/u)
  })

  it('removes the job detail route', () => {
    expect(existsSync(join(WEB_ROOT, 'src/app/(dashboard)/app/agents/jobs/[id]/page.tsx'))).toBe(
      false,
    )
  })

  it('offers only selectable events in the webhook form', () => {
    const webhooks = read('src/app/(dashboard)/app/webhooks/page.tsx')
    expect(webhooks).toMatch(/selectableWebhookEvents/u)
    expect(webhooks).not.toMatch(/webhookEventNameSchema\.options/u)
  })

  it('does not mention escrow in the footer', () => {
    expect(read('src/components/marketing/footer.tsx')).not.toMatch(/escrow/iu)
  })
})
