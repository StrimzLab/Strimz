import { WebhookTargetPolicy } from '../../../src/infra/webhook-transport/webhook-target-policy.js'

export class StubWebhookTargetPolicy extends WebhookTargetPolicy {
  private readonly loopbackPorts = new Set<number>()

  allowLoopbackPort(port: number): void {
    this.loopbackPorts.add(port)
  }

  reset(): void {
    this.loopbackPorts.clear()
  }

  override permits(address: string, port: number): boolean {
    if (address === '127.0.0.1' && this.loopbackPorts.has(port)) return true
    return super.permits(address, port)
  }
}
