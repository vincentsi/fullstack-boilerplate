import { createApp } from '@/app'
import { FastifyInstance } from 'fastify'
import { prisma } from '@/config/prisma'

describe('Auth Routes Integration Tests', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await createApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(async () => {
    // Clean up test database before each test
    await prisma.refreshToken.deleteMany()
    await prisma.user.deleteMany()
  })

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'newuser@test.com',
          password: 'SecurePass123',
          name: 'Test User',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data.user.email).toBe('newuser@test.com')
      expect(body.data.accessToken).toBeDefined()
      expect(body.data.refreshToken).toBeDefined()
    })

    it('should fail with invalid password (too short)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@test.com',
          password: 'short',
          name: 'Test',
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should fail with invalid email format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'invalid-email',
          password: 'SecurePass123',
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should fail if email already exists', async () => {
      // First registration
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'duplicate@test.com',
          password: 'SecurePass123',
        },
      })

      // Second registration with same email
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'duplicate@test.com',
          password: 'AnotherPass123',
        },
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('already')
    })
  })

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'logintest@test.com',
          password: 'SecurePass123',
          name: 'Login Test',
        },
      })
    })

    it('should login with valid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'logintest@test.com',
          password: 'SecurePass123',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data.user.email).toBe('logintest@test.com')
      expect(body.data.accessToken).toBeDefined()
      expect(body.data.refreshToken).toBeDefined()
    })

    it('should fail with wrong password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'logintest@test.com',
          password: 'WrongPassword123',
        },
      })

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('Invalid credentials')
    })

    it('should fail with non-existent email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'nonexistent@test.com',
          password: 'SecurePass123',
        },
      })

      expect(response.statusCode).toBe(401)
    })

    it('should rate limit after too many attempts', async () => {
      // Make 4 failed login attempts (limit is 3)
      for (let i = 0; i < 4; i++) {
        await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: {
            email: 'logintest@test.com',
            password: 'WrongPassword',
          },
        })
      }

      // 5th attempt should be rate limited
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'logintest@test.com',
          password: 'SecurePass123',
        },
      })

      expect(response.statusCode).toBe(429)
    }, 20000) // Increase timeout for rate limiting tests
  })

  describe('GET /api/auth/me', () => {
    let accessToken: string

    beforeEach(async () => {
      // Register and get access token
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'metest@test.com',
          password: 'SecurePass123',
          name: 'Me Test',
        },
      })

      const body = JSON.parse(registerResponse.body)
      accessToken = body.data.accessToken
    })

    it('should return current user with valid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data.user.email).toBe('metest@test.com')
    })

    it('should fail without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      })

      expect(response.statusCode).toBe(401)
    })

    it('should fail with invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: 'Bearer invalid_token',
        },
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string

    beforeEach(async () => {
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'refreshtest@test.com',
          password: 'SecurePass123',
        },
      })

      const body = JSON.parse(registerResponse.body)
      refreshToken = body.data.refreshToken
    })

    it('should refresh tokens with valid refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: {
          refreshToken,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.data.accessToken).toBeDefined()
      expect(body.data.refreshToken).toBeDefined()
      expect(body.data.refreshToken).not.toBe(refreshToken) // Token should be rotated
    })

    it('should fail with invalid refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: {
          refreshToken: 'invalid_token',
        },
      })

      expect(response.statusCode).toBe(401)
    })

    it('should not allow reusing old refresh token (rotation)', async () => {
      // First refresh
      const firstRefresh = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken },
      })

      expect(firstRefresh.statusCode).toBe(200)

      // Try to reuse old token
      const secondRefresh = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken }, // Old token
      })

      expect(secondRefresh.statusCode).toBe(401)
    })
  })

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
    })
  })
})
