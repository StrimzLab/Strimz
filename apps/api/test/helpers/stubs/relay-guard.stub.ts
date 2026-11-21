import {
  relayUnavailable,
  type RelayGuardService,
} from '../../../src/modules/relay/relay-guard.service.js'

/** A guard that admits everything; the e2e tests cover its limits. */
export function openRelayGuard(): RelayGuardService {
  return {
    admit: () => Promise.resolve(),
    commit: () => Promise.resolve(),
    recordRevert: () => Promise.resolve(),
    unavailable: (
      reason: Parameters<RelayGuardService['unavailable']>[0],
      call: { to: `0x${string}`; data: `0x${string}` },
    ) => relayUnavailable(reason, { ...call, chainId: 5042002 }),
  } as unknown as RelayGuardService
}
