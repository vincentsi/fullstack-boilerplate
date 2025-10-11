import { FastifyInstance } from 'fastify'
import { authMiddleware } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/rbac.middleware'
import { prisma } from '../config/prisma'
import { CleanupService } from '../services/cleanup.service'
import { BackupService } from '../services/backup.service'
import {
  listUsersSchema,
  updateUserRoleSchema,
  deleteUserSchema,
  cleanupTokensSchema,
  adminStatsSchema,
} from '@/schemas/openapi.schema'

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
     * Liste tous les utilisateurs avec pagination
     * GET /api/admin/users?page=1&limit=20
     */
    fastify.get<{
      Querystring: { page?: string; limit?: string }
    }>('/users', { schema: listUsersSchema }, async (request, reply) => {
      // Paramètres de pagination avec valeurs par défaut
      const page = parseInt(request.query.page || '1', 10)
      const limit = Math.min(parseInt(request.query.limit || '20', 10), 100) // Max 100 par page
      const skip = (page - 1) * limit

      // Validation
      if (page < 1 || limit < 1) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid pagination parameters',
        })
      }

      // Récupérer les utilisateurs paginés
      const [users, totalCount] = await Promise.all([
        prisma.user.findMany({
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
          skip,
          take: limit,
        }),
        prisma.user.count(),
      ])

      const totalPages = Math.ceil(totalCount / limit)

      reply.send({
        success: true,
        data: {
          users,
          pagination: {
            page,
            limit,
            totalCount,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
          },
        },
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
    }>('/users/:id/role', { schema: updateUserRoleSchema }, async (request, reply) => {
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
    }>('/users/:id', { schema: deleteUserSchema }, async (request, reply) => {
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

    /**
     * Déclenche un nettoyage manuel des tokens expirés
     * POST /api/admin/cleanup-tokens
     */
    fastify.post('/cleanup-tokens', { schema: cleanupTokensSchema }, async (_request, reply) => {
      await CleanupService.runManualCleanup(fastify)

      reply.send({
        success: true,
        message: 'Nettoyage des tokens exécuté avec succès',
      })
    })

    /**
     * Créer un backup manuel de la base de données
     * POST /api/admin/backup
     */
    fastify.post('/backup', async (_request, reply) => {
      try {
        const backupPath = await BackupService.createBackup()

        reply.send({
          success: true,
          message: 'Backup créé avec succès',
          data: { backupPath },
        })
      } catch (error) {
        reply.status(500).send({
          success: false,
          error: 'Échec de la création du backup',
        })
      }
    })

    /**
     * Lister tous les backups disponibles
     * GET /api/admin/backups
     */
    fastify.get('/backups', async (_request, reply) => {
      const backups = await BackupService.listBackups()
      const stats = await BackupService.getBackupStats()

      reply.send({
        success: true,
        data: {
          backups,
          stats,
        },
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
    fastify.get('/stats', { schema: adminStatsSchema }, async (_request, reply) => {
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
