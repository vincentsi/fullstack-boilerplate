import 'fastify'

/**
 * Étend les types Fastify pour ajouter des propriétés custom
 */
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      userId: string
    }
  }
}
