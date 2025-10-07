import { FastifyInstance } from 'fastify'
import { authMiddleware } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/rbac.middleware'
import { prisma } from '../config/prisma'

type Role = 'USER' | 'ADMIN' | 'MODERATOR'

/**
 * Routes d'administration
 * Prefix: /api/admin
 * Toutes les routes nécessitent une authentification + rôle approprié
 */
export async function adminRoutes(fastify: FastifyInstance) {
  // Routes réservées aux ADMIN uniquement
  fastify.register(async function (fastify) {
    // Middleware d'authentification
    fastify.addHook('preHandler', authMiddleware)
    // Middleware de vérification de rôle
    fastify.addHook('preHandler', requireRole('ADMIN'))

    /**
     * Liste tous les utilisateurs
     * GET /api/admin/users
     */
    fastify.get('/users', async (request, reply) => {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      reply.send({
        success: true,
        data: { users },
      })
    })

    /**
     * Change le rôle d'un utilisateur
     * PATCH /api/admin/users/:id/role
     * Body: { role: 'USER' | 'ADMIN' | 'MODERATOR' }
     */
    fastify.patch<{
      Params: { id: string }
      Body: { role: Role }
    }>('/users/:id/role', async (request, reply) => {
      const { id } = request.params
      const { role } = request.body

      if (!['USER', 'ADMIN', 'MODERATOR'].includes(role)) {
        return reply.status(400).send({
          success: false,
          error: 'Rôle invalide',
        })
      }

      const user = await prisma.user.update({
        where: { id },
        data: { role },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      })

      reply.send({
        success: true,
        message: 'Rôle mis à jour',
        data: { user },
      })
    })

    /**
     * Supprime un utilisateur
     * DELETE /api/admin/users/:id
     */
    fastify.delete<{
      Params: { id: string }
    }>('/users/:id', async (request, reply) => {
      const { id } = request.params

      // Empêcher l'admin de se supprimer lui-même
      if (id === request.user?.userId) {
        return reply.status(400).send({
          success: false,
          error: 'Vous ne pouvez pas supprimer votre propre compte',
        })
      }

      await prisma.user.delete({
        where: { id },
      })

      reply.send({
        success: true,
        message: 'Utilisateur supprimé',
      })
    })
  })

  // Routes accessibles aux ADMIN et MODERATOR
  fastify.register(async function (fastify) {
    fastify.addHook('preHandler', authMiddleware)
    fastify.addHook('preHandler', requireRole('ADMIN', 'MODERATOR'))

    /**
     * Statistiques des utilisateurs par rôle
     * GET /api/admin/stats
     */
    fastify.get('/stats', async (request, reply) => {
      const stats = await prisma.user.groupBy({
        by: ['role'],
        _count: true,
      })

      const totalUsers = await prisma.user.count()
      const verifiedUsers = await prisma.user.count({
        where: { emailVerified: true },
      })

      reply.send({
        success: true,
        data: {
          totalUsers,
          verifiedUsers,
          unverifiedUsers: totalUsers - verifiedUsers,
          byRole: stats.map((stat) => ({
            role: stat.role,
            count: stat._count,
          })),
        },
      })
    })
  })
}
