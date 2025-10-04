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
   */
  app.post('/register', authController.register.bind(authController))

  /**
   * POST /api/auth/login
   * Connexion d'un utilisateur
   * Body: { email, password }
   */
  app.post('/login', authController.login.bind(authController))

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
