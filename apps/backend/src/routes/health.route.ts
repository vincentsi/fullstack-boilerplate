import type { FastifyInstance } from 'fastify'

/**
 * Health check route
 * Permet de vérifier que l'API est en ligne
 * Utile pour Docker healthchecks, monitoring, load balancers
 */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }
  })
}
