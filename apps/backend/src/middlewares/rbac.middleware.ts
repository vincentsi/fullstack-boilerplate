import { FastifyRequest, FastifyReply } from 'fastify'

type Role = 'USER' | 'ADMIN' | 'MODERATOR'

/**
 * Middleware pour vérifier les rôles des utilisateurs (RBAC optimisé)
 * Utilise le rôle stocké dans le JWT (pas de requête DB)
 *
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
      // Le role doit être disponible grâce à authMiddleware (depuis JWT)
      const userId = request.user?.userId
      const userRole = request.user?.role

      if (!userId || !userRole) {
        return reply.status(401).send({
          success: false,
          error: 'Non authentifié',
        })
      }

      // Vérifier si le rôle de l'utilisateur est dans la liste des rôles autorisés
      // Performance: 0 requête DB, tout est dans le JWT
      if (!allowedRoles.includes(userRole as Role)) {
        return reply.status(403).send({
          success: false,
          error: 'Permissions insuffisantes',
          required: allowedRoles,
          current: userRole,
        })
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
