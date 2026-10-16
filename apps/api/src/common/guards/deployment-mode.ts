import { ForbiddenException } from '@nestjs/common'
import { arcModeFor, type ApiKeyMode, type ArcEnvironment } from '@strimz/shared-config'

export function assertDeploymentMode(environment: ArcEnvironment, mode: ApiKeyMode): void {
  const expected = arcModeFor(environment)
  if (mode !== expected) {
    throw new ForbiddenException({
      code: 'mode_unavailable',
      message: `${mode} keys are not accepted here; this Strimz deployment runs on Arc ${environment} in ${expected} mode`,
    })
  }
}
