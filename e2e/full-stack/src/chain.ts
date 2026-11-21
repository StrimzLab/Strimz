import { spawn, type ChildProcess } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ARC_TESTNET_CHAIN_ID, arcTestnet, getTokenAddress } from '@strimz/shared-config'
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  encodeFunctionData,
  http,
  parseAbi,
  type Address,
  type Hex,
} from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { CONTRACTS_DIR, run, waitFor, type LogSink } from './process.js'

// Safe v1.4.1 deployments that already exist on Arc testnet, so they exist on the fork.
const SAFE_PROXY_FACTORY: Address = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67'
const SAFE_SINGLETON: Address = '0x41675C099F32341bf84BFc5382aF534df5C7461a'
const SAFE_FALLBACK_HANDLER: Address = '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99'
const ZERO: Address = '0x0000000000000000000000000000000000000000'

export interface Actor {
  address: Address
  privateKey: Hex
}

// Fresh keys every run. The well-known test mnemonic's accounts carry EIP-7702
// delegations on Arc testnet, so on a fork they have code and sign as smart wallets.
export function freshActor(): Actor {
  const privateKey = generatePrivateKey()
  return { address: privateKeyToAccount(privateKey).address, privateKey }
}

export interface Actors {
  deployer: Actor
  merchant: Actor
  payer: Actor
  relayer: Actor
  scheduler: Actor
  safeOwners: [Actor, Actor, Actor]
  payout: Actor
  refund: Actor
}

export function createActors(): Actors {
  return {
    deployer: freshActor(),
    merchant: freshActor(),
    payer: freshActor(),
    relayer: freshActor(),
    scheduler: freshActor(),
    safeOwners: [freshActor(), freshActor(), freshActor()],
    payout: freshActor(),
    refund: freshActor(),
  }
}

export interface Deployment {
  rpcUrl: string
  startBlock: number
  usdc: Address
  eurc: Address
  registry: Address
  tokenWhitelist: Address
  feeCollector: Address
  payments: Address
  subscriptions: Address
  agentRegistry: Address
  agentEscrow: Address
  timelock: Address
  safe: Address
}

interface LogEntry {
  label: string
  contracts: Array<{ name: string; proxy: Address }>
}

export async function startFork(
  forkUrl: string,
  port: number,
  log: LogSink,
): Promise<ChildProcess> {
  const anvil = spawn(
    'arc-anvil',
    [
      '--network',
      'arc',
      '--fork-url',
      forkUrl,
      '--chain-id',
      String(ARC_TESTNET_CHAIN_ID),
      '--port',
      String(port),
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )
  log.attach('anvil', anvil)
  const rpcUrl = `http://127.0.0.1:${port}`
  const client = createPublicClient({ transport: http(rpcUrl) })
  await waitFor(
    'anvil fork',
    60_000,
    async () => (await client.getChainId()) === ARC_TESTNET_CHAIN_ID,
  )
  return anvil
}

// DeployCore appends to deployments/<chainId>.json. The fork uses the real testnet
// chain id, so deploying from the package itself would write into the committed log.
// Build output stays private too: the upgrades validator rejects a shared out/ that
// holds build info from another compile.
const PRIVATE_DIRS = new Set(['deployments', 'out', 'cache', 'broadcast'])

function scratchContractsDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'strimz-e2e-contracts-'))
  for (const name of readdirSync(CONTRACTS_DIR)) {
    if (PRIVATE_DIRS.has(name)) continue
    symlinkSync(join(CONTRACTS_DIR, name), join(dir, name))
  }
  mkdirSync(join(dir, 'deployments'))
  return dir
}

function latest(entries: LogEntry[], label: string, name: string): Address {
  const entry = entries.filter((e) => e.label === label).at(-1)
  const contract = entry?.contracts.find((c) => c.name === name)
  if (!contract) throw new Error(`deployment log has no ${label}/${name}`)
  return contract.proxy
}

