import { forwardAdminWrite, readJsonBody } from '../../../_lib/forward'

export const runtime = 'nodejs'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await readJsonBody(req)
  return forwardAdminWrite(req, {
    method: 'PATCH',
    upstreamPath: `/v1/admin/merchants/${encodeURIComponent(id)}/tier`,
    body,
  })
}
