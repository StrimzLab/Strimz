import { Global, Module } from '@nestjs/common'
import { ChainService } from './chain.service.js'
import { schedulerSignerProvider } from './scheduler-signer.js'

@Global()
@Module({ providers: [schedulerSignerProvider, ChainService], exports: [ChainService] })
export class ChainModule {}
