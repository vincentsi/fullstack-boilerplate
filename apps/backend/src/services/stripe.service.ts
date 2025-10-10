import Stripe from 'stripe'
import { env } from '@/config/env'
import { prisma } from '@/config/prisma'
import { PlanType, SubscriptionStatus } from '@prisma/client'

/**
 * Interface pour typer correctement les objets Subscription de Stripe
 * (compatibilité avec Stripe v19+ qui utilise snake_case)
 */
interface StripeSubscriptionData {
  id: string
  customer: string
  status: Stripe.Subscription.Status
  items: {
    data: Array<{
      price: {
        id: string
      }
    }>
  }
  current_period_start: number
  current_period_end: number
  cancel_at_period_end: boolean
  canceled_at: number | null
  metadata?: Record<string, string>
}

/**
 * Service Stripe pour gérer les abonnements
 * - Création de customers
 * - Gestion des checkout sessions
 * - Traitement des webhooks
 * - Synchronisation avec la DB
 */
export class StripeService {
  private stripe: Stripe

  constructor() {
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is required')
    }

    this.stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-09-30.clover',
      typescript: true,
    })
  }

  /**
   * Crée ou récupère un customer Stripe pour un utilisateur
   */
  async getOrCreateCustomer(userId: string, email: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    })

    // Si customer existe déjà, le retourner
    if (user?.stripeCustomerId) {
      return user.stripeCustomerId
    }

    // Créer nouveau customer Stripe
    const customer = await this.stripe.customers.create({
      email,
      metadata: {
        userId,
      },
    })

    // Sauvegarder l'ID dans la DB
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    })

    return customer.id
  }

  /**
   * Crée une session de checkout Stripe
   * @param userId - ID de l'utilisateur
   * @param email - Email de l'utilisateur
   * @param priceId - ID du price Stripe (price_xxx)
   * @param planType - Type de plan (PRO, BUSINESS)
   */
  async createCheckoutSession(
    userId: string,
    email: string,
    priceId: string,
    planType: PlanType
  ): Promise<{ sessionId: string; url: string }> {
    const customerId = await this.getOrCreateCustomer(userId, email)

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${env.FRONTEND_URL}/dashboard/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.FRONTEND_URL}/dashboard/billing?canceled=true`,
      metadata: {
        userId,
        planType,
      },
      subscription_data: {
        metadata: {
          userId,
          planType,
        },
      },
    })

    if (!session.url) {
      throw new Error('Failed to create checkout session URL')
    }

    return {
      sessionId: session.id,
      url: session.url,
    }
  }

  /**
   * Crée un portal de gestion d'abonnement
   * Permet au user de modifier/annuler son abonnement
   */
  async createBillingPortalSession(userId: string): Promise<{ url: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    })

    if (!user?.stripeCustomerId) {
      throw new Error('No Stripe customer found for this user')
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${env.FRONTEND_URL}/dashboard/billing`,
    })

    return { url: session.url }
  }

  /**
   * Traite les webhooks Stripe
   * Events importants:
   * - checkout.session.completed: Nouvel abonnement
   * - customer.subscription.updated: Mise à jour (renouvellement, changement plan)
   * - customer.subscription.deleted: Annulation
   */
  async handleWebhook(
    payload: string | Buffer,
    signature: string
  ): Promise<void> {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('STRIPE_WEBHOOK_SECRET is required')
    }

    const event = this.stripe.webhooks.constructEvent(
      payload,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    )

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }
  }

  /**
   * Gère l'event checkout.session.completed
   * Crée un nouvel abonnement en DB
   */
  private async handleCheckoutCompleted(
    session: Stripe.Checkout.Session
  ): Promise<void> {
    const userId = session.metadata?.userId
    const planType = session.metadata?.planType as PlanType

    if (!userId || !planType) {
      throw new Error('Missing userId or planType in session metadata')
    }

    if (!session.subscription) {
      throw new Error('No subscription in checkout session')
    }

    // Récupérer les détails de la subscription Stripe
    const stripeSubscription = await this.stripe.subscriptions.retrieve(
      session.subscription as string
    )

    // Cast pour accéder aux propriétés (Stripe v19 Response wrapper)
    const sub = stripeSubscription as unknown as StripeSubscriptionData
    const priceId = sub.items.data[0]?.price.id

    if (!priceId) {
      throw new Error('No price ID found in subscription')
    }

    // Créer ou mettre à jour subscription en DB
    await prisma.subscription.upsert({
      where: {
        stripeSubscriptionId: sub.id,
      },
      create: {
        userId,
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId,
        stripeCustomerId: sub.customer as string,
        status: this.mapStripeStatus(sub.status),
        planType,
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
      update: {
        status: this.mapStripeStatus(sub.status),
        planType,
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
    })

    // Mettre à jour le user
    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: this.mapStripeStatus(sub.status),
        subscriptionId: sub.id,
        planType,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
      },
    })
  }

  /**
   * Gère l'event customer.subscription.updated
   * Met à jour l'abonnement en DB (renouvellement, changement de plan)
   */
  private async handleSubscriptionUpdated(
    stripeSubscription: Stripe.Subscription
  ): Promise<void> {
    const subscription = stripeSubscription as unknown as StripeSubscriptionData
    const userId = subscription.metadata?.userId
    const planType = subscription.metadata?.planType as PlanType

    if (!userId) {
      console.error('No userId in subscription metadata')
      return
    }

    const priceId = subscription.items.data[0]?.price.id

    if (!priceId) {
      throw new Error('No price ID found in subscription')
    }

    // Mettre à jour subscription en DB
    await prisma.subscription.update({
      where: {
        stripeSubscriptionId: subscription.id,
      },
      data: {
        status: this.mapStripeStatus(subscription.status),
        planType: planType || undefined,
        stripePriceId: priceId,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000)
          : null,
      },
    })

    // Mettre à jour le user
    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: this.mapStripeStatus(subscription.status),
        planType: planType || undefined,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    })
  }

  /**
   * Gère l'event customer.subscription.deleted
   * Marque l'abonnement comme annulé
   */
  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription
  ): Promise<void> {
    const userId = subscription.metadata?.userId

    if (!userId) {
      console.error('No userId in subscription metadata')
      return
    }

    // Mettre à jour subscription en DB
    await prisma.subscription.update({
      where: {
        stripeSubscriptionId: subscription.id,
      },
      data: {
        status: SubscriptionStatus.CANCELED,
        cancelAtPeriodEnd: false,
        canceledAt: new Date(),
      },
    })

    // Mettre à jour le user (retour au plan FREE)
    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: SubscriptionStatus.CANCELED,
        planType: PlanType.FREE,
        subscriptionId: null,
        currentPeriodEnd: null,
      },
    })
  }

  /**
   * Gère l'event invoice.payment_failed
   * Marque l'abonnement comme PAST_DUE
   */
  private async handlePaymentFailed(stripeInvoice: Stripe.Invoice): Promise<void> {
    const invoice = stripeInvoice as unknown as { subscription?: string }
    if (!invoice.subscription) {
      return
    }

    const stripeSubscription = await this.stripe.subscriptions.retrieve(
      invoice.subscription
    )

    const subscription = stripeSubscription as unknown as StripeSubscriptionData
    const userId = subscription.metadata?.userId

    if (!userId) {
      console.error('No userId in subscription metadata')
      return
    }

    // Mettre à jour en PAST_DUE
    await prisma.subscription.update({
      where: {
        stripeSubscriptionId: subscription.id,
      },
      data: {
        status: SubscriptionStatus.PAST_DUE,
      },
    })

    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: SubscriptionStatus.PAST_DUE,
      },
    })
  }

  /**
   * Convertit le status Stripe en status DB
   */
  private mapStripeStatus(
    stripeStatus: Stripe.Subscription.Status
  ): SubscriptionStatus {
    const statusMap: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELED,
      incomplete: SubscriptionStatus.INCOMPLETE,
      incomplete_expired: SubscriptionStatus.CANCELED,
      trialing: SubscriptionStatus.TRIALING,
      unpaid: SubscriptionStatus.PAST_DUE,
      paused: SubscriptionStatus.CANCELED,
    }

    return statusMap[stripeStatus] || SubscriptionStatus.NONE
  }

  /**
   * Récupère les informations d'abonnement d'un user
   */
  async getUserSubscription(userId: string) {
    return prisma.subscription.findFirst({
      where: {
        userId,
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  }

  /**
   * Vérifie si un user a un abonnement actif
   */
  async hasActiveSubscription(userId: string): Promise<boolean> {
    const subscription = await this.getUserSubscription(userId)
    return !!subscription
  }

  /**
   * Vérifie si un user a accès à une fonctionnalité selon son plan
   */
  async hasFeatureAccess(
    userId: string,
    requiredPlan: PlanType
  ): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { planType: true, subscriptionStatus: true },
    })

    if (!user) {
      return false
    }

    // Vérifier que l'abonnement est actif
    if (
      user.subscriptionStatus !== SubscriptionStatus.ACTIVE &&
      user.subscriptionStatus !== SubscriptionStatus.TRIALING
    ) {
      return false
    }

    // Hiérarchie des plans: FREE < PRO < BUSINESS
    const planHierarchy: Record<PlanType, number> = {
      FREE: 0,
      PRO: 1,
      BUSINESS: 2,
    }

    return planHierarchy[user.planType] >= planHierarchy[requiredPlan]
  }
}

// Export instance singleton
export const stripeService = new StripeService()
