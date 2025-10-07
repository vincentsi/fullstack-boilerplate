import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../config/prisma'

type Role = 'USER' | 'ADMIN' | 'MODERATOR'

/**
 * Middleware pour vérifier les rôles des utilisateurs (RBAC)
 * @param allowedRoles - Liste des rôles autorisés à accéder à la route
 * @returns Middleware Fastify
 *
 * @example
 * ```typescript
 * // Route accessible uniquement aux admins
 * fastify.addHook('preHandler', requireRole('ADMIN'))
 *
 * // Route accessible aux admins et modérateurs
 * fastify.addHook('preHandler', requireRole('ADMIN', 'MODERATOR'))
 * ```
 */
export function requireRole(...allowedRoles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // L'userId doit être disponible grâce à authMiddleware
      const userId = request.user?.userId

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'Non authentifié',
        })
      }

      // Récupérer le rôle de l'utilisateur depuis la base de données
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      })

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'Utilisateur introuvable',
        })
      }

      // Vérifier si le rôle de l'utilisateur est dans la liste des rôles autorisés
      if (!allowedRoles.includes(user.role as Role)) {
        return reply.status(403).send({
          success: false,
          error: 'Permissions insuffisantes',
          required: allowedRoles,
          current: user.role,
        })
      }

      // Ajouter le rôle à la request pour une utilisation ultérieure
      request.user = {
        userId: userId,
        role: user.role as Role,
      }
    } catch {
      return reply.status(500).send({
        success: false,
        error: 'Erreur serveur',
      })
    }
  }
}

// Étendre le type FastifyRequest pour inclure le rôle
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      userId: string
      role?: Role
    }
  }
}
