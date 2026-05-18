import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import {
  CurrentMerchant,
  type CurrentMerchantPayload,
} from '../../common/decorators/current-merchant.decorator.js'
import { ApiKeyGuard } from '../../common/guards/api-key.guard.js'
import { RequireScopes } from '../../common/decorators/scopes.decorator.js'
import { SubmitPaymentDto, SubmitSubscriptionDto } from './relay.dto.js'
import { RelayService } from './relay.service.js'
import type { RelaySubmissionView } from './relay.types.js'

/**
 * HTTP surface for the meta-tx relayer.
 *
 * Three endpoints, all merchant-authenticated:
 *
 *   POST /v1/relay/payments         submit a payer-signed EIP-3009 auth
 *   POST /v1/relay/subscriptions    submit a payer-signed EIP-2612 permit + enrolment
 *   GET  /v1/relay/submissions/:key look up a submission by its idempotency key
 *
 * Endpoint design notes:
 *
 *  - Idempotency: the body's `idempotencyKey` is the durable handle.
 *    Resubmitting with the same key returns the existing submission
 *    rather than creating a second one (and BullMQ rejects duplicate
 *    job ids server-side as belt-and-braces).
 *
 *  - The payer's signature travels in the request body — the payer is
 *    NOT authenticated by Strimz. The on-chain contract verifies the
 *    signature via ecrecover; that's where security lives. The API
 *    auth gates "may THIS merchant submit a meta-tx at all," not
 *    "did the payer really sign."
 *
 *  - We pass `merchantInternalId` from the auth context to the relay
 *    service so the dashboard can correlate submissions back to a
 *    Strimz merchant. The on-chain `merchantId` in the body refers to
 *    the StrimzRegistry id (a different namespace).
 */
@ApiTags('relay')
@ApiBearerAuth('apiKey')
@UseGuards(ApiKeyGuard)
@Controller('/v1/relay')
export class RelayController {
  constructor(private readonly relay: RelayService) {}

  @ApiOperation({
    summary: 'Submit a payer-signed one-shot payment (EIP-3009)',
    description:
      'Accepts a payer-signed ReceiveWithAuthorization and submits it on-chain ' +
      'via the StrimzPayments contract. Idempotent on `idempotencyKey`.',
  })
  @RequireScopes('relay_write')
  @Post('/payments')
  async submitPayment(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Body() body: SubmitPaymentDto,
  ): Promise<RelaySubmissionView> {
    return this.relay.submitPayWithAuthorization({
      idempotencyKey: body.idempotencyKey,
      merchantId: body.merchantId,
      token: body.token as `0x${string}`,
      auth: {
        from: body.auth.from as `0x${string}`,
        amount: body.auth.amount,
        validAfter: body.auth.validAfter,
        validBefore: body.auth.validBefore,
        nonce: body.auth.nonce as `0x${string}`,
      },
      ref: body.ref as `0x${string}`,
      signature: {
        v: body.signature.v,
        r: body.signature.r as `0x${string}`,
        s: body.signature.s as `0x${string}`,
      },
      merchantInternalId: ctx.merchantId,
      sessionId: body.sessionId,
    })
  }

  @ApiOperation({
    summary: 'Submit a payer-signed subscription enrolment (EIP-2612 permit)',
    description:
      'Accepts a payer-signed Permit and creates the on-chain subscription via ' +
      'StrimzSubscriptions.permitAndCreateSubscription. Idempotent on `idempotencyKey`.',
  })
  @RequireScopes('relay_write')
  @Post('/subscriptions')
  async submitSubscription(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Body() body: SubmitSubscriptionDto,
  ): Promise<RelaySubmissionView> {
    return this.relay.submitPermitAndCreateSubscription({
      idempotencyKey: body.idempotencyKey,
      merchantId: body.merchantId,
      token: body.token as `0x${string}`,
      amount: body.amount,
      interval: body.interval,
      startAt: body.startAt,
      endAt: body.endAt,
      permitData: {
        owner: body.permitData.owner as `0x${string}`,
        value: body.permitData.value,
        deadline: body.permitData.deadline,
      },
      signature: {
        v: body.signature.v,
        r: body.signature.r as `0x${string}`,
        s: body.signature.s as `0x${string}`,
      },
      merchantInternalId: ctx.merchantId,
      subscriptionInternalId: body.subscriptionInternalId,
    })
  }

  @ApiOperation({
    summary: 'Look up a submission by idempotency key',
    description:
      'Returns the latest known state of a previously submitted relay job. ' +
      'Returns 404 if no submission exists for the given key (either it was ' +
      'never submitted, or BullMQ aged it out of the retention window).',
  })
  @RequireScopes('relay_read')
  @Get('/submissions/:idempotencyKey')
  async getSubmission(
    @Param('idempotencyKey') idempotencyKey: string,
  ): Promise<RelaySubmissionView> {
    const submission = await this.relay.getByIdempotencyKey(idempotencyKey)
    if (!submission) {
      throw new NotFoundException({
        code: 'submission_not_found',
        message: `no relay submission for idempotency key ${idempotencyKey}`,
      })
    }
    return submission
  }
}
