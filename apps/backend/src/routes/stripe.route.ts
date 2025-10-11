import { FastifyInstance } from 'fastify'
import { StripeController } from '../controllers/stripe.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import {
  createCheckoutSessionSchema,
  getSubscriptionSchema,
} from '@/schemas/openapi.schema'

/**
 * Routes Stripe
 * Prefix: /api/stripe
 */
export async function stripeRoutes(fastify: FastifyInstance) {
  const controller = new StripeController()

  // ===== Routes protégées (avec auth) =====
  fastify.register(async function (fastify) {
    // Auth middleware sur toutes les routes de ce groupe
    fastify.addHook('preHandler', authMiddleware)

    /**
     * Crée une session de checkout
     * POST /api/stripe/create-checkout-session
     *
     * Body: {
     *   priceId: "price_xxx",
     *   planType: "PRO" | "BUSINESS"
     * }
     *
     * Response: {
     *   sessionId: "cs_xxx",
     *   url: "https://checkout.stripe.com/..."
     * }
     */
    fastify.post(
      '/create-checkout-session',
      { schema: createCheckoutSessionSchema },
      controller.createCheckoutSession.bind(controller)
    )

    /**
     * Crée une session de portail de billing
     * POST /api/stripe/create-portal-session
     *
     * Response: {
     *   url: "https://billing.stripe.com/..."
     * }
     */
    fastify.post(
      '/create-portal-session',
      controller.createPortalSession.bind(controller)
    )

    /**
     * Récupère l'abonnement actuel
     * GET /api/stripe/subscription
     *
     * Response: {
     *   subscription: { ... }
     * }
     */
    fastify.get(
      '/subscription',
      { schema: getSubscriptionSchema },
      controller.getSubscription.bind(controller)
    )
  })

  // ===== Webhook (SANS auth) =====
  /**
   * Webhook Stripe
   * POST /api/stripe/webhook
   *
   * IMPORTANT:
   * - Pas de middleware auth (signature Stripe utilisée)
   * - Body doit être raw (contentTypeParser custom)
   */
  fastify.post(
    '/webhook',
    controller.handleWebhook.bind(controller)
  )
}
