import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import {
  CurrentMerchant,
  type CurrentMerchantPayload,
} from '../../common/decorators/current-merchant.decorator.js'
import { RateLimit } from '../../common/decorators/rate-limit.decorator.js'
import { ApiKeyGuard } from '../../common/guards/api-key.guard.js'
import { RequireScopes } from '../../common/decorators/scopes.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import {
  submissionQuerySchema,
  SubmitPaymentDto,
  SubmitSubscriptionDto,
  type SubmissionQuery,
} from './relay.dto.js'
import { enrolmentRelayInput, paymentRelayInput } from './relay-inputs.js'
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
      'via the StrimzPayments contract. Idempotent on the signed payload; the response ' +
      'carries the server-issued `idempotencyKey` to poll. A body `idempotencyKey` is ' +
      'deprecated and ignored.',
  })
  @RequireScopes('relay_write')
  @RateLimit({ max: 60, windowMs: 60_000, keyBy: 'actor', label: 'relay.payments' })
  @Post('/payments')
  submitPayment(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Body() body: SubmitPaymentDto,
  ): Promise<RelaySubmissionView> {
    return this.relay.submitPayWithAuthorization(
      paymentRelayInput(body, { merchantInternalId: ctx.merchantId, sessionId: body.sessionId }),
    )
  }

  @ApiOperation({
    summary: 'Submit a payer-signed subscription enrolment (EIP-2612 permit)',
    description:
      'Accepts a payer-signed Permit and creates the on-chain subscription via ' +
      'StrimzSubscriptions.permitAndCreateSubscription. Idempotent on the signed payload; ' +
      'the response carries the server-issued `idempotencyKey` to poll. A body ' +
      '`idempotencyKey` is deprecated and ignored.',
  })
  @RequireScopes('relay_write')
  @RateLimit({ max: 60, windowMs: 60_000, keyBy: 'actor', label: 'relay.subscriptions' })
  @Post('/subscriptions')
  submitSubscription(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Body() body: SubmitSubscriptionDto,
  ): Promise<RelaySubmissionView> {
    return this.relay.submitPermitAndCreateSubscription(
      enrolmentRelayInput(body, {
        merchantInternalId: ctx.merchantId,
        subscriptionInternalId: body.subscriptionInternalId,
      }),
    )
  }

  @ApiOperation({
    summary: 'Look up a submission by idempotency key',
    description:
      'Returns the latest known state of a previously submitted relay job. ' +
      'Returns 404 if no submission exists for the given key (either it was ' +
      'never submitted, or BullMQ aged it out of the retention window), if it ' +
      'belongs to another merchant, or if `?sessionId=` names another session or plan.',
  })
  @RequireScopes('relay_read')
  @Get('/submissions/:idempotencyKey')
  async getSubmission(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Param('idempotencyKey') idempotencyKey: string,
    @Query(new ZodValidationPipe(submissionQuerySchema)) query: SubmissionQuery,
  ): Promise<RelaySubmissionView> {
    const submission = await this.relay.getByIdempotencyKey(idempotencyKey, {
      merchantInternalId: ctx.merchantId,
      sessionId: query.sessionId,
    })
    if (!submission) {
      throw new NotFoundException({
        code: 'submission_not_found',
        message: `no relay submission for idempotency key ${idempotencyKey}`,
      })
    }
    return submission
  }
}
