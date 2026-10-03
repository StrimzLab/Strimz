import { SetMetadata } from '@nestjs/common'

export const SESSION_ONLY_KEY = 'sessionOnly'

export const SessionOnly = () => SetMetadata(SESSION_ONLY_KEY, true)
