/**
 * Configuration Stripe
 * Contient les IDs de prix et la clé publique
 */

// Clé publique Stripe (depuis .env)
export const STRIPE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''

// IDs de prix Stripe (à configurer depuis votre dashboard Stripe)
export const STRIPE_PRICES = {
  PRO: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO || 'price_xxx',
  BUSINESS: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS || 'price_xxx',
} as const

// Configuration des plans
export const PLANS = {
  FREE: {
    name: 'Free',
    price: 0,
    priceId: null,
    features: [
      'Accès basique',
      '10 requêtes / jour',
      'Support communautaire',
    ],
  },
  PRO: {
    name: 'Pro',
    price: 15,
    priceId: STRIPE_PRICES.PRO,
    features: [
      'Tout de Free',
      '1000 requêtes / jour',
      'Export de données',
      'Support prioritaire',
    ],
  },
  BUSINESS: {
    name: 'Business',
    price: 50,
    priceId: STRIPE_PRICES.BUSINESS,
    features: [
      'Tout de Pro',
      'Requêtes illimitées',
      'Gestion d\'équipe',
      'API avancée',
      'Support dédié',
    ],
  },
} as const

export type PlanType = keyof typeof PLANS
