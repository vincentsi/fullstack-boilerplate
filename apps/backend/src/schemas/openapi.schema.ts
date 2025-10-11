/**
 * OpenAPI/Swagger schemas for API documentation
 * Defines request/response schemas for all endpoints
 */

// Common response schemas
export const errorResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: { type: 'string' },
  },
} as const

export const successResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
  },
} as const

// User schema
export const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    email: { type: 'string', format: 'email' },
    name: { type: 'string', nullable: true },
    role: { type: 'string', enum: ['USER', 'ADMIN', 'MODERATOR'] },
    emailVerified: { type: 'boolean' },
    planType: { type: 'string', enum: ['FREE', 'PRO', 'BUSINESS'] },
    subscriptionStatus: {
      type: 'string',
      enum: ['NONE', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'TRIALING'],
    },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const

// Auth schemas
export const registerSchema = {
  description: 'Register a new user account',
  tags: ['auth'],
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        description: 'User email address',
      },
      password: {
        type: 'string',
        minLength: 8,
        pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)',
        description: 'Password (min 8 chars, 1 uppercase, 1 lowercase, 1 number)',
      },
      name: {
        type: 'string',
        nullable: true,
        description: 'User full name (optional)',
      },
    },
  },
  response: {
    200: {
      description: 'User successfully registered',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            user: userSchema,
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
          },
        },
      },
    },
    400: errorResponse,
    429: {
      description: 'Too many registration attempts',
      ...errorResponse,
    },
  },
} as const

export const loginSchema = {
  description: 'Authenticate user and return JWT tokens',
  tags: ['auth'],
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        description: 'User email address',
      },
      password: {
        type: 'string',
        description: 'User password',
      },
    },
  },
  response: {
    200: {
      description: 'Login successful',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            user: userSchema,
            accessToken: { type: 'string', description: 'JWT access token (15min expiry)' },
            refreshToken: { type: 'string', description: 'JWT refresh token (7 days expiry)' },
          },
        },
      },
    },
    400: errorResponse,
    401: {
      description: 'Invalid credentials',
      ...errorResponse,
    },
    429: {
      description: 'Too many login attempts',
      ...errorResponse,
    },
  },
} as const

export const refreshTokenSchema = {
  description: 'Refresh access token using refresh token',
  tags: ['auth'],
  body: {
    type: 'object',
    required: ['refreshToken'],
    properties: {
      refreshToken: {
        type: 'string',
        description: 'Valid refresh token',
      },
    },
  },
  response: {
    200: {
      description: 'Tokens refreshed successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
          },
        },
      },
    },
    401: {
      description: 'Invalid or expired refresh token',
      ...errorResponse,
    },
  },
} as const

export const meSchema = {
  description: 'Get current authenticated user information',
  tags: ['auth'],
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      description: 'User information retrieved',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            user: userSchema,
          },
        },
      },
    },
    401: {
      description: 'Not authenticated',
      ...errorResponse,
    },
  },
} as const

// Health check schema
export const healthCheckSchema = {
  description: 'Check API health status',
  tags: ['health'],
  response: {
    200: {
      description: 'API is healthy',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  },
} as const

// Stripe schemas
export const createCheckoutSessionSchema = {
  description: 'Create Stripe checkout session for subscription',
  tags: ['stripe'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['priceId'],
    properties: {
      priceId: {
        type: 'string',
        description: 'Stripe price ID (price_xxx)',
      },
    },
  },
  response: {
    200: {
      description: 'Checkout session created',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Stripe checkout URL' },
          },
        },
      },
    },
    401: errorResponse,
    400: errorResponse,
  },
} as const

export const getSubscriptionSchema = {
  description: 'Get current user subscription details',
  tags: ['stripe'],
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      description: 'Subscription details retrieved',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            subscription: {
              type: 'object',
              nullable: true,
              properties: {
                status: { type: 'string' },
                planType: { type: 'string' },
                currentPeriodEnd: { type: 'string', format: 'date-time' },
                cancelAtPeriodEnd: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
    401: errorResponse,
  },
} as const

// Admin schemas
export const listUsersSchema = {
  description: 'List all users with pagination (Admin only)',
  tags: ['admin'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'string', description: 'Page number' },
      limit: { type: 'string', description: 'Items per page (max 100)' },
    },
  },
  response: {
    200: {
      description: 'Users list retrieved',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            users: { type: 'array', items: userSchema },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                totalCount: { type: 'number' },
                totalPages: { type: 'number' },
                hasNextPage: { type: 'boolean' },
                hasPreviousPage: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
    400: errorResponse,
    401: errorResponse,
    403: { description: 'Requires ADMIN role', ...errorResponse },
  },
} as const

