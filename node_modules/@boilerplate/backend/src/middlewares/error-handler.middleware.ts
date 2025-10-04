import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { env } from '@/config/env'

/**
 * Global Error Handler
 * Centralise la gestion des erreurs pour éviter la duplication
 * Gère les erreurs Zod, Prisma, JWT, et génériques
 */
export async function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Zod validation errors
  if (error instanceof ZodError) {
    const zodError = error as ZodError<unknown>
    return reply.status(400).send({
      success: false,
      error: 'Validation error',
      details: env.NODE_ENV === 'development' ? zodError.issues : undefined,
    })
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation (ex: email déjà utilisé)
    if (error.code === 'P2002') {
      const field = (error.meta?.target as string[])?.join(', ') || 'field'
      return reply.status(409).send({
        success: false,
        error: `${field} already exists`,
      })
    }

    // Record not found
    if (error.code === 'P2025') {
      return reply.status(404).send({
        success: false,
        error: 'Resource not found',
      })
    }
  }

  // JWT errors (token expiré, invalide, etc.)
  if (
    error.message.includes('jwt') ||
    error.message.includes('token') ||
    error.name === 'JsonWebTokenError' ||
    error.name === 'TokenExpiredError'
  ) {
    return reply.status(401).send({
      success: false,
      error: 'Invalid or expired token',
    })
  }

  // Rate limit errors
  if (error.statusCode === 429) {
    return reply.status(429).send({
      success: false,
      error: 'Too many requests, please try again later',
    })
  }

  // Erreur serveur générique
  request.log.error(error)
  return reply.status(error.statusCode || 500).send({
    success: false,
    error: error.message || 'Internal server error',
    ...(env.NODE_ENV === 'development' && { stack: error.stack }),
  })
}