export async function deploy(rpcUrl: string, actors: Actors, log: LogSink): Promise<Deployment> {
  const publicClient = createPublicClient({ transport: http(rpcUrl) })
  const startBlock = Number(await publicClient.getBlockNumber()) + 1
  const usdc = getTokenAddress('testnet', 'USDC')
  const eurc = getTokenAddress('testnet', 'EURC')

  const dir = scratchContractsDir()
  const forge = (script: string, env: Record<string, string>) =>
    run('arc-forge', ['script', script, '--network', 'arc', '--rpc-url', rpcUrl, '--broadcast'], {
      cwd: dir,
      env,
      log,
      label: script,
    })

  const base = {
    STRIMZ_DEPLOYER_PRIVATE_KEY: actors.deployer.privateKey,
    ARC_USDC_ADDRESS: usdc,
    ARC_EURC_ADDRESS: eurc,
  }
  await run('arc-forge', ['build'], { cwd: dir, log, label: 'forge-build' })

  const logFile = join(dir, 'deployments', `${ARC_TESTNET_CHAIN_ID}.json`)
  const readLog = () => JSON.parse(readFileSync(logFile, 'utf8')) as LogEntry[]

  await forge('script/DeployCore.s.sol:DeployCore', base)
  const coreLog = readLog()
  const coreEnv = {
    ...base,
    STRIMZ_REGISTRY_ADDRESS: latest(coreLog, 'core', 'StrimzRegistry'),
    STRIMZ_TOKEN_WHITELIST_ADDRESS: latest(coreLog, 'core', 'TokenWhitelist'),
    STRIMZ_FEE_COLLECTOR_ADDRESS: latest(coreLog, 'core', 'FeeCollector'),
    STRIMZ_PAYMENTS_ADDRESS: latest(coreLog, 'core', 'StrimzPayments'),
    STRIMZ_SUBSCRIPTIONS_ADDRESS: latest(coreLog, 'core', 'StrimzSubscriptions'),
  }

  await forge('script/DeployAgent.s.sol:DeployAgent', coreEnv)
  const agentLog = readLog()
  const core = {
    registry: coreEnv.STRIMZ_REGISTRY_ADDRESS,
    tokenWhitelist: coreEnv.STRIMZ_TOKEN_WHITELIST_ADDRESS,
    feeCollector: coreEnv.STRIMZ_FEE_COLLECTOR_ADDRESS,
    payments: coreEnv.STRIMZ_PAYMENTS_ADDRESS,
    subscriptions: coreEnv.STRIMZ_SUBSCRIPTIONS_ADDRESS,
    agentRegistry: latest(agentLog, 'agent', 'StrimzAgentRegistry'),
    agentEscrow: latest(agentLog, 'agent', 'StrimzAgentEscrow'),
  }

  const safe = await createSafe(rpcUrl, actors)

  await forge('script/HandoffAdmin.s.sol:HandoffAdmin', {
    ...coreEnv,
    TIMELOCK_MIN_DELAY: '300',
    STRIMZ_AGENT_REGISTRY_ADDRESS: core.agentRegistry,
    STRIMZ_AGENT_ESCROW_ADDRESS: core.agentEscrow,
    STRIMZ_SAFE_ADDRESS: safe,
    STRIMZ_RELAYER_ADDRESS: actors.relayer.address,
    STRIMZ_SCHEDULER_ADDRESS: actors.scheduler.address,
  })
  const handoff = readLog()
    .filter((e) => e.label === 'handoff')
    .at(-1)
  const timelock = handoff?.contracts[0]?.proxy
  if (!timelock) throw new Error('deployment log has no handoff entry')

  return { rpcUrl, startBlock, usdc, eurc, ...core, timelock, safe }
}

async function createSafe(rpcUrl: string, actors: Actors): Promise<Address> {
  const factoryAbi = parseAbi([
    'function createProxyWithNonce(address singleton, bytes initializer, uint256 saltNonce) returns (address)',
  ])
  const setupAbi = parseAbi([
    'function setup(address[] owners, uint256 threshold, address to, bytes data, address fallbackHandler, address paymentToken, uint256 payment, address paymentReceiver)',
  ])
  const initializer = encodeFunctionData({
    abi: setupAbi,
    functionName: 'setup',
    args: [
      actors.safeOwners.map((o) => o.address),
      2n,
      ZERO,
      '0x',
      SAFE_FALLBACK_HANDLER,
      ZERO,
      0n,
      ZERO,
    ],
  })
  const account = privateKeyToAccount(actors.deployer.privateKey)
  const publicClient = createPublicClient({ transport: http(rpcUrl) })
  const wallet = createWalletClient({ account, chain: arcTestnet, transport: http(rpcUrl) })
  const args = [SAFE_SINGLETON, initializer, BigInt(Date.now())] as const
  const { result, request } = await publicClient.simulateContract({
    account,
    address: SAFE_PROXY_FACTORY,
    abi: factoryAbi,
    functionName: 'createProxyWithNonce',
    args,
  })
  const hash = await wallet.writeContract(request)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`Safe creation reverted in ${hash}`)
  return result
}

// On Arc the native balance is the USDC balance.
export async function fundUsdc(rpcUrl: string, who: Address, wholeUsdc: bigint): Promise<void> {
  const client = createTestClient({ mode: 'anvil', transport: http(rpcUrl) })
  const code = await createPublicClient({ transport: http(rpcUrl) }).getCode({ address: who })
  if (code !== undefined)
    throw new Error(`${who} has code on the fork; test accounts must be plain EOAs`)
  await client.setBalance({ address: who, value: wholeUsdc * 10n ** 18n })
}