export const updateUserRoleSchema = {
  description: 'Update user role (Admin only)',
  tags: ['admin'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', description: 'User ID' },
    },
  },
  body: {
    type: 'object',
    required: ['role'],
    properties: {
      role: {
        type: 'string',
        enum: ['USER', 'ADMIN', 'MODERATOR'],
        description: 'New role',
      },
    },
  },
  response: {
    200: {
      description: 'Role updated successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            user: userSchema,
          },
        },
      },
    },
    400: errorResponse,
    401: errorResponse,
    403: { description: 'Requires ADMIN role', ...errorResponse },
  },
} as const

export const deleteUserSchema = {
  description: 'Delete a user (Admin only)',
  tags: ['admin'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', description: 'User ID' },
    },
  },
  response: {
    200: {
      description: 'User deleted successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
    400: errorResponse,
    401: errorResponse,
    403: { description: 'Requires ADMIN role', ...errorResponse },
  },
} as const

export const cleanupTokensSchema = {
  description: 'Manually trigger token cleanup (Admin only)',
  tags: ['admin'],
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      description: 'Cleanup completed',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
    401: errorResponse,
    403: { description: 'Requires ADMIN role', ...errorResponse },
  },
} as const

export const adminStatsSchema = {
  description: 'Get user statistics (Admin/Moderator)',
  tags: ['admin'],
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      description: 'Statistics retrieved',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            totalUsers: { type: 'number' },
            verifiedUsers: { type: 'number' },
            unverifiedUsers: { type: 'number' },
            byRole: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  role: { type: 'string' },
                  count: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    401: errorResponse,
    403: { description: 'Requires ADMIN or MODERATOR role', ...errorResponse },
  },
} as const

// Verification schemas
export const verifyEmailSchema = {
  description: 'Verify email address with token',
  tags: ['verification'],
  querystring: {
    type: 'object',
    required: ['token'],
    properties: {
      token: { type: 'string', description: 'Email verification token' },
    },
  },
  response: {
    200: {
      description: 'Email verified successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
    400: { description: 'Invalid or expired token', ...errorResponse },
  },
} as const

export const resendVerificationSchema = {
  description: 'Resend verification email',
  tags: ['verification'],
  body: {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', format: 'email', description: 'User email' },
    },
  },
  response: {
    200: {
      description: 'Verification email sent',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
    400: errorResponse,
    429: { description: 'Too many requests', ...errorResponse },
  },
} as const

// Password reset schemas
export const requestPasswordResetSchema = {
  description: 'Request password reset email',
  tags: ['password-reset'],
  body: {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', format: 'email', description: 'User email' },
    },
  },
  response: {
    200: {
      description: 'Reset email sent (always returns success for security)',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
    429: { description: 'Too many requests', ...errorResponse },
  },
} as const

export const resetPasswordSchema = {
  description: 'Reset password with token',
  tags: ['password-reset'],
  body: {
    type: 'object',
    required: ['token', 'newPassword'],
    properties: {
      token: { type: 'string', description: 'Password reset token' },
      newPassword: {
        type: 'string',
        minLength: 8,
        pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)',
        description: 'New password (min 8 chars, 1 uppercase, 1 lowercase, 1 number)',
      },
    },
  },
  response: {
    200: {
      description: 'Password reset successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
    400: { description: 'Invalid or expired token', ...errorResponse },
  },
} as const

// Premium schemas
export const proFeatureSchema = {
  description: 'Access PRO feature (requires PRO or BUSINESS subscription)',
  tags: ['premium'],
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      description: 'Feature accessed',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            feature: { type: 'string' },
            availableFor: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    401: errorResponse,
    403: { description: 'Requires active PRO or BUSINESS subscription', ...errorResponse },
  },
} as const

export const businessFeatureSchema = {
  description: 'Access BUSINESS feature (requires BUSINESS subscription)',
  tags: ['premium'],
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      description: 'Feature accessed',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            feature: { type: 'string' },
            availableFor: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    401: errorResponse,
    403: { description: 'Requires active BUSINESS subscription', ...errorResponse },
  },
} as const
