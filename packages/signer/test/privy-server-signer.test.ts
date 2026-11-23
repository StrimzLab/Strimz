import { describe, expect, it, vi } from 'vitest'
import { parseTransaction, recoverTransactionAddress, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

import {
  PrivyPolicyViolationError,
  PrivyServerSigner,
  privyWalletApi,
  toSignerAccount,
  SoftwareSigner,
  type PrivyTransaction,
  type PrivyWalletApi,
} from '../src/index.js'

const key = generatePrivateKey()
const wallet = privateKeyToAccount(key)
const PAYMENTS = '0xac238787c7b1375529c48274dc382868dd26f3aa'

// Signs with a local key, the way Privy's enclave would, and records each request.
function fakeApi(address: string = wallet.address) {
  const requests: { walletId: string; tx: PrivyTransaction }[] = []
  const api: PrivyWalletApi = {
    walletAddress: vi.fn(() => Promise.resolve(address)),
    signTransaction: vi.fn((walletId: string, tx: PrivyTransaction) => {
      requests.push({ walletId, tx })
      return wallet.signTransaction({
        type: 'eip1559',
        chainId: tx.chain_id,
        to: tx.to as Hex,
        data: tx.data as Hex,
        value: BigInt(tx.value),
        nonce: tx.nonce,
        gas: BigInt(tx.gas_limit),
        maxFeePerGas: BigInt(tx.max_fee_per_gas ?? '0x0'),
        maxPriorityFeePerGas: BigInt(tx.max_priority_fee_per_gas ?? '0x0'),
      })
    }),
  }
  return { api, requests }
}

const tx = {
  type: 'eip1559' as const,
  chainId: 5042,
  to: PAYMENTS as Hex,
  data: '0xdeadbeef' as Hex,
  value: 0n,
  nonce: 7,
  gas: 200_000n,
  maxFeePerGas: 25_000_000_000n,
  maxPriorityFeePerGas: 1_000_000_000n,
}

describe('PrivyServerSigner', () => {
  it('refuses to start when the wallet is not the expected address', async () => {
    const { api } = fakeApi('0x0000000000000000000000000000000000000001')
    await expect(
      PrivyServerSigner.connect({ api, walletId: 'w1', expectedAddress: wallet.address }),
    ).rejects.toThrow(/does not match/)
  })

  it('asks Privy to sign the whole transaction and returns its signature', async () => {
    const { api, requests } = fakeApi()
    const signer = await PrivyServerSigner.connect({
      api,
      walletId: 'w1',
      expectedAddress: wallet.address,
    })
    const signed = await toSignerAccount(signer).signTransaction(tx)

    expect(requests).toEqual([
      {
        walletId: 'w1',
        tx: {
          type: 2,
          chain_id: 5042,
          to: PAYMENTS,
          data: '0xdeadbeef',
          value: '0x0',
          nonce: 7,
          gas_limit: '0x30d40',
          max_fee_per_gas: '0x5d21dba00',
          max_priority_fee_per_gas: '0x3b9aca00',
        },
      },
    ])
    expect(await recoverTransactionAddress({ serializedTransaction: signed as never })).toBe(
      wallet.address,
    )
    expect(parseTransaction(signed).to).toBe(PAYMENTS)
  })

  it('refuses to sign a transaction that differs from the one it asked for', async () => {
    const { api } = fakeApi()
    vi.mocked(api.signTransaction).mockResolvedValueOnce(
      await wallet.signTransaction({ ...tx, to: '0x000000000000000000000000000000000000dEaD' }),
    )
    const signer = await PrivyServerSigner.connect({
      api,
      walletId: 'w1',
      expectedAddress: wallet.address,
    })
    await expect(toSignerAccount(signer).signTransaction(tx)).rejects.toThrow(/does not match/)
  })

  it('names the fields that differ, with both values (#545)', async () => {
    const { api } = fakeApi()
    vi.mocked(api.signTransaction).mockResolvedValueOnce(
      await wallet.signTransaction({ ...tx, maxPriorityFeePerGas: 2_000_000_000n }),
    )
    const signer = await PrivyServerSigner.connect({
      api,
      walletId: 'w1',
      expectedAddress: wallet.address,
    })
    await expect(toSignerAccount(signer).signTransaction(tx)).rejects.toThrow(
      'maxPriorityFeePerGas asked 1000000000 signed 2000000000',
    )
  })

  it('names the signer when Privy signs with another key', async () => {
    const { api } = fakeApi()
    vi.mocked(api.signTransaction).mockResolvedValueOnce(
      await privateKeyToAccount(generatePrivateKey()).signTransaction(tx),
    )
    const signer = await PrivyServerSigner.connect({
      api,
      walletId: 'w1',
      expectedAddress: wallet.address,
    })
    await expect(toSignerAccount(signer).signTransaction(tx)).rejects.toThrow(/signer /)
  })

  it('never signs messages or typed data', async () => {
    const { api } = fakeApi()
    const account = toSignerAccount(
      await PrivyServerSigner.connect({ api, walletId: 'w1', expectedAddress: wallet.address }),
    )
    await expect(account.signMessage({ message: 'hi' })).rejects.toThrow(/only signs transactions/)
    await expect(
      account.signTypedData({
        domain: {},
        types: { M: [{ name: 'a', type: 'uint256' }] },
        primaryType: 'M',
        message: { a: 1n },
      }),
    ).rejects.toThrow(/only signs transactions/)
    expect(api.signTransaction).not.toHaveBeenCalled()
  })

  it('still wraps a digest signer the old way', async () => {
    const software = new SoftwareSigner(key)
    const signed = await toSignerAccount(software).signTransaction(tx)
    expect(await recoverTransactionAddress({ serializedTransaction: signed as never })).toBe(
      wallet.address,
    )
  })
})

describe('privyWalletApi', () => {
  const policyError = Object.assign(new Error('400 RPC request denied due to policy violation'), {
    status: 400,
    error: { error: 'RPC request denied due to policy violation', code: 'policy_violation' },
  })

  function fakeClient(sign: () => Promise<unknown>) {
    const signTransaction = vi.fn(sign)
    const client = {
      wallets: () => ({
        get: vi.fn(() => Promise.resolve({ address: wallet.address })),
        ethereum: () => ({ signTransaction }),
      }),
    }
    return { client, signTransaction }
  }

  const request: PrivyTransaction = {
    type: 2,
    chain_id: 5042,
    to: PAYMENTS,
    data: '0x',
    value: '0x0',
    nonce: 0,
    gas_limit: '0x1',
    max_fee_per_gas: '0x1',
    max_priority_fee_per_gas: '0x1',
  }

  it('sends the authorization key with every signing request', async () => {
    const { client, signTransaction } = fakeClient(() =>
      Promise.resolve({ signed_transaction: '0xabc' }),
    )
    const api = privyWalletApi(client, 'wallet-auth:server-key')
    expect(await api.signTransaction('w1', request)).toBe('0xabc')
    expect(signTransaction).toHaveBeenCalledWith('w1', {
      params: { transaction: request },
      authorization_context: { authorization_private_keys: ['wallet-auth:server-key'] },
    })
  })

  it('reports a policy refusal as its own error and does not retry it', async () => {
    const { client, signTransaction } = fakeClient(() => Promise.reject(policyError))
    const api = privyWalletApi(client, 'wallet-auth:server-key')
    await expect(api.signTransaction('w1', request)).rejects.toBeInstanceOf(
      PrivyPolicyViolationError,
    )
    expect(signTransaction).toHaveBeenCalledTimes(1)
  })

  it('passes other failures through unchanged', async () => {
    const boom = new Error('503 upstream')
    const { client } = fakeClient(() => Promise.reject(boom))
    await expect(privyWalletApi(client, 'k').signTransaction('w1', request)).rejects.toBe(boom)
  })
})
