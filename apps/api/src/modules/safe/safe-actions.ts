import {
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  isAddress,
  isAddressEqual,
  keccak256,
  parseAbiParameters,
  toHex,
  zeroAddress,
  zeroHash,
  type Address,
  type Hex,
} from 'viem'
import { z } from 'zod'

import { safeAbis } from './safe-abi.js'

const address = z
  .string()
  .refine((v) => isAddress(v, { strict: false }), 'not an address')
  .transform((v) => getAddress(v))
  .refine((v) => v !== zeroAddress, 'the zero address is not allowed')

const bytes32 = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/u, 'not a 32-byte hex value') as z.ZodType<Hex>

const pausable = z.enum(['payments', 'subscriptions'])
const roleTarget = z.enum([
  'registry',
  'payments',
  'subscriptions',
  'feeCollector',
  'tokenWhitelist',
])
const roleName = z.enum([
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
])
const threshold = z.number().int()

export const safeActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('pause'), contract: pausable }).strict(),
  z.object({ kind: z.literal('unpause'), contract: pausable }).strict(),
  z
    .object({
      kind: z.literal('withdrawFees'),
      token: z.enum(['USDC', 'EURC']),
      to: address,
      amount: z.string().regex(/^[1-9][0-9]{0,30}$/u, 'a positive whole number of base units'),
    })
    .strict(),
  z
    .object({
      kind: z.literal('grantRole'),
      contract: roleTarget,
      role: roleName,
      account: address,
    })
    .strict(),
  z
    .object({
      kind: z.literal('revokeRole'),
      contract: roleTarget,
      role: roleName,
      account: address,
    })
    .strict(),
  z.object({ kind: z.literal('timelockCancel'), operationId: bytes32 }).strict(),
  z.object({ kind: z.literal('addOwner'), owner: address, threshold }).strict(),
  z.object({ kind: z.literal('removeOwner'), owner: address, threshold }).strict(),
  z.object({ kind: z.literal('swapOwner'), oldOwner: address, newOwner: address }).strict(),
  z.object({ kind: z.literal('changeThreshold'), threshold }).strict(),
])

export type SafeAction = z.infer<typeof safeActionSchema>
export type RoleTarget = z.infer<typeof roleTarget>

export interface SafeContext {
  safe: Address
  timelock: Address
  contracts: Record<RoleTarget, Address>
  tokens: { USDC: Address; EURC: Address }
  owners: Address[]
  threshold: number
  timelockDelay: bigint
}

export interface TimelockCall {
  target: Address
  data: Hex
  salt: Hex
  operationId: Hex
}

export interface BuiltSafeCall {
  call: { to: Address; value: bigint; data: Hex; operation: 0 }
  timelock?: TimelockCall
}

const SENTINEL_OWNERS: Address = '0x0000000000000000000000000000000000000001'

// Roles whose admin is ADMIN_ROLE, which the Safe holds directly on these contracts
// (AdminHandoff.sol). Every other role is administered by DEFAULT_ADMIN_ROLE, which only the
// Timelock holds.
const DIRECT_ROLES: Partial<Record<RoleTarget, readonly string[]>> = {
  registry: ['MERCHANT_REGISTRAR_ROLE', 'FEE_MANAGER_ROLE'],
  subscriptions: ['CHARGER_ROLE', 'SUBSCRIPTION_CANCELLER_ROLE'],
}

export const roleId = (name: string): Hex => keccak256(toHex(`STRIMZ_${name}`))

// TimelockController.hashOperation(target, 0, data, 0, salt).
export function timelockOperationId(target: Address, data: Hex, salt: Hex): Hex {
  return keccak256(
    encodeAbiParameters(parseAbiParameters('address, uint256, bytes, bytes32, bytes32'), [
      target,
      0n,
      data,
      zeroHash,
      salt,
    ]),
  )
}

const direct = (to: Address, data: Hex): BuiltSafeCall => ({
  call: { to, value: 0n, data, operation: 0 },
})

