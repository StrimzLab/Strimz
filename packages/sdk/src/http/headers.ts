/**
 * Strimz HTTP header conventions.
 *
 * `Authorization: Bearer <secret_key>`: primary auth.
 * `X-Strimz-Idempotency-Key`: mutating calls.
 * `X-Strimz-Sdk`: telemetry.
 * `X-Strimz-Sdk-Version`: telemetry.
 */

export const HEADERS = {
  authorization: 'Authorization',
  idempotencyKey: 'X-Strimz-Idempotency-Key',
  requestId: 'X-Strimz-Request-Id',
  sdkName: 'X-Strimz-Sdk',
  sdkVersion: 'X-Strimz-Sdk-Version',
  sdkRuntime: 'X-Strimz-Sdk-Runtime',
} as const

export const SDK_NAME = '@strimz/sdk'

/** The SDK version. Updated by the build pipeline if a version is published. */
export const SDK_VERSION = '0.0.0'

export function buildBaseHeaders(apiKey: string, runtime: string): Record<string, string> {
  return {
    [HEADERS.authorization]: `Bearer ${apiKey}`,
    [HEADERS.sdkName]: SDK_NAME,
    [HEADERS.sdkVersion]: SDK_VERSION,
    [HEADERS.sdkRuntime]: runtime,
    Accept: 'application/json',
  }
}
