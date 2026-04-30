import { Module } from '@nestjs/common'
import { StorefrontsController } from './storefronts.controller.js'
import { StorefrontsService } from './storefronts.service.js'

@Module({
  controllers: [StorefrontsController],
  providers: [StorefrontsService],
  exports: [StorefrontsService],
})
export class StorefrontsModule {}
