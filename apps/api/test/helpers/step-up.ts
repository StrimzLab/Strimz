import type { TestApp } from './test-app.factory.js'

export type StepUpAction =
  | 'api_keys.create'
  | 'api_keys.rotate'
  | 'webhook_endpoints.create'
  | 'webhook_endpoints.rotate_secret'

/** Runs the passkey step-up as the dashboard would and returns the one-use token. */
export async function stepUp(
  t: TestApp,
  privyAccessToken: string,
  action: StepUpAction,
  credentialId = 'good-credential',
): Promise<string> {
  const headers = { authorization: `Bearer ${privyAccessToken}` }
  const start = await t.inject({
    method: 'POST',
    url: '/v1/auth/step-up/start',
    headers,
    payload: { action },
  })
  if (start.statusCode !== 200) throw new Error(`step-up start ${start.statusCode}: ${start.body}`)
  const verify = await t.inject({
    method: 'POST',
    url: '/v1/auth/step-up/verify',
    headers,
    payload: {
      action,
      credential: {
        id: credentialId,
        raw_id: credentialId,
        type: 'public-key',
        response: { client_data_json: 'e30', authenticator_data: 'AA', signature: 'AA' },
        client_extension_results: {},
      },
    },
  })
  if (verify.statusCode !== 200)
    throw new Error(`step-up verify ${verify.statusCode}: ${verify.body}`)
  return (JSON.parse(verify.body) as { stepUpToken: string }).stepUpToken
}