function checkThreshold(next: number, owners: number) {
  if (next < 2) throw new Error('the threshold must be at least 2')
  if (next > owners) throw new Error(`a threshold of ${next} is more than the ${owners} owners`)
}

function isOwner(ctx: SafeContext, who: Address) {
  return ctx.owners.some((o) => isAddressEqual(o, who))
}

function prevOwner(ctx: SafeContext, who: Address): Address {
  const i = ctx.owners.findIndex((o) => isAddressEqual(o, who))
  if (i < 0) throw new Error(`${who} is not an owner`)
  return ctx.owners[i - 1] ?? SENTINEL_OWNERS
}

export function buildSafeCall(action: SafeAction, ctx: SafeContext, salt: Hex): BuiltSafeCall {
  const owners = ctx.owners.length
  switch (action.kind) {
    case 'pause':
    case 'unpause':
      return direct(
        ctx.contracts[action.contract],
        encodeFunctionData({ abi: safeAbis.pausable, functionName: action.kind }),
      )
    case 'withdrawFees':
      return direct(
        ctx.contracts.feeCollector,
        encodeFunctionData({
          abi: safeAbis.feeCollector,
          functionName: 'withdraw',
          args: [ctx.tokens[action.token], action.to, BigInt(action.amount)],
        }),
      )
    case 'grantRole':
    case 'revokeRole': {
      const target = ctx.contracts[action.contract]
      const data = encodeFunctionData({
        abi: safeAbis.accessControl,
        functionName: action.kind,
        args: [roleId(action.role), action.account],
      })
      if (DIRECT_ROLES[action.contract]?.includes(action.role)) return direct(target, data)
      return {
        call: {
          to: ctx.timelock,
          value: 0n,
          operation: 0,
          data: encodeFunctionData({
            abi: safeAbis.timelock,
            functionName: 'schedule',
            args: [target, 0n, data, zeroHash, salt, ctx.timelockDelay],
          }),
        },
        timelock: { target, data, salt, operationId: timelockOperationId(target, data, salt) },
      }
    }
    case 'timelockCancel':
      return direct(
        ctx.timelock,
        encodeFunctionData({
          abi: safeAbis.timelock,
          functionName: 'cancel',
          args: [action.operationId],
        }),
      )
    case 'addOwner':
      if (isOwner(ctx, action.owner)) throw new Error(`${action.owner} is already an owner`)
      checkThreshold(action.threshold, owners + 1)
      return direct(
        ctx.safe,
        encodeFunctionData({
          abi: safeAbis.safe,
          functionName: 'addOwnerWithThreshold',
          args: [action.owner, BigInt(action.threshold)],
        }),
      )
    case 'removeOwner': {
      const prev = prevOwner(ctx, action.owner)
      checkThreshold(action.threshold, owners - 1)
      return direct(
        ctx.safe,
        encodeFunctionData({
          abi: safeAbis.safe,
          functionName: 'removeOwner',
          args: [prev, action.owner, BigInt(action.threshold)],
        }),
      )
    }
    case 'swapOwner': {
      const prev = prevOwner(ctx, action.oldOwner)
      if (isOwner(ctx, action.newOwner)) throw new Error(`${action.newOwner} is already an owner`)
      return direct(
        ctx.safe,
        encodeFunctionData({
          abi: safeAbis.safe,
          functionName: 'swapOwner',
          args: [prev, action.oldOwner, action.newOwner],
        }),
      )
    }
    case 'changeThreshold':
      checkThreshold(action.threshold, owners)
      return direct(
        ctx.safe,
        encodeFunctionData({
          abi: safeAbis.safe,
          functionName: 'changeThreshold',
          args: [BigInt(action.threshold)],
        }),
      )
  }
}

export function timelockExecuteCall(ctx: SafeContext, op: TimelockCall): BuiltSafeCall {
  return direct(
    ctx.timelock,
    encodeFunctionData({
      abi: safeAbis.timelock,
      functionName: 'execute',
      args: [op.target, 0n, op.data, zeroHash, op.salt],
    }),
  )
}
