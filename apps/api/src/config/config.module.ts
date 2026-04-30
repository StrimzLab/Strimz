import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypedConfigService } from './typed-config.service.js'
import { validateEnv } from './env.schema.js'

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
  ],
  providers: [TypedConfigService],
  exports: [TypedConfigService],
})
export class StrimzConfigModule {}
