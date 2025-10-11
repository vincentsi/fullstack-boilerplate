import * as Sentry from '@sentry/node'
import { nodeProfilingIntegration } from '@sentry/profiling-node'
import { env } from './env'

/**
 * Configure Sentry for error tracking and performance monitoring
 *
 * Features:
 * - Automatic error capture
 * - Performance monitoring
 * - Release tracking
 * - Environment tracking
 * - User context
 *
 * Usage:
 * 1. Get your DSN from https://sentry.io/
 * 2. Add SENTRY_DSN to .env
 * 3. Errors are automatically tracked
 */
export function initializeSentry() {
  // Only initialize in production or if explicitly enabled
  const sentryDsn = process.env.SENTRY_DSN

  if (!sentryDsn) {
    console.log('⚠️  Sentry DSN not configured - error tracking disabled')
    return
  }

  Sentry.init({
    dsn: sentryDsn,

    // Environment tracking
    environment: env.NODE_ENV,

    // Release tracking (useful for identifying which version has bugs)
    release: process.env.APP_VERSION || '1.0.0',

    // Performance Monitoring
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev

    // Profiling (CPU/Memory usage)
    profilesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,

    integrations: [
      // Enable profiling
      nodeProfilingIntegration(),
    ],

    // Filter out sensitive data
    beforeSend(event, hint) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers.authorization
        delete event.request.headers.cookie
      }

      // Remove sensitive query params
      if (event.request?.query_string) {
        const sensitiveParams = ['token', 'password', 'secret', 'apikey']
        sensitiveParams.forEach(param => {
          if (event.request?.query_string?.includes(param)) {
            event.request.query_string = event.request.query_string.replace(
              new RegExp(`${param}=[^&]*`, 'gi'),
              `${param}=***REDACTED***`
            )
          }
        })
      }

      return event
    },

    // Ignore common non-critical errors
    ignoreErrors: [
      // Browser errors
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',

      // Network errors
      'NetworkError',
      'Network request failed',

      // Common user errors (not server bugs)
      'Invalid credentials',
      'User not found',
    ],
  })

  console.log('✅ Sentry initialized - error tracking enabled')
}

/**
 * Capture exception manually
 * Use this for caught errors you still want to track
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (env.NODE_ENV === 'production') {
    Sentry.captureException(error, {
      extra: context,
    })
  } else {
    console.error('Sentry (dev mode):', error, context)
  }
}

/**
 * Set user context for error tracking
 * Call this after user authentication
 */
export function setUserContext(user: { id: string; email: string; role?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    role: user.role,
  })
}

/**
 * Clear user context (e.g., on logout)
 */
export function clearUserContext() {
  Sentry.setUser(null)
}

/**
 * Add breadcrumb for debugging
 * Breadcrumbs help understand what led to an error
 */
export function addBreadcrumb(message: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    data,
    level: 'info',
  })
}

/**
 * Start a transaction for performance monitoring
 *
 * Example:
 * const transaction = startTransaction('stripe-webhook')
 * // ... do work ...
 * transaction.finish()
 */
export function startTransaction(name: string, op: string = 'task') {
  return Sentry.startTransaction({
    name,
    op,
  })
}

export { Sentry }
