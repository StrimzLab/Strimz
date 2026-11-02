import { BadRequestException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import {
  CallExecutionError,
  encodeErrorResult,
  ExecutionRevertedError,
  HttpRequestError,
  RawContractError,
  RpcRequestError,
  type Hex,
} from 'viem'
import type { KmsSigner } from '@strimz/signer'

import { RelayChainProbe } from '../../../../src/modules/relay/relay-chain-probe.js'
import { relayRevertAbi } from '../../../../src/modules/relay/relay-revert.js'
import type { ChainService } from '../../../../src/infra/chain/chain.service.js'

const RELAYER = '0x9999999999999999999999999999999999999999'
const TARGET = '0x1111111111111111111111111111111111111111'

function revertWith(data: Hex): CallExecutionError {
  return new CallExecutionError(
    new ExecutionRevertedError({ cause: new RawContractError({ data }) }),
    {},
  )
}

function probeWith(
  estimateGas: (args: unknown) => Promise<unknown>,
  readContract: (args: unknown) => Promise<unknown> = () => Promise.reject(new Error('unused')),
) {
  const calls: unknown[] = []
  const chain = {
    client: {
      estimateGas: (args: unknown) => {
        calls.push(args)
        return estimateGas(args)
      },
      readContract: (args: unknown) => {
        calls.push(args)
        return readContract(args)
      },
    },
  } as unknown as ChainService
  const signer: KmsSigner = {
    address: RELAYER,
    signDigest: () => Promise.reject(new Error('the probe never signs')),
  }
  return { probe: new RelayChainProbe(chain, signer), calls }
}

describe('RelayChainProbe.estimateGas', () => {
  it('estimates from the relayer against the latest block and returns the gas', async () => {
    const { probe, calls } = probeWith(() => Promise.resolve(123_456n))

    await expect(probe.estimateGas({ to: TARGET, data: '0xdeadbeef' })).resolves.toBe(123_456n)

    expect(calls).toEqual([
      { account: RELAYER, to: TARGET, data: '0xdeadbeef', blockTag: 'latest' },
    ])
  })

  it('names the new contract errors', async () => {
    const data = encodeErrorResult({
      abi: relayRevertAbi,
      errorName: 'Subscriptions__IntentAlreadyUsed',
      args: [`0x${'11'.repeat(32)}`],
    })
    const { probe } = probeWith(() => Promise.reject(revertWith(data)))

    await expect(probe.estimateGas({ to: TARGET, data: '0x01' })).rejects.toMatchObject({
      response: { details: { revert: 'Subscriptions__IntentAlreadyUsed' } },
    })
  })

  it('maps a custom-error revert to relay_simulation_failed with the error name', async () => {
    const data = encodeErrorResult({ abi: relayRevertAbi, errorName: 'Payments__InvalidIntent' })
    const { probe } = probeWith(() => Promise.reject(revertWith(data)))

    const err = await probe.estimateGas({ to: TARGET, data: '0x01' }).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(BadRequestException)
    expect((err as BadRequestException).getResponse()).toMatchObject({
      code: 'relay_simulation_failed',
      details: { revert: 'Payments__InvalidIntent' },
    })
  })

  it('reads revert data from a JSON-RPC error response', async () => {
    const data = encodeErrorResult({
      abi: relayRevertAbi,
      errorName: 'Registry__MerchantInactive',
      args: [3n],
    })
    const rpc = new RpcRequestError({
      body: {},
      error: { code: 3, message: 'execution reverted', data },
      url: 'http://rpc.invalid',
    })
    const { probe } = probeWith(() =>
      Promise.reject(new CallExecutionError(new ExecutionRevertedError({ cause: rpc }), {})),
    )

    await expect(probe.estimateGas({ to: TARGET, data: '0x01' })).rejects.toMatchObject({
      response: { details: { revert: 'Registry__MerchantInactive' } },
    })
  })

  it('surfaces a require string as the revert reason', async () => {
    const data = encodeErrorResult({
      abi: relayRevertAbi,
      errorName: 'Error',
      args: ['FiatTokenV2: invalid signature'],
    })
    const { probe } = probeWith(() => Promise.reject(revertWith(data)))

    await expect(probe.estimateGas({ to: TARGET, data: '0x01' })).rejects.toMatchObject({
      response: { details: { revert: 'FiatTokenV2: invalid signature' } },
    })
  })

  it('reports the selector of an unknown custom error', async () => {
    const { probe } = probeWith(() => Promise.reject(revertWith('0x12345678')))

    await expect(probe.estimateGas({ to: TARGET, data: '0x01' })).rejects.toMatchObject({
      response: { code: 'relay_simulation_failed', details: { revert: '0x12345678' } },
    })
  })

  it('propagates a transport failure unchanged', async () => {
    const transport = new CallExecutionError(
      new HttpRequestError({ url: 'http://rpc.invalid', status: 503 }),
      {},
    )
    const { probe } = probeWith(() => Promise.reject(transport))

    await expect(probe.estimateGas({ to: TARGET, data: '0x01' })).rejects.toBe(transport)
  })
})

describe('RelayChainProbe.permitNonce', () => {
  it("reads the token's EIP-2612 nonce for the payer", async () => {
    const payer = '0x5555555555555555555555555555555555555555'
    const { probe, calls } = probeWith(
      () => Promise.reject(new Error('unused')),
      () => Promise.resolve(9n),
    )

    await expect(probe.permitNonce(TARGET, payer)).resolves.toBe(9n)
    expect(calls).toMatchObject([{ address: TARGET, functionName: 'nonces', args: [payer] }])
  })
})
