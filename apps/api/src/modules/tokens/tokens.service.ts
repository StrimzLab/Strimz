import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { TokenMetadata, TokenPermitNonce } from '@strimz/shared-types'

import { ChainService } from '../../infra/chain/chain.service.js'
import { TypedConfigService } from '../../config/index.js'
import {
  CAP_PERMIT_2612,
  CAP_TRANSFER_AUTH_3009,
  eip2612NoncesAbi,
  erc20MetadataAbi,
  erc5267Eip712DomainAbi,
  tokenWhitelistAbi,
} from './tokens.abi.js'

/**
 * Reads token metadata + Strimz-whitelist capabilities from the chain.
 *
 * Consumed by the public `/v1/tokens/:address` endpoint, which the
 * browser SDK uses to (1) pick the right meta-tx path for a token and
 * (2) build the EIP-712 typed-data domain.
 *
 * Caching is deliberately omitted in v1 — token metadata is stable
 * but the read load on Arc Testnet is negligible, and adding a cache
 * before we see signal would commit us to invalidation logic we
 * don't yet need. Revisit once a public endpoint shows meaningful QPS.
 */
@Injectable()
export class TokensService {
  private readonly log = new Logger(TokensService.name)
  private readonly tokenWhitelistAddress: `0x${string}` | undefined

  constructor(
    private readonly chain: ChainService,
    cfg: TypedConfigService,
  ) {
    this.tokenWhitelistAddress = cfg.env.STRIMZ_TOKEN_WHITELIST_ADDRESS as
      | `0x${string}`
      | undefined
  }

  /**
   * Returns the canonical metadata + capabilities for `token`. Throws
   * `NotFoundException` if the token is not whitelisted (Strimz only
   * supports submission paths for tokens we've explicitly accepted).
   */
  async getMetadata(token: `0x${string}`): Promise<TokenMetadata> {
    if (!this.tokenWhitelistAddress) {
      throw new Error('STRIMZ_TOKEN_WHITELIST_ADDRESS is not configured')
    }
    const lower = token.toLowerCase() as `0x${string}`

    // Capability + whitelist check first — if the token isn't on the
    // list, the caller can stop right here. Cheaper than four metadata
    // calls on a token we don't support.
    const isWhitelisted = await this.chain.client.readContract({
      address: this.tokenWhitelistAddress,
      abi: tokenWhitelistAbi,
      functionName: 'isWhitelisted',
      args: [lower],
    })
    if (!isWhitelisted) {
      throw new NotFoundException({
        code: 'token_not_whitelisted',
        message: `token ${token} is not on the Strimz whitelist`,
      })
    }
    const capabilities = await this.chain.client.readContract({
      address: this.tokenWhitelistAddress,
      abi: tokenWhitelistAbi,
      functionName: 'getCapabilities',
      args: [lower],
    })
    const capByte = Number(capabilities)

    // ERC-20 standard metadata. These rarely fail on a serious token,
    // but if any do we treat it as "this token is broken" and 502.
    const [name, symbol, decimals] = await Promise.all([
      this.chain.client.readContract({
        address: lower,
        abi: erc20MetadataAbi,
        functionName: 'name',
      }),
      this.chain.client.readContract({
        address: lower,
        abi: erc20MetadataAbi,
        functionName: 'symbol',
      }),
      this.chain.client.readContract({
        address: lower,
        abi: erc20MetadataAbi,
        functionName: 'decimals',
      }),
    ])

    // ERC-5267 eip712Domain() is the right place to read the EIP-712
    // version. OZ's ERC20Permit ships it in v5+, real USDC implements
    // it. Tokens without ERC-5267 fall back to version "1" — the OZ
    // default that EIP-2612 itself recommends.
    let version = '1'
    try {
      const domain = await this.chain.client.readContract({
        address: lower,
        abi: erc5267Eip712DomainAbi,
        functionName: 'eip712Domain',
      })
      version = domain[2]
    } catch {
      this.log.debug(
        `${token}: eip712Domain() unavailable, defaulting version="1"`,
      )
    }

    return {
      address: lower,
      name,
      symbol,
      version,
      decimals: Number(decimals),
      capabilities: {
        permit2612: (capByte & CAP_PERMIT_2612) === CAP_PERMIT_2612,
        transferAuth3009: (capByte & CAP_TRANSFER_AUTH_3009) === CAP_TRANSFER_AUTH_3009,
      },
    }
  }

  /**
   * Returns the EIP-2612 permit nonce for `owner` on `token`. The
   * browser SDK reads this immediately before signing a Permit — the
   * token contract rejects stale nonces, so a race with a concurrent
   * permit on the same owner just fails predictably (the second
   * permit reverts at the token; the subscription enrolment is not
   * created).
   */
  async getPermitNonce(token: `0x${string}`, owner: `0x${string}`): Promise<TokenPermitNonce> {
    const lower = token.toLowerCase() as `0x${string}`
    try {
      const nonce = await this.chain.client.readContract({
        address: lower,
        abi: eip2612NoncesAbi,
        functionName: 'nonces',
        args: [owner],
      })
      return {
        token: lower,
        owner: owner.toLowerCase() as `0x${string}`,
        nonce: nonce.toString(),
      }
    } catch (err) {
      // The most likely shape: `nonces` reverts because the token does
      // not implement EIP-2612. Surface that as a 404 with a clear
      // diagnostic rather than 500.
      throw new NotFoundException({
        code: 'token_missing_permit',
        message:
          `token ${token} does not implement EIP-2612 nonces() ` +
          `(${(err as Error).message})`,
      })
    }
  }
}
