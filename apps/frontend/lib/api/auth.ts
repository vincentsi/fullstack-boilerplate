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
}

/**
 * API d'authentification avec types stricts
 * Les tokens sont stockés en httpOnly cookies par le backend
 */
export const authApi = {
  /**
   * Créer un nouveau compte
   */
  register: async (data: RegisterDTO): Promise<AuthResponse> => {
    const response = await apiClient.post<{ success: boolean; data: AuthResponse }>(
      '/api/auth/register',
      data
    )
    return response.data.data
  },

  /**
   * Se connecter
   */
  login: async (data: LoginDTO): Promise<AuthResponse> => {
    const response = await apiClient.post<{ success: boolean; data: AuthResponse }>(
      '/api/auth/login',
      data
    )
    return response.data.data
  },

  /**
   * Récupérer l'utilisateur actuel
   */
  me: async (): Promise<{ user: User }> => {
    const response = await apiClient.get<{ success: boolean; data: { user: User } }>(
      '/api/auth/me'
    )
    return response.data.data
  },

  /**
   * Se déconnecter et révoquer les tokens
   */
  logout: async (): Promise<void> => {
    await apiClient.post('/api/auth/logout')
  },
}
