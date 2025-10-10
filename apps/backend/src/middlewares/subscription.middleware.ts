import { FastifyRequest, FastifyReply } from 'fastify'
import { PlanType } from '@prisma/client'
import { stripeService } from '@/services/stripe.service'

/**
 * Middleware pour vérifier qu'un utilisateur a un plan spécifique
 * Utilisé pour protéger les fonctionnalités premium
 *
 * @param requiredPlan - Le plan minimum requis (PRO ou BUSINESS)
 * @returns Middleware Fastify
 *
 * @example
 * ```typescript
 * // Route accessible uniquement aux PRO et BUSINESS
 * fastify.addHook('preHandler', requireSubscription(PlanType.PRO))
 *
 * // Route accessible uniquement aux BUSINESS
 * fastify.addHook('preHandler', requireSubscription(PlanType.BUSINESS))
 * ```
 */
export function requireSubscription(requiredPlan: PlanType) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user?.userId

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'Not authenticated',
        })
      }

      // Vérifier l'accès à la fonctionnalité
      const hasAccess = await stripeService.hasFeatureAccess(
        userId,
        requiredPlan
      )

      if (!hasAccess) {
        return reply.status(403).send({
          success: false,
          error: 'Subscription required',
          message: `This feature requires ${requiredPlan} plan or higher`,
          requiredPlan,
        })
      }

      // ✅ User a accès, continuer
    } catch (error) {
      request.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to verify subscription',
      })
    }
  }
}

/**
 * Middleware pour vérifier qu'un utilisateur a un abonnement actif
 * (N'importe quel plan payant: PRO ou BUSINESS)
 *
 * @example
 * ```typescript
 * fastify.addHook('preHandler', requireActiveSubscription)
 * ```
 */
export async function requireActiveSubscription(
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

    const hasSubscription = await stripeService.hasActiveSubscription(userId)

    if (!hasSubscription) {
      return reply.status(403).send({
        success: false,
        error: 'Active subscription required',
        message: 'This feature requires an active subscription',
      })
    }

    // ✅ User a un abonnement actif
  } catch (error) {
    request.log.error(error)
    return reply.status(500).send({
      success: false,
      error: 'Failed to verify subscription',
    })
  }
}
