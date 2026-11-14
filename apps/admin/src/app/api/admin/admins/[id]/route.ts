import { forwardAdminWrite } from '../../_lib/forward'

export const runtime = 'nodejs'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return forwardAdminWrite(req, {
    method: 'DELETE',
    upstreamPath: `/v1/admin/admins/${encodeURIComponent(id)}`,
  })
}
