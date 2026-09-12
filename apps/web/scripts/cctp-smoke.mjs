/**
 * Standalone CCTP burn → attest → mint smoke test.
 *
 * Runs exactly what `useBridgeFunding` runs, in the same order, against
 * the same config and the same ABI — no API, no database, no browser.
 * If this passes, the chain half of cross-chain funding is proven and
 * the only thing left untested in the hook is React state.
 *
 *   cd apps/web && node scripts/cctp-smoke.mjs --direction arc-to-arbitrum --amount 1
 *
 * Direction matters only for which addresses get used. `arc-to-arbitrum`
 * is the reverse of what the product does, but it is the same call, and
 * it is testable with Arc funds alone. Use it to prove the mechanics
 * before spending time on Arbitrum faucets.
 *
 * Options:
 *   --direction  arc-to-arbitrum | arbitrum-to-arc   (default arc-to-arbitrum)
 *   --amount     whole USDC to deliver               (default 1)
 *   --dry-run    do every read and check, sign nothing
 *   --relay      <burnTxHash> skip the burn; fetch the attestation for a
 *                burn that already happened and submit receiveMessage on
 *                the destination. Use it to finish a run that stopped
 *                after step 6, or to mint someone else's burn — the
 *                message carries its own recipient, so relaying is
 *                permissionless and cannot redirect funds.
 *
 * Env:
 *   CCTP_PRIVATE_KEY   the payer key (not needed for --dry-run)
 */

import { parseArgs } from 'node:util'
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatUnits,
  http,
  pad,
  parseEventLogs,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrumSepolia } from 'viem/chains'
import {
  CCTP_CONTRACTS,
  CCTP_DOMAIN_IDS,
  CCTP_FINALITY_FAST,
  arcTestnet,
  getCctpSourceContracts,
  getTokenAddress,
} from '@strimz/shared-config'

const { values } = parseArgs({
  options: {
    direction: { type: 'string', default: 'arc-to-arbitrum' },
    amount: { type: 'string', default: '1' },
    'dry-run': { type: 'boolean', default: false },
    relay: { type: 'string' },
  },
})

/** `receiveMessage` on the destination — what the scheduler signs in production. */
const messageTransmitterV2Abi = [
  {
    type: 'function',
    name: 'receiveMessage',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'message', type: 'bytes' },
      { name: 'attestation', type: 'bytes' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
]

/** Only `depositForBurn` — the same fragment the checkout ships. */
const tokenMessengerV2Abi = [
  {
    type: 'function',
    name: 'depositForBurn',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
      { name: 'destinationCaller', type: 'bytes32' },
      { name: 'maxFee', type: 'uint256' },
      { name: 'minFinalityThreshold', type: 'uint32' },
    ],
    outputs: [],
  },
]

const ARB_SEPOLIA_RPC = 'https://sepolia-rollup.arbitrum.io/rpc'
const CIRCLE_API = 'https://iris-api-sandbox.circle.com'

function legs() {
  const arb = getCctpSourceContracts('testnet', 'arbitrum')
  const arc = {
    chain: arcTestnet,
    rpc: arcTestnet.rpcUrls.default.http[0],
    usdc: getTokenAddress('testnet', 'USDC'),
    tokenMessengerV2: CCTP_CONTRACTS.testnet.tokenMessengerV2,
    // CCTP V2 uses one MessageTransmitter address across every testnet
    // chain, so Arc's entry is also Arbitrum Sepolia's.
    messageTransmitterV2: CCTP_CONTRACTS.testnet.messageTransmitterV2,
    domainId: CCTP_DOMAIN_IDS.arc,
    label: 'Arc testnet',
  }
  const arbitrum = {
    chain: arbitrumSepolia,
    rpc: ARB_SEPOLIA_RPC,
    usdc: arb.usdc,
    tokenMessengerV2: arb.tokenMessengerV2,
    messageTransmitterV2: CCTP_CONTRACTS.testnet.messageTransmitterV2,
    domainId: arb.domainId,
    label: 'Arbitrum Sepolia',
  }
  return values.direction === 'arbitrum-to-arc'
    ? { source: arbitrum, dest: arc }
    : { source: arc, dest: arbitrum }
}

const step = (n, msg) => console.log(`\n[${n}] ${msg}`)
const ok = (msg) => console.log(`    ✓ ${msg}`)
const info = (msg) => console.log(`    · ${msg}`)

/**
 * Polls Circle until the burn is attested. Network errors are retried:
 * the burn has already happened, so the only failure that matters is
 * running out of patience, and the message stays claimable regardless.
 */
