import { useState } from 'react'
import { apiClient } from '@/lib/api/client'
import { PlanType } from './config'

/**
 * Hook pour créer une session de checkout Stripe
 */
export function useCheckout() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createCheckoutSession = async (
    priceId: string,
    planType: PlanType
  ): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      const response = await apiClient.post('/api/stripe/create-checkout-session', {
        priceId,
        planType,
      })

      const { url } = response.data.data

      // Rediriger vers la page de checkout Stripe
      window.location.href = url
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erreur lors de la création du checkout'
      setError(message)
      setLoading(false)
    }
  }

  return { createCheckoutSession, loading, error }
}

/**
 * Hook pour créer une session de portail de billing
 */
export function useBillingPortal() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openBillingPortal = async (): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      const response = await apiClient.post('/api/stripe/create-portal-session')

      const { url } = response.data.data

      // Rediriger vers le portail Stripe
      window.location.href = url
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erreur lors de l\'ouverture du portail'
      setError(message)
      setLoading(false)
    }
  }

  return { openBillingPortal, loading, error }
}

/**
 * Hook pour récupérer l'abonnement actuel
 */
export function useSubscription() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subscription, setSubscription] = useState<any>(null)

  const fetchSubscription = async (): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      const response = await apiClient.get('/api/stripe/subscription')
      setSubscription(response.data.data.subscription)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Erreur lors de la récupération de l\'abonnement'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return { subscription, fetchSubscription, loading, error }
}
