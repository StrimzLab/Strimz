import { forwardAdminWrite, readJsonBody } from '../_lib/forward'

export const runtime = 'nodejs'

/**
 * POST /api/admin/broadcasts → apps/api's `POST /v1/admin/broadcasts`.
 * Same origin-gated BFF pattern as the invite-admin route: the caller
 * is `AdminApiClient` in the browser, which auto-attaches the Privy
 * bearer; this handler just re-verifies the origin and forwards.
 */
export async function POST(req: Request) {
  const body = await readJsonBody(req)
  return forwardAdminWrite(req, {
    method: 'POST',
    upstreamPath: '/v1/admin/broadcasts',
    body,
  })
}
