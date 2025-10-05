import { apiClient } from './client'
import type { User } from '@/types'

export type RegisterDTO = {
  email: string
  password: string
  name?: string
}

export type LoginDTO = {
  email: string
  password: string
}

export type AuthResponse = {
  user: User
  accessToken: string
  refreshToken: string
}

/**
 * API d'authentification avec types stricts
 */
export const authApi = {
  /**
   * Créer un nouveau compte
   */
  register: async (data: RegisterDTO): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/api/auth/register', data)
    return response.data
  },

  /**
   * Se connecter
   */
  login: async (data: LoginDTO): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/api/auth/login', data)
    return response.data
  },

  /**
   * Récupérer l'utilisateur actuel
   */
  me: async (): Promise<{ user: User }> => {
    const response = await apiClient.get<{ user: User }>('/api/auth/me')
    return response.data
  },

  /**
   * Refresh le token d'accès
   */
  refresh: async (refreshToken: string): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/api/auth/refresh', {
      refreshToken,
    })
    return response.data
  },
}
