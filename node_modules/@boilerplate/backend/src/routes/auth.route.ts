import type { FastifyInstance } from 'fastify'
import { authController } from '@/controllers/auth.controller'
import { authMiddleware } from '@/middlewares/auth.middleware'

/**
 * Routes d'authentification
 * Base path: /api/auth
 */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/auth/register
   * Inscription d'un nouvel utilisateur
   * Body: { email, password, name? }
   * Rate limit: 3 requests per hour (prevent spam accounts)
   */
  app.post(
    '/register',
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '1 hour',
        },
      },
    },
    authController.register.bind(authController)
  )

  /**
   * POST /api/auth/login
   * Connexion d'un utilisateur
   * Body: { email, password }
   * Rate limit: 5 requests per 15 minutes (prevent brute force)
   */
  app.post(
    '/login',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '15 minutes',
        },
      },
    },
    authController.login.bind(authController)
  )

  /**
   * POST /api/auth/refresh
   * Rafraîchir l'access token
   * Body: { refreshToken }
   */
  app.post('/refresh', authController.refresh.bind(authController))

  /**
   * POST /api/auth/logout
   * Déconnexion (côté client)
   */
  app.post('/logout', authController.logout.bind(authController))

  /**
   * GET /api/auth/me
   * Récupérer l'utilisateur courant (protégé par JWT)
   * Headers: { Authorization: "Bearer <token>" }
   */
  app.get(
    '/me',
    {
      preHandler: authMiddleware,
    },
    authController.me.bind(authController)
  )
}
