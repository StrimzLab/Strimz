// Populated by the raw-body content-type parser in main.ts so webhook
// signature verifiers can access the exact bytes Fastify received.
import 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string
  }
}
