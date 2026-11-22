import { SetMetadata } from '@nestjs/common'

export const ALLOW_WITHOUT_TERMS_KEY = 'allowWithoutTerms'

/** A dashboard write that works before the current terms are accepted (onboarding, accepting them). */
export const AllowWithoutTerms = () => SetMetadata(ALLOW_WITHOUT_TERMS_KEY, true)
