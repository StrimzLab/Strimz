import { forwardAdminWrite } from '../../../_lib/forward'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return forwardAdminWrite(req, {
    method: 'POST',
    upstreamPath: `/v1/admin/merchants/${encodeURIComponent(id)}/reactivate`,
  })
}
