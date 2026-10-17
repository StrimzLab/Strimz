import { SetMetadata } from '@nestjs/common'

export const SKIP_IDEMPOTENCY_KEY = 'skipIdempotency'

/** For routes whose response carries a one-time secret, which must never be stored or replayed. */
export const SkipIdempotency = () => SetMetadata(SKIP_IDEMPOTENCY_KEY, true)
