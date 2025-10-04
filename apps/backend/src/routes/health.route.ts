import type { FastifyInstance } from 'fastify'
import { prisma } from '@/config/prisma'

/**
 * Health check route
 * Permet de vérifier que l'API est en ligne
 * Utile pour Docker healthchecks, monitoring, load balancers
 */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (request, reply) => {
    const checks = {
      database: false,
    }

    // Check database connection
    try {
      await prisma.$queryRaw`SELECT 1`
      checks.database = true
    } catch (error) {
      request.log.error({ error }, 'Database health check failed')
    }

    const healthy = Object.values(checks).every(Boolean)

    if (!healthy) {
      return reply.status(503).send({
        status: 'degraded',
        checks,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      })
    }

    return {
      status: 'ok',
      checks,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }
  })
}
