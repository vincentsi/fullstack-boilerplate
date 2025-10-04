import { z } from 'zod'

/**
 * Schema de validation pour l'inscription (Register)
 * Valide email, password et name optionnel
 */
export const registerSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .min(1, 'Email is required')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(100, 'Password must be less than 100 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
      'Password must contain uppercase, lowercase, number, and special character (@$!%*?&)'
    ),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
})

/**
 * Schema de validation pour la connexion (Login)
 * Uniquement email et password requis
 */
export const loginSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .min(1, 'Email is required')
    .toLowerCase()
    .trim(),
  password: z.string().min(1, 'Password is required'),
})

/**
 * Schema de validation pour le refresh token
 */
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
})

/**
 * Types TypeScript inférés des schemas
 * Usage: import type { RegisterDTO, LoginDTO } from '@/schemas/auth.schema'
 */
export type RegisterDTO = z.infer<typeof registerSchema>
export type LoginDTO = z.infer<typeof loginSchema>
export type RefreshTokenDTO = z.infer<typeof refreshTokenSchema>
