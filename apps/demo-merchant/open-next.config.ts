import { defineCloudflareConfig } from '@opennextjs/cloudflare'

// No incremental cache: nothing uses ISR or revalidation.
export default defineCloudflareConfig()
