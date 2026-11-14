import { defineCloudflareConfig } from '@opennextjs/cloudflare'

// No incremental cache: pages render per request and nothing uses ISR.
export default defineCloudflareConfig()
