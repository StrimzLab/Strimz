import { Module } from '@nestjs/common'
import { RefundChainService } from './refund-chain.service.js'
import { refundSignerProvider } from './refund-signer.js'

@Module({ providers: [refundSignerProvider, RefundChainService], exports: [RefundChainService] })
export class RefundChainModule {}
