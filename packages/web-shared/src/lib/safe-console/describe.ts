import {
  decodeFunctionData,
  formatUnits,
  isAddressEqual,
  keccak256,
  toFunctionSelector,
  toHex,
  type Abi,
  type Address,
  type Hex,
} from 'viem'

import { safeConsoleAbis } from './abi'

export type SafeContractName =
  | 'registry'
  | 'payments'
  | 'subscriptions'
  | 'feeCollector'
  | 'tokenWhitelist'

export interface SafeKnownAddresses {
  safe: Address
  timelock: Address
  contracts: Record<SafeContractName, Address>
  tokens: { USDC: Address; EURC: Address }
}

export interface SafeCallDescription {
  title: string
  lines: string[]
}

export class UnrecognisedSafeCallError extends Error {}

const CONTRACT_LABEL: Record<SafeContractName, string> = {
  registry: 'Registry',
  payments: 'Payments',
  subscriptions: 'Subscriptions',
  feeCollector: 'Fee collector',
  tokenWhitelist: 'Token whitelist',
}

export const ROLE_NAMES = [
  'ADMIN_ROLE',
  'UPGRADER_ROLE',
  'PAUSER_ROLE',
  'TREASURY_ROLE',
  'TOKEN_MANAGER_ROLE',
  'FEE_ACCRUER_ROLE',
  'MERCHANT_REGISTRAR_ROLE',
  'FEE_MANAGER_ROLE',
  'CHARGER_ROLE',
  'SUBSCRIPTION_CANCELLER_ROLE',
] as const

const PAUSE_SELECTORS = new Set(
  safeConsoleAbis.pausable.map((f) => toFunctionSelector(f) as string),
)

const roleName = (id: Hex) =>
  ROLE_NAMES.find((name) => keccak256(toHex(`STRIMZ_${name}`)) === id) ?? null

function contractAt(known: SafeKnownAddresses, to: Address): SafeContractName | null {
  const hit = (Object.keys(known.contracts) as SafeContractName[]).find((k) =>
    isAddressEqual(known.contracts[k], to),
  )
  return hit ?? null
}

function decode<const A extends Abi>(abi: A, data: Hex) {
  try {
    return decodeFunctionData({ abi, data })
  } catch (err) {
    throw new UnrecognisedSafeCallError('this call is not one the console makes', { cause: err })
  }
}

function tokenSymbol(known: SafeKnownAddresses, token: Address) {
  if (isAddressEqual(token, known.tokens.USDC)) return 'USDC'
  if (isAddressEqual(token, known.tokens.EURC)) return 'EURC'
  throw new UnrecognisedSafeCallError(`unknown token ${token}`)
}

function describeRoleCall(known: SafeKnownAddresses, target: Address, data: Hex) {
  const contract = contractAt(known, target)
  if (!contract) throw new UnrecognisedSafeCallError(`unknown contract ${target}`)
  const call = decode(safeConsoleAbis.accessControl, data)
  const [id, account] = call.args as [Hex, Address]
  const role = roleName(id)
  if (!role) throw new UnrecognisedSafeCallError(`unknown role ${id}`)
  const verb = call.functionName === 'grantRole' ? 'Grant' : 'Revoke'
  const prep = call.functionName === 'grantRole' ? 'to' : 'from'
  return `${verb} ${role} ${prep} ${account} on ${CONTRACT_LABEL[contract]}`
}

/**
 * Reads a proposal's call the way the owner's browser sees it, independent of the server.
 * Throws for anything outside the console's menu, so nobody signs a call they can't read.
 */
export function describeSafeCall(
  known: SafeKnownAddresses,
  call: { to: Address; data: Hex },
): SafeCallDescription {
  const { to, data } = call

  if (isAddressEqual(to, known.safe)) {
    const owner = decode(safeConsoleAbis.safe, data)
    switch (owner.functionName) {
      case 'addOwnerWithThreshold': {
        const [who, threshold] = owner.args
        return {
          title: 'Add a Safe owner',
          lines: [`Add ${who}`, `Approvals needed: ${threshold}`],
        }
      }
      case 'removeOwner': {
        const [, who, threshold] = owner.args
        return {
          title: 'Remove a Safe owner',
          lines: [`Remove ${who}`, `Approvals needed: ${threshold}`],
        }
      }
      case 'swapOwner': {
        const [, oldOwner, newOwner] = owner.args
        return { title: 'Replace a Safe owner', lines: [`Remove ${oldOwner}`, `Add ${newOwner}`] }
      }
      case 'changeThreshold':
        return {
          title: 'Change the approvals needed',
          lines: [`Approvals needed: ${owner.args[0]}`],
        }
    }
  }

  if (isAddressEqual(to, known.timelock)) {
    const op = decode(safeConsoleAbis.timelock, data)
    switch (op.functionName) {
      case 'schedule': {
        const [target, value, inner, , , delay] = op.args
        if (value !== 0n) throw new UnrecognisedSafeCallError('the console never sends value')
        const hours = Number(delay) / 3600
        return {
          title: `Schedule a role change (runs after ${hours} hours)`,
          lines: [describeRoleCall(known, target, inner)],
        }
      }
      case 'execute': {
        const [target, value, inner] = op.args
        if (value !== 0n) throw new UnrecognisedSafeCallError('the console never sends value')
        return {
          title: 'Run a scheduled role change',
          lines: [describeRoleCall(known, target, inner)],
        }
      }
      case 'cancel':
        return { title: 'Cancel a scheduled change', lines: [`Operation ${op.args[0]}`] }
    }
  }

  const contract = contractAt(known, to)
  if (!contract) throw new UnrecognisedSafeCallError(`unknown contract ${to}`)

  if (contract === 'feeCollector') {
    const fee = decode(safeConsoleAbis.feeCollector, data)
    const [token, recipient, amount] = fee.args
    const symbol = tokenSymbol(known, token)
    return {
      title: 'Withdraw fees',
      lines: [`${formatUnits(amount, 6)} ${symbol}`, `To ${recipient}`],
    }
  }

  const selector = data.slice(0, 10)
  if ((contract === 'payments' || contract === 'subscriptions') && PAUSE_SELECTORS.has(selector)) {
    const p = decode(safeConsoleAbis.pausable, data)
    return {
      title: `${p.functionName === 'pause' ? 'Pause' : 'Unpause'} ${CONTRACT_LABEL[contract]}`,
      lines: [],
    }
  }

  return { title: 'Change a role now', lines: [describeRoleCall(known, to, data)] }
}
