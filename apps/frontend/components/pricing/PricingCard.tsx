'use client'

import { useState } from 'react'
import { useCheckout } from '@/lib/stripe/hooks'
import { PLANS, type PlanType } from '@/lib/stripe/config'

interface PricingCardProps {
  planType: PlanType
  currentPlan?: PlanType
}

export function PricingCard({ planType, currentPlan = 'FREE' }: PricingCardProps) {
  const plan = PLANS[planType]
  const { createCheckoutSession, loading } = useCheckout()
  const [isProcessing, setIsProcessing] = useState(false)

  const isCurrentPlan = currentPlan === planType
  const isDowngrade = PLANS[currentPlan].price > plan.price

  const handleSubscribe = async () => {
    if (!plan.priceId || planType === 'FREE') return

    setIsProcessing(true)
    await createCheckoutSession(plan.priceId, planType)
  }

  return (
    <div
      className={`
        relative rounded-lg border p-8 shadow-sm
        ${isCurrentPlan ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
      `}
    >
      {isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-blue-500 px-3 py-1 text-xs font-semibold text-white">
            Plan actuel
          </span>
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-xl font-bold">{plan.name}</h3>
        <div className="mt-2 flex items-baseline">
          <span className="text-4xl font-extrabold">${plan.price}</span>
          {plan.price > 0 && <span className="ml-1 text-gray-600">/mois</span>}
        </div>
      </div>

      <ul className="mb-6 space-y-3">
        {plan.features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <svg
              className="mr-2 h-5 w-5 flex-shrink-0 text-green-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm text-gray-700">{feature}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={handleSubscribe}
        disabled={isCurrentPlan || isDowngrade || loading || isProcessing || planType === 'FREE'}
        className={`
          w-full rounded-lg px-4 py-2 font-semibold transition-colors
          ${
            isCurrentPlan
              ? 'cursor-not-allowed bg-gray-300 text-gray-600'
              : isDowngrade
                ? 'cursor-not-allowed bg-gray-300 text-gray-600'
                : planType === 'FREE'
                  ? 'bg-gray-100 text-gray-600'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
          }
          ${(loading || isProcessing) && 'cursor-wait opacity-50'}
        `}
      >
        {isProcessing
          ? 'Chargement...'
          : isCurrentPlan
            ? 'Plan actuel'
            : isDowngrade
              ? 'Contactez le support'
              : planType === 'FREE'
                ? 'Gratuit'
                : 'Souscrire'}
      </button>

      {isDowngrade && !isCurrentPlan && (
        <p className="mt-2 text-center text-xs text-gray-500">
          Contactez le support pour rétrograder votre plan
        </p>
      )}
    </div>
  )
}
