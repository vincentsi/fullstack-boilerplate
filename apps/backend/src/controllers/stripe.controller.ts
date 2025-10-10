import { FastifyRequest, FastifyReply } from 'fastify'
import { stripeService } from '@/services/stripe.service'
import { PlanType } from '@prisma/client'
import { z } from 'zod'

/**
 * Controller pour les routes Stripe
 * Gère la création de checkouts, webhooks, et portails de billing
 */
export class StripeController {
  /**
   * Crée une session de checkout Stripe
   * POST /api/stripe/create-checkout-session
   *
   * Body: {
   *   priceId: "price_xxx",
   *   planType: "PRO" | "BUSINESS"
   * }
   */
  async createCheckoutSession(
    request: FastifyRequest<{
      Body: {
        priceId: string
        planType: PlanType
      }
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.user?.userId
      const userEmail = request.user?.email

      if (!userId || !userEmail) {
        return reply.status(401).send({
          success: false,
          error: 'Not authenticated',
        })
      }

      // Validation
      const schema = z.object({
        priceId: z.string().startsWith('price_'),
        planType: z.enum([PlanType.PRO, PlanType.BUSINESS]),
      })

      const { priceId, planType } = schema.parse(request.body)

      // Créer la session
      const session = await stripeService.createCheckoutSession(
        userId,
        userEmail,
        priceId,
        planType
      )

      reply.send({
        success: true,
        data: {
          sessionId: session.sessionId,
          url: session.url,
        },
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request body',
          details: error.issues,
        })
      }

      if (error instanceof Error) {
        request.log.error(error)
        return reply.status(500).send({
          success: false,
          error: error.message,
        })
      }

      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
      })
    }
  }

  /**
   * Crée une session de portail de billing
   * POST /api/stripe/create-portal-session
   *
   * Permet à l'utilisateur de gérer son abonnement (changement plan, annulation)
   */
  async createPortalSession(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.user?.userId

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'Not authenticated',
        })
      }

      const session = await stripeService.createBillingPortalSession(userId)

      reply.send({
        success: true,
        data: {
          url: session.url,
        },
      })
    } catch (error) {
      if (error instanceof Error) {
        request.log.error(error)
        return reply.status(500).send({
          success: false,
          error: error.message,
        })
      }

      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
      })
    }
  }

  /**
   * Webhook Stripe
   * POST /api/stripe/webhook
   *
   * Traite les events Stripe (checkout completed, subscription updated, etc.)
   * IMPORTANT: Cette route ne doit PAS avoir de middleware d'auth
   */
  async handleWebhook(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const signature = request.headers['stripe-signature']

      if (!signature || typeof signature !== 'string') {
        return reply.status(400).send({
          success: false,
          error: 'Missing stripe-signature header',
        })
      }

      // Le body doit être raw (Buffer) pour la vérification signature
      const rawBody = request.body as Buffer

      await stripeService.handleWebhook(rawBody, signature)

      reply.send({ received: true })
    } catch (error) {
      if (error instanceof Error) {
        request.log.error(error)
        return reply.status(400).send({
          success: false,
          error: error.message,
        })
      }

      return reply.status(500).send({
        success: false,
        error: 'Webhook handling failed',
      })
    }
  }

  /**
   * Récupère l'abonnement actuel de l'utilisateur
   * GET /api/stripe/subscription
   */
  async getSubscription(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.user?.userId

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'Not authenticated',
        })
      }

      const subscription = await stripeService.getUserSubscription(userId)

      reply.send({
        success: true,
        data: {
          subscription,
        },
      })
    } catch (error) {
      if (error instanceof Error) {
        request.log.error(error)
        return reply.status(500).send({
          success: false,
          error: error.message,
        })
      }

      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
      })
    }
  }
}
