import axios, { type AxiosInstance, type AxiosError } from 'axios'

// URL de l'API depuis env (obligatoire, pas de fallback)
const API_URL = process.env.NEXT_PUBLIC_API_URL
if (!API_URL) {
  throw new Error('❌ NEXT_PUBLIC_API_URL must be defined in .env.local')
}

/**
 * Client Axios configuré avec intercepteurs
 * - Utilise httpOnly cookies pour les tokens (sécurité XSS)
 * - Gère le refresh token si expiré
 * - Centralise les erreurs
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000, // 10s timeout
  withCredentials: true, // Envoie cookies automatiquement
  headers: {
    'Content-Type': 'application/json',
  },
})

// ========================================
// INTERCEPTEUR REQUEST: Attacher token CSRF pour protection
// ========================================
apiClient.interceptors.request.use(
  (config) => {
    // Ajouter token CSRF sur toutes les requêtes mutantes (POST, PUT, PATCH, DELETE)
    const isMutatingRequest = ['post', 'put', 'patch', 'delete'].includes(
      config.method?.toLowerCase() || ''
    )

    if (isMutatingRequest && typeof document !== 'undefined') {
      // Récupérer le token depuis le cookie csrfToken
      const csrfToken = document.cookie
        .split('; ')
        .find((row) => row.startsWith('csrfToken='))
        ?.split('=')[1]

      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken
      }
    }

    return config
  },
  (error) => Promise.reject(error)
)

// ========================================
// INTERCEPTEUR RESPONSE: Refresh token avec queue pattern (évite race condition)
// ========================================
let isRefreshing = false
let refreshSubscribers: Array<() => void> = []

const onRefreshed = () => {
  refreshSubscribers.forEach((callback) => callback())
  refreshSubscribers = []
}

const addRefreshSubscriber = (callback: () => void) => {
  refreshSubscribers.push(callback)
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config

    // Si 401 et pas déjà en train de refresh
    if (error.response?.status === 401 && originalRequest && !isRefreshing) {
      // Éviter boucle infinie sur /refresh ou /login
      if (originalRequest.url?.includes('/auth/refresh') ||
          originalRequest.url?.includes('/auth/login')) {
        // Redirect vers login si refresh échoue
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }

      if (!isRefreshing) {
        isRefreshing = true

        try {
          // Appeler l'endpoint de refresh (token envoyé automatiquement via cookies)
          await axios.post(
            `${API_URL}/api/auth/refresh`,
            {},
            { withCredentials: true }
          )

          // Token refreshé avec succès
          isRefreshing = false
          onRefreshed()

          // Réessayer la requête originale
          return apiClient(originalRequest)
        } catch {
          // Refresh failed, redirect vers login
          isRefreshing = false
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
            window.location.href = '/login'
          }
          return Promise.reject(error)
        }
      }

      // Si déjà en train de refresh, attendre qu'il se termine
      return new Promise((resolve) => {
        addRefreshSubscriber(() => {
          resolve(apiClient(originalRequest))
        })
      })
    }

    return Promise.reject(error)
  }
)
