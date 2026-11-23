import { forwardAdminWrite, readJsonBody } from '../../../../_lib/forward'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await readJsonBody(req)
  return forwardAdminWrite(req, {
    method: 'POST',
    upstreamPath: `/v1/admin/safe/proposals/${encodeURIComponent(id)}/signatures`,
    body,
  })
}