async function waitForAttestation(sourceDomainId, burnTx, timeoutMs = 20 * 60_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(
        `${CIRCLE_API}/v2/messages/${sourceDomainId}?transactionHash=${burnTx}`,
      )
      if (res.ok) {
        const body = await res.json()
        const m = (body.messages ?? [])[0]
        if (m?.status === 'complete') {
          ok(`attested after ${Math.round((Date.now() - started) / 1000)}s`)
          const executed = m.decodedMessage?.finalityThresholdExecuted
          if (executed) {
            info(
              `finality executed: ${executed}` +
                (Number(executed) > CCTP_FINALITY_FAST
                  ? ' — fell back to standard; the fee ceiling was under Circle’s fast quote'
                  : ' — fast'),
            )
          }
          return { message: m.message, attestation: m.attestation }
        }
        info(
          `status: ${m?.status ?? 'not seen yet'} (${Math.round((Date.now() - started) / 1000)}s)`,
        )
      } else {
        info(`circle http ${res.status}, retrying`)
      }
    } catch (err) {
      info(`network error (${err.message}), retrying`)
    }
    await new Promise((r) => setTimeout(r, 10_000))
  }
  throw new Error(
    'Circle did not attest in time. The burn stands — re-check with:\n' +
      `  curl -s "${CIRCLE_API}/v2/messages/${sourceDomainId}?transactionHash=${burnTx}"`,
  )
}

