import { FastifyRequest, FastifyReply } from 'fastify'
import { CsrfService } from '../services/csrf.service'

/**
 * Middleware de protection CSRF
 * Vérifie que le token CSRF est présent et valide pour les requêtes mutantes
 *
 * @example
 * ```typescript
 * // Appliquer globalement
 * fastify.addHook('preHandler', csrfMiddleware)
 *
 * // Ou sur routes spécifiques
 * fastify.post('/sensitive', { preHandler: csrfMiddleware }, handler)
 * ```
 */
export async function csrfMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Ignorer les méthodes GET, HEAD, OPTIONS (lecture seule)
  const safeMethods = ['GET', 'HEAD', 'OPTIONS']
  if (safeMethods.includes(request.method)) {
    return
  }

  // Ignorer les routes publiques (login, register)
  const publicRoutes = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh']
  if (publicRoutes.some((route) => request.url.startsWith(route))) {
    return
  }

  // Vérifier que l'utilisateur est authentifié
  const userId = request.user?.userId
  if (!userId) {
    // Si pas authentifié, authMiddleware s'en chargera
    return
  }

  // Récupérer le token CSRF depuis le cookie
  const csrfCookie = request.cookies.csrfToken

  // Récupérer le token CSRF depuis le header
  const csrfHeader = request.headers['x-csrf-token'] as string | undefined

  // Vérifier que les deux sont présents
  if (!csrfCookie || !csrfHeader) {
    return reply.status(403).send({
      success: false,
      error: 'CSRF token missing',
      message: 'CSRF token requis dans cookie et header X-CSRF-Token',
    })
  }

  // Vérifier que le cookie et le header correspondent
  if (csrfCookie !== csrfHeader) {
    return reply.status(403).send({
      success: false,
      error: 'CSRF token mismatch',
      message: 'Le token CSRF du cookie ne correspond pas au header',
    })
  }

  // Vérifier que le token est valide en DB
  const isValid = await CsrfService.verifyToken(csrfCookie, userId)

  if (!isValid) {
    return reply.status(403).send({
      success: false,
      error: 'Invalid CSRF token',
      message: 'Token CSRF invalide ou expiré',
    })
  }

  // Token valide, continuer
}
