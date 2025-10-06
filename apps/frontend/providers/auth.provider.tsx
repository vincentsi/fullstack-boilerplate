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
      try {
        const response = await authApi.me()
        return response.user
      } catch {
        return null
      }
    },
    enabled: isInitialized,
    staleTime: 5 * 60 * 1000, // 5 minutes pour user data
  })

  useEffect(() => {
    setIsInitialized(true)
  }, [])

  // Mutation pour le login
  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      // Tokens stockés en httpOnly cookies par le backend
      queryClient.setQueryData(['me'], data.user)
      router.push('/dashboard')
    },
  })

  // Mutation pour le register
  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      // Tokens stockés en httpOnly cookies par le backend
      queryClient.setQueryData(['me'], data.user)
      router.push('/dashboard')
    },
  })

  const logout = async () => {
    try {
      // Appeler le logout backend pour révoquer les tokens
      await authApi.logout()
    } catch {
      // Ignorer les erreurs de logout
    }
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
