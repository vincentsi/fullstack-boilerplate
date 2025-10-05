import axios, { type AxiosInstance, type AxiosError } from 'axios'

// URL de l'API depuis env
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

/**
 * Client Axios configuré avec intercepteurs
 * - Ajoute automatiquement le token JWT
 * - Gère le refresh token si expiré
 * - Centralise les erreurs
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ========================================
// INTERCEPTEUR REQUEST: Ajoute le token
// ========================================
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ========================================
// INTERCEPTEUR RESPONSE: Refresh token
// ========================================
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config

    // Si 401 et qu'on a un refresh token, essayer de refresh
    if (error.response?.status === 401 && originalRequest) {
      const refreshToken = localStorage.getItem('refreshToken')

      if (refreshToken) {
        try {
          // Appeler l'endpoint de refresh
          const { data } = await axios.post(`${API_URL}/api/auth/refresh`, {
            refreshToken,
          })

          // Sauvegarder les nouveaux tokens
          localStorage.setItem('accessToken', data.accessToken)
          localStorage.setItem('refreshToken', data.refreshToken)

          // Réessayer la requête originale avec le nouveau token
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
          return apiClient(originalRequest)
        } catch {
          // Refresh failed, logout l'utilisateur
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          window.location.href = '/login'
        }
      }
    }

    return Promise.reject(error)
  }
)
