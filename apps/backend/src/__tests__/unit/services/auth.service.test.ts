import { AuthService } from '@/services/auth.service'
import { prisma } from '@/config/prisma'
import bcrypt from 'bcryptjs'

// Mock Prisma
jest.mock('@/config/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    verificationToken: {
      deleteMany: jest.fn(),
    },
  },
}))

// Mock bcrypt
jest.mock('bcryptjs')

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock_jwt_token'),
  verify: jest.fn((token: string) => {
    if (token === 'valid_refresh_token') {
      return { userId: 'user_123' }
    }
    if (token === 'expired_token') {
      return { userId: 'user_123' }
    }
    throw new Error('Invalid token')
  }),
}))

// Mock VerificationService
jest.mock('@/services/verification.service', () => ({
  VerificationService: {
    createVerificationToken: jest.fn().mockResolvedValue(undefined),
  },
}))

describe('AuthService', () => {
  let authService: AuthService

  beforeEach(() => {
    authService = new AuthService()
    jest.clearAllMocks()
  })

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        password: 'hashed_password',
        name: 'Test User',
        role: 'USER' as const,
        emailVerified: true,
        planType: 'FREE' as const,
        subscriptionStatus: 'NONE' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
      ;(prisma.refreshToken.create as jest.Mock).mockResolvedValue({
        id: 'token_123',
        token: 'refresh_token',
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      })

      expect(result).toHaveProperty('user')
      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
      expect(result.user.email).toBe('test@example.com')
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      })
    })

    it('should fail with invalid email', async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)

      await expect(
        authService.login({ email: 'invalid@example.com', password: 'password123' })
      ).rejects.toThrow('Invalid credentials')
    })

    it('should fail with invalid password', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        password: 'hashed_password',
      }

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)

      await expect(
        authService.login({ email: 'test@example.com', password: 'wrongpassword' })
      ).rejects.toThrow('Invalid credentials')
    })

    it('should protect against timing attacks', async () => {
      // When user doesn't exist, should still do bcrypt comparison
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)

      await expect(
        authService.login({ email: 'nonexistent@example.com', password: 'password' })
      ).rejects.toThrow('Invalid credentials')

      // Should still call bcrypt.compare even when user doesn't exist (due to DUMMY_HASH)
      expect(bcrypt.compare).toHaveBeenCalled()
    })
  })

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'newuser@example.com',
        name: 'New User',
        role: 'USER' as const,
        emailVerified: false,
        planType: 'FREE' as const,
        subscriptionStatus: 'NONE' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
      ;(bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password')
      ;(prisma.user.create as jest.Mock).mockResolvedValue(mockUser)
      ;(prisma.refreshToken.create as jest.Mock).mockResolvedValue({
        id: 'token_123',
        token: 'refresh_token',
        userId: mockUser.id,
      })

      const result = await authService.register({
        email: 'newuser@example.com',
        password: 'SecurePass123',
        name: 'New User',
      })

      expect(result).toHaveProperty('user')
      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
      expect(result.user.email).toBe('newuser@example.com')
      expect(bcrypt.hash).toHaveBeenCalledWith('SecurePass123', 10)
    })

    it('should fail if email already exists', async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing_user',
        email: 'existing@example.com',
      })

      await expect(
        authService.register({
          email: 'existing@example.com',
          password: 'password',
          name: 'Test',
        })
      ).rejects.toThrow('Email already in use')
    })
  })

  describe('refreshToken', () => {
    it('should refresh tokens successfully', async () => {
      const mockToken = {
        id: 'token_123',
        token: 'valid_refresh_token',
        userId: 'user_123',
        revoked: false,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: {
          id: 'user_123',
          email: 'test@example.com',
          role: 'USER' as const,
        },
      }

      ;(prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(mockToken)
      ;(prisma.refreshToken.update as jest.Mock).mockResolvedValue({ ...mockToken, revoked: true })
      ;(prisma.refreshToken.create as jest.Mock).mockResolvedValue({
        id: 'new_token_123',
        token: 'new_refresh_token',
        userId: 'user_123',
      })

      const result = await authService.refresh('valid_refresh_token')

      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'token_123' },
        data: { revoked: true },
      })
    })

    it('should fail with expired token', async () => {
      const mockToken = {
        id: 'token_123',
        token: 'expired_token',
        userId: 'user_123',
        revoked: false,
        expiresAt: new Date(Date.now() - 1000), // Expired
        user: {
          id: 'user_123',
          email: 'test@example.com',
        },
      }

      ;(prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(mockToken)

      await expect(
        authService.refresh('expired_token')
      ).rejects.toThrow('Invalid or expired refresh token')
    })

    it('should fail with invalid token', async () => {
      ;(prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(
        authService.refresh('invalid_token')
      ).rejects.toThrow('Invalid or expired refresh token')
    })
  })
})
