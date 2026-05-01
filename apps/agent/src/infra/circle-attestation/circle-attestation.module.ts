import { Global, Module } from '@nestjs/common'
import { CircleAttestationService } from './circle-attestation.service.js'

@Global()
@Module({ providers: [CircleAttestationService], exports: [CircleAttestationService] })
export class CircleAttestationModule {}
