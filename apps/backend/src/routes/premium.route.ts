import { FastifyInstance } from 'fastify'
import { authMiddleware } from '../middlewares/auth.middleware'
import { requireSubscription } from '../middlewares/subscription.middleware'
import { PlanType } from '@prisma/client'

/**
 * Routes Premium (exemple)
 * Prefix: /api/premium
 *
 * Ces routes montrent comment protéger des fonctionnalités par plan
 */
export async function premiumRoutes(fastify: FastifyInstance) {
  // ===== Fonctionnalités PRO (accessible PRO et BUSINESS) =====
  fastify.register(async function (fastify) {
    fastify.addHook('preHandler', authMiddleware)
    fastify.addHook('preHandler', requireSubscription(PlanType.PRO))

    /**
     * Exemple de fonctionnalité PRO
     * GET /api/premium/pro-feature
     *
     * Accessible aux users avec plan PRO ou BUSINESS
     */
    fastify.get('/pro-feature', async (request, reply) => {
      reply.send({
        success: true,
        message: 'Welcome to PRO feature!',
        data: {
          feature: 'Advanced analytics',
          availableFor: ['PRO', 'BUSINESS'],
        },
      })
    })

    /**
     * Exemple: Export de données avancé
     * POST /api/premium/export-data
     */
    fastify.post('/export-data', async (request, reply) => {
      const userId = request.user?.userId

      // Logique d'export (exemple)
      reply.send({
        success: true,
        message: 'Data export started',
        data: {
          exportId: 'exp_123',
          userId,
        },
      })
    })
  })

  // ===== Fonctionnalités BUSINESS (accessible BUSINESS uniquement) =====
  fastify.register(async function (fastify) {
    fastify.addHook('preHandler', authMiddleware)
    fastify.addHook('preHandler', requireSubscription(PlanType.BUSINESS))

    /**
     * Exemple de fonctionnalité BUSINESS
     * GET /api/premium/business-feature
     *
     * Accessible uniquement aux users avec plan BUSINESS
     */
    fastify.get('/business-feature', async (request, reply) => {
      reply.send({
        success: true,
        message: 'Welcome to BUSINESS feature!',
        data: {
          feature: 'Team collaboration',
          availableFor: ['BUSINESS'],
        },
      })
    })

    /**
     * Exemple: Gestion d'équipe
     * GET /api/premium/team
     */
    fastify.get('/team', async (request, reply) => {
      reply.send({
        success: true,
        message: 'Team management',
        data: {
          teamMembers: [],
          maxMembers: 10,
        },
      })
    })
  })
}
