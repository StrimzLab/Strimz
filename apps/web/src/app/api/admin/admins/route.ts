import { forwardAdminWrite, readJsonBody } from '../_lib/forward'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const body = await readJsonBody(req)
  return forwardAdminWrite(req, {
    method: 'POST',
    upstreamPath: '/v1/admin/admins',
    body,
  })
}
