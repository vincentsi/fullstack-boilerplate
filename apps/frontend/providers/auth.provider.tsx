'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi, type LoginDTO, type RegisterDTO } from '@/lib/api/auth'
import type { User } from '@/types'

type AuthContextType = {
  user: User | null
  login: (data: LoginDTO) => Promise<void>
  register: (data: RegisterDTO) => Promise<void>
  logout: () => void
  isLoading: boolean
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false)
  const router = useRouter()
  const queryClient = useQueryClient()

  // Query pour récupérer l'utilisateur actuel
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken')
      if (!token) return null

      try {
        const response = await authApi.me()
        return response.user
      } catch {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        return null
      }
    },
    enabled: isInitialized,
  })

  useEffect(() => {
    setIsInitialized(true)
  }, [])

  // Mutation pour le login
  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('refreshToken', data.refreshToken)
      queryClient.setQueryData(['me'], data.user)
      router.push('/dashboard')
    },
  })

  // Mutation pour le register
  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('refreshToken', data.refreshToken)
      queryClient.setQueryData(['me'], data.user)
      router.push('/dashboard')
    },
  })

  const logout = () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    queryClient.setQueryData(['me'], null)
    queryClient.clear()
    router.push('/login')
  }

  const value: AuthContextType = {
    user: data ?? null,
    login: async (credentials) => {
      await loginMutation.mutateAsync(credentials)
    },
    register: async (data) => {
      await registerMutation.mutateAsync(data)
    },
    logout,
    isLoading: !isInitialized || isLoading,
    isAuthenticated: !!data,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