async function main() {
  const { source, dest } = legs()
  const amount = BigInt(Math.round(Number(values.amount) * 1_000_000))
  // Same 2bps ceiling the hook uses, and the same gross-up: burn the
  // payment plus the fee so `amount` survives the bridge.
  const maxFee = amount / 5000n
  const burnAmount = amount + maxFee

  const key = process.env.CCTP_PRIVATE_KEY
  if (!key && !values['dry-run']) {
    console.error('error: CCTP_PRIVATE_KEY is not set (or pass --dry-run)')
    process.exit(1)
  }
  const account = key ? privateKeyToAccount(key) : null

  console.log(`${source.label} → ${dest.label}`)
  console.log(
    `deliver ${formatUnits(amount, 6)} USDC, burning ${formatUnits(burnAmount, 6)} (fee ceiling ${formatUnits(maxFee, 6)})`,
  )
  if (!account) {
    console.log('dry run — every read and check runs, nothing is signed')
  }

  const srcClient = createPublicClient({ chain: source.chain, transport: http(source.rpc) })
  const dstClient = createPublicClient({ chain: dest.chain, transport: http(dest.rpc) })

  const payer = account?.address ?? process.env.CCTP_ADDRESS
  if (!payer) {
    console.error('error: set CCTP_ADDRESS for a dry run, or CCTP_PRIVATE_KEY for a real one')
    process.exit(1)
  }
  info(`payer ${payer}`)

  if (values.relay) {
    step(1, `fetching the attestation for ${values.relay}`)
    const { message, attestation } = await waitForAttestation(source.domainId, values.relay)

    step(2, `submitting receiveMessage on ${dest.label}`)
    if (!account) {
      info('dry run — the message is attested and ready; nothing submitted')
      return
    }
    const relayWallet = createWalletClient({
      account,
      chain: dest.chain,
      transport: http(dest.rpc),
    })
    const hash = await relayWallet.writeContract({
      address: dest.messageTransmitterV2,
      abi: messageTransmitterV2Abi,
      functionName: 'receiveMessage',
      args: [message, attestation],
    })
    await dstClient.waitForTransactionReceipt({ hash })
    ok(`minted on ${dest.label} (${hash})`)
    const bal = await dstClient.readContract({
      address: dest.usdc,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [payer],
    })
    info(`${dest.label} USDC balance is now ${formatUnits(bal, 6)}`)
    return
  }

  // ---- 1. The guard that runs before the payer spends anything ----
  step(1, 'smart-wallet guard: payer must control the destination address')
  const destCode = await dstClient.getCode({ address: payer })
  if (destCode && destCode !== '0x') {
    throw new Error(
      `payer has bytecode on ${dest.label} — a mint there may be unrecoverable. Use an EOA.`,
    )
  }
  ok(`no bytecode on ${dest.label}; safe to mint to the same address`)

  // ---- 2. Balances ----
  step(2, 'balances')
  const srcBal = await srcClient.readContract({
    address: source.usdc,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [payer],
  })
  const dstBefore = await dstClient.readContract({
    address: dest.usdc,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [payer],
  })
  info(`${source.label} USDC: ${formatUnits(srcBal, 6)}`)
  info(`${dest.label} USDC: ${formatUnits(dstBefore, 6)}`)
  if (srcBal < burnAmount) {
    throw new Error(
      `need ${formatUnits(burnAmount, 6)} USDC on ${source.label}, have ${formatUnits(srcBal, 6)}`,
    )
  }
  ok('enough to cover the payment and the fee ceiling')

  // ---- 3. Encoding dry-run: does the contract accept these params? ----
  step(3, 'simulate depositForBurn (proves the ABI and params)')
  const args = [
    burnAmount,
    dest.domainId,
    pad(payer),
    source.usdc,
    pad('0x'),
    maxFee,
    CCTP_FINALITY_FAST,
  ]
  try {
    await srcClient.simulateContract({
      address: source.tokenMessengerV2,
      abi: tokenMessengerV2Abi,
      functionName: 'depositForBurn',
      args,
      account: payer,
    })
    ok('simulation passed — selector, arg order and types are all correct')
  } catch (err) {
    const msg = String(err?.shortMessage ?? err?.message ?? err)
    if (/allowance|insufficient/i.test(msg)) {
      ok('reverted on allowance only — the call itself decoded correctly')
    } else {
      throw new Error(`simulation failed, this is the ABI or the params: ${msg}`)
    }
  }

  if (values['dry-run']) {
    console.log('\ndry run complete — nothing was signed.')
    return
  }

  const wallet = createWalletClient({ account, chain: source.chain, transport: http(source.rpc) })

  // ---- 4. Approve ----
  step(4, 'approve the TokenMessenger')
  const allowance = await srcClient.readContract({
    address: source.usdc,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [payer, source.tokenMessengerV2],
  })
  if (allowance < burnAmount) {
    const hash = await wallet.writeContract({
      address: source.usdc,
      abi: erc20Abi,
      functionName: 'approve',
      args: [source.tokenMessengerV2, burnAmount],
    })
    await srcClient.waitForTransactionReceipt({ hash })
    ok(`approved (${hash})`)
  } else {
    ok('already approved')
  }

  // ---- 5. Burn ----
  step(5, 'depositForBurn')
  const burnTx = await wallet.writeContract({
    address: source.tokenMessengerV2,
    abi: tokenMessengerV2Abi,
    functionName: 'depositForBurn',
    args,
  })
  const receipt = await srcClient.waitForTransactionReceipt({ hash: burnTx })
  ok(`burned in block ${receipt.blockNumber} (${burnTx})`)

  // ---- 6. Circle attestation ----
  step(6, `polling Circle for an attestation on domain ${source.domainId}`)
  const attested = await waitForAttestation(source.domainId, burnTx)

  // ---- 7. Relay the mint ----
  //
  // In production the scheduler signs this; here the payer does it
  // themselves so the script can prove the whole loop. It needs gas on
  // the destination chain, which is a different token from the source.
  step(7, `minting on ${dest.label}`)
  const destGas = await dstClient.getBalance({ address: payer })
  if (destGas === 0n) {
    info(`no gas on ${dest.label}, so this run cannot relay the mint itself`)
    console.log('\nBurn and attestation confirmed — the valuable half is proven.')
    console.log('The message is signed and claimable at any time. Fund the payer')
    console.log(`with ${dest.label} gas, then finish with:\n`)
    console.log(`  node scripts/cctp-smoke.mjs --direction ${values.direction} --relay ${burnTx}`)
    return
  }

  const relayWallet = createWalletClient({ account, chain: dest.chain, transport: http(dest.rpc) })
  const relayTx = await relayWallet.writeContract({
    address: dest.messageTransmitterV2,
    abi: messageTransmitterV2Abi,
    functionName: 'receiveMessage',
    args: [attested.message, attested.attestation],
  })
  const relayReceipt = await dstClient.waitForTransactionReceipt({ hash: relayTx })
  ok(`relayed (${relayTx})`)

  // Read what CCTP actually minted, from the token's own Transfer event.
  //
  // A balance delta would be wrong here: Arc denominates gas in the same
  // USDC being delivered, and in this script the payer relays their own
  // message, so the relay's gas comes straight back out of the balance
  // we would be measuring. In production the scheduler relays and the
  // payer never pays it — but the event is the honest number either way.
  const minted = parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs: relayReceipt.logs })
    .filter(
      (l) =>
        l.address.toLowerCase() === dest.usdc.toLowerCase() &&
        l.args.to?.toLowerCase() === payer.toLowerCase(),
    )
    .reduce((sum, l) => sum + l.args.value, 0n)

  ok(`CCTP minted ${formatUnits(minted, 6)} USDC (asked for ${formatUnits(amount, 6)})`)
  if (minted < amount) {
    throw new Error(
      `delivered ${formatUnits(minted, 6)} but owed ${formatUnits(amount, 6)} — the fee ceiling ` +
        'did not cover what Circle charged. Raise maxFee, or quote it from ' +
        '/v2/burn/USDC/fees instead of using a fixed ceiling.',
    )
  }

  const after = await dstClient.readContract({
    address: dest.usdc,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [payer],
  })
  const gasInToken = minted - (after - dstBefore)
  if (gasInToken > 0n) {
    info(
      `balance rose by ${formatUnits(after - dstBefore, 6)} — the ` +
        `${formatUnits(gasInToken, 6)} gap is ${dest.label} gas, which this script pays ` +
        'because it relays its own message. The scheduler pays it in production.',
    )
  }
  console.log('\nend to end: burn → attest → mint all confirmed.')
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}`)
  process.exitCode = 1
})
