import { createRouteHandler } from 'uploadthing/next'

import { strimzFileRouter } from '@/lib/uploadthing/core'

export const runtime = 'nodejs'

/**
 * UploadThing Next.js App Router handler. Exposes the file router
 * defined in `@/lib/uploadthing/core` at `/api/uploadthing`.
 *
 * The token is server-only (never `NEXT_PUBLIC_*`) ,  `process.env`
 * access here is safe because this file is a route handler, not part
 * of the client bundle. `isDev` toggles UploadThing's simulated
 * uploads in dev; we mirror `NODE_ENV` so a fresh clone works
 * out of the box.
 */
export const { GET, POST } = createRouteHandler({
  router: strimzFileRouter,
  config: {
    token: process.env.UPLOADTHING_TOKEN,
    isDev: process.env.NODE_ENV === 'development',
    logLevel: 'Info',
  },
})
