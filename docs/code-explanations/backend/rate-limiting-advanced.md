# Rate Limiting Avancé - Routes Sensibles

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Problème résolu](#problème-résolu)
3. [Implémentation](#implémentation)
4. [Configuration par route](#configuration-par-route)
5. [Stratégies de rate limiting](#stratégies-de-rate-limiting)
6. [Monitoring et bypass](#monitoring-et-bypass)

---

## Vue d'ensemble

Cette boilerplate implémente un **rate limiting spécifique** sur les routes sensibles (verification, reset password) pour prévenir les abus et le spam d'emails.

### Routes protégées

| Route | Limite | Fenêtre | Raison |
|-------|--------|---------|--------|
| `/api/verification/resend-verification` | 3 req | 1 heure | Prévenir spam d'emails |
| `/api/auth/forgot-password` | 3 req | 1 heure | Prévenir abuse de reset |
| `/api/auth/reset-password` | 5 req | 15 min | Prévenir brute force |

### Rate limiting global (déjà présent)

En plus de ces limites spécifiques, le rate limiting **global** est déjà configuré dans `security.middleware.ts`:

```typescript
// Global rate limit: 100 requêtes par 15 minutes
await app.register(fastifyRateLimit, {
  max: 100,
  timeWindow: '15 minutes'
})
```

---

## Problème résolu

### Scénario d'attaque 1: Spam d'emails de vérification

**Sans rate limiting**:
```bash
# Attaquant fait une boucle
for i in {1..1000}; do
  curl -X POST http://api.com/api/verification/resend-verification \
    -H "Cookie: accessToken=xxx" \
    -d '{"email":"victim@example.com"}'
done

# Résultat:
# - 1000 emails envoyés à la victime 😱
# - Coût email provider (SendGrid/etc): $$$
# - Victime spammée
# - IP/domaine peut être blacklisté
```

**Avec rate limiting**:
```bash
# Attaquant fait une boucle
for i in {1..1000}; do
  curl -X POST http://api.com/api/verification/resend-verification \
    -H "Cookie: accessToken=xxx" \
    -d '{"email":"victim@example.com"}'
done

# Résultat:
# - 3 premiers emails OK
# - 997 requêtes suivantes: 429 Too Many Requests ✅
# - Victime reçoit seulement 3 emails (acceptable)
```

### Scénario d'attaque 2: Brute force password reset

**Sans rate limiting**:
```bash
# Attaquant essaie de deviner le token de reset
for token in $(cat tokens.txt); do
  curl -X POST http://api.com/api/auth/reset-password \
    -d "{\"token\":\"$token\",\"newPassword\":\"hacked\"}"
done

# Si tokens.txt contient 10,000 tokens:
# - Attaquant peut tester tous les tokens
# - Si token = 6 digits (1,000,000 possibilités)
# - Crack en ~1h
```

**Avec rate limiting** (5 req/15min):
```bash
# Attaquant essaie de deviner le token
for token in $(cat tokens.txt); do
  curl -X POST http://api.com/api/auth/reset-password \
    -d "{\"token\":\"$token\",\"newPassword\":\"hacked\"}"
done

# Résultat:
# - 5 tentatives OK
# - 15 minutes de cooldown
# - Pour tester 10,000 tokens: 10000/5*15min = 500h = 20 jours ✅
# - Crack non viable
```

---

## Implémentation

### Configuration Fastify Rate Limit

Le rate limiting est déjà configuré **globalement** dans la boilerplate:

**Fichier**: `apps/backend/src/middlewares/security.middleware.ts`

```typescript
import fastifyRateLimit from '@fastify/rate-limit'

export async function registerSecurityMiddlewares(app: FastifyInstance) {
  // ... autres middlewares

  // Rate limiting global
  await app.register(fastifyRateLimit, {
    max: 100,                    // Max 100 requêtes
    timeWindow: '15 minutes',    // Par fenêtre de 15min
    cache: 10000,                // Cache 10k IPs
    allowList: ['127.0.0.1'],    // Whitelist localhost (dev)
    redis: undefined,            // Utiliser Redis en production
    skipOnError: true,           // Ne pas bloquer si erreur rate limit
    keyGenerator: (request) => {
      // Identifier par IP
      return request.ip
    },
    errorResponseBuilder: (request, context) => {
      return {
        success: false,
        error: 'Too many requests',
        retryAfter: context.after
      }
    }
  })
}
```

### Rate limiting spécifique par route

Pour les routes sensibles, on **override** la config globale:

**Fichier**: `apps/backend/src/routes/verification.route.ts`

```typescript
import { FastifyInstance } from 'fastify'
import { VerificationController } from '../controllers/verification.controller'

export async function verificationRoutes(fastify: FastifyInstance) {
  const controller = new VerificationController()

  // GET /api/verification/verify-email?token=xxx
  // Pas de rate limit (lecture seule)
  fastify.get('/verify-email', controller.verifyEmail.bind(controller))

  // POST /api/verification/resend-verification
  // Rate limit spécifique: 3 req/heure
  fastify.post(
    '/resend-verification',
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '1 hour',
        },
      },
    },
    controller.resendVerification.bind(controller)
  )
}
```

**Fichier**: `apps/backend/src/routes/password-reset.route.ts`

```typescript
import { FastifyInstance } from 'fastify'
import { PasswordResetController } from '../controllers/password-reset.controller'

export async function passwordResetRoutes(fastify: FastifyInstance) {
  const controller = new PasswordResetController()

  // POST /api/auth/forgot-password
  // Rate limit: 3 req/heure (prévenir spam)
  fastify.post(
    '/forgot-password',
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '1 hour',
        },
      },
    },
    controller.requestReset.bind(controller)
  )

  // POST /api/auth/reset-password
  // Rate limit: 5 req/15min (prévenir brute force)
  fastify.post(
    '/reset-password',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '15 minutes',
        },
      },
    },
    controller.resetPassword.bind(controller)
  )
}
```

---

## Configuration par route

### Syntaxe Fastify

```typescript
fastify.post(
  '/route-path',
  {
    config: {
      rateLimit: {
        max: number,              // Nombre max de requêtes
        timeWindow: string,       // Fenêtre de temps
        skipOnError?: boolean,    // Skip si erreur
        keyGenerator?: (req) => string  // Custom key
      }
    }
  },
  handler
)
```

### Exemples de configurations

```typescript
// 1. Email verification: Spam prevention
{
  rateLimit: {
    max: 3,
    timeWindow: '1 hour'
  }
}
// Cas d'usage: User légitime ne devrait pas avoir besoin
// de renvoyer >3 emails/heure

// 2. Password reset request: Abuse prevention
{
  rateLimit: {
    max: 3,
    timeWindow: '1 hour'
  }
}
// Cas d'usage: Même user ne peut pas spammer plusieurs resets

// 3. Password reset confirmation: Brute force prevention
{
  rateLimit: {
    max: 5,
    timeWindow: '15 minutes'
  }
}
// Cas d'usage: Attaquant essaie de deviner le token
// 5 tentatives = largement suffisant pour user légitime qui a le bon token
```

### Pourquoi ces valeurs spécifiques?

| Route | Max | Temps | Justification |
|-------|-----|-------|---------------|
| resend-verification | 3 | 1h | User légitime: 1 email suffit. Si pas reçu, attendre 1h est acceptable |
| forgot-password | 3 | 1h | User légitime ne demande reset qu'1 fois. 3 permet typo emails |
| reset-password | 5 | 15min | Token correct = 1 tentative. 5 permet typo password + retry |

---

## Stratégies de rate limiting

### 1. Par IP (défaut)

```typescript
// Dans security.middleware.ts
keyGenerator: (request) => {
  return request.ip  // Limite par adresse IP
}
```

**Avantages**:
- Simple à implémenter
- Protège contre attaques distribuées (dans une certaine mesure)

**Inconvénients**:
- Utilisateurs derrière même IP (NAT) partagent la limite
- Attaquant peut changer d'IP facilement

### 2. Par user (authentifié)

```typescript
// Override pour routes authentifiées
fastify.post('/route', {
  config: {
    rateLimit: {
      keyGenerator: (request) => {
        // Si authentifié, limiter par user
        if (request.user?.userId) {
          return `user:${request.user.userId}`
        }
        // Sinon, limiter par IP
        return request.ip
      }
    }
  }
}, handler)
```

**Avantages**:
- Plus précis (1 user = 1 limite)
- Pas d'impact sur autres users

**Inconvénients**:
- Attaquant peut créer plusieurs comptes

### 3. Combinaison IP + User

```typescript
keyGenerator: (request) => {
  const userId = request.user?.userId || 'anonymous'
  return `${request.ip}:${userId}`
}
```

**Avantages**:
- Protection double
- Limite même si attaquant crée plusieurs comptes

### 4. Par email (pour forgot-password)

```typescript
// Dans password-reset.route.ts
fastify.post('/forgot-password', {
  config: {
    rateLimit: {
      keyGenerator: (request) => {
        // Limiter par email cible
        const email = (request.body as any).email
        return `email:${email}`
      },
      max: 3,
      timeWindow: '1 hour'
    }
  }
}, controller.requestReset.bind(controller))
```

**Avantages**:
- Protège directement la victime
- Même attaquant avec 100 IPs ne peut spam 1 email

**Recommandation**: **Utiliser cette stratégie** pour `/forgot-password` ✅

---

## Responses HTTP

### Requête réussie (dans la limite)

```bash
curl -X POST http://localhost:3001/api/verification/resend-verification \
  -H "Cookie: accessToken=xxx"

# Response: 200 OK
{
  "success": true,
  "message": "Email de vérification renvoyé"
}

# Headers:
X-RateLimit-Limit: 3
X-RateLimit-Remaining: 2
X-RateLimit-Reset: 1696953600
```

### Requête bloquée (rate limit atteint)

```bash
# 4ème requête (limite = 3)
curl -X POST http://localhost:3001/api/verification/resend-verification \
  -H "Cookie: accessToken=xxx"

# Response: 429 Too Many Requests
{
  "success": false,
  "error": "Too many requests",
  "retryAfter": "2023-10-10T15:00:00.000Z"
}

# Headers:
X-RateLimit-Limit: 3
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1696953600
Retry-After: 3600
```

### Frontend handling

```typescript
// lib/api/client.ts
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 429) {
      const retryAfter = error.response.data.retryAfter
      const date = new Date(retryAfter)

      toast.error(
        `Trop de requêtes. Réessayez dans ${formatDuration(date - Date.now())}`
      )
    }
    return Promise.reject(error)
  }
)
```

---

## Monitoring et bypass

### Monitoring

```typescript
// Ajouter logging des rate limits
await app.register(fastifyRateLimit, {
  max: 100,
  timeWindow: '15 minutes',
  onExceeding: (request, key) => {
    // Appelé quand limite est dépassée
    app.log.warn({
      event: 'RATE_LIMIT_EXCEEDED',
      ip: request.ip,
      key,
      route: request.url,
      method: request.method
    })
  },
  onExceeded: (request, key) => {
    // Appelé quand requête est bloquée
    app.log.error({
      event: 'RATE_LIMIT_BLOCKED',
      ip: request.ip,
      key,
      route: request.url,
      method: request.method
    })
  }
})
```

### Whitelist IPs (pour tests/CI)

```typescript
await app.register(fastifyRateLimit, {
  max: 100,
  timeWindow: '15 minutes',
  allowList: [
    '127.0.0.1',           // Localhost
    '::1',                 // IPv6 localhost
    '10.0.0.0/8',          // Private network
    '192.168.1.100',       // IP de CI/CD
  ],
  allowList: (request, key) => {
    // Whitelist dynamique
    const apiKey = request.headers['x-api-key']
    if (apiKey === process.env.INTERNAL_API_KEY) {
      return true  // Skip rate limit
    }
    return false
  }
})
```

### Bypass pour admins

```typescript
keyGenerator: (request) => {
  // Admins ont une limite 10x plus haute
  const isAdmin = request.user?.role === 'ADMIN'
  const prefix = isAdmin ? 'admin' : 'user'

  return `${prefix}:${request.user?.userId || request.ip}`
}

// Puis dans la config:
max: (request, key) => {
  return key.startsWith('admin:') ? 1000 : 100
}
```

---

## Production avec Redis

En production, **utiliser Redis** pour stocker les compteurs de rate limit (sinon chaque instance Fastify a son propre compteur).

```typescript
import Redis from 'ioredis'

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
})

await app.register(fastifyRateLimit, {
  max: 100,
  timeWindow: '15 minutes',
  redis,  // ✅ Partagé entre toutes les instances
  nameSpace: 'rate-limit:',
})
```

**Avantages**:
- Rate limit partagé entre instances (horizontal scaling)
- Persistance (survit aux redémarrages)
- Performance (Redis très rapide)

---

## Tests

### Test 1: Vérifier limite respectée

```typescript
import { createApp } from '@/app'

describe('Rate Limiting', () => {
  it('should allow 3 verification emails per hour', async () => {
    const app = await createApp()

    // Login
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'user@test.com', password: 'password123' }
    })
    const cookies = loginRes.cookies

    // Tentative 1: OK
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/verification/resend-verification',
      cookies
    })
    expect(res1.statusCode).toBe(200)

    // Tentative 2: OK
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/verification/resend-verification',
      cookies
    })
    expect(res2.statusCode).toBe(200)

    // Tentative 3: OK
    const res3 = await app.inject({
      method: 'POST',
      url: '/api/verification/resend-verification',
      cookies
    })
    expect(res3.statusCode).toBe(200)

    // Tentative 4: BLOQUÉE ✅
    const res4 = await app.inject({
      method: 'POST',
      url: '/api/verification/resend-verification',
      cookies
    })
    expect(res4.statusCode).toBe(429)
    expect(res4.json().error).toContain('Too many requests')
  })
})
```

### Test 2: Vérifier reset après fenêtre

```typescript
it('should reset limit after time window', async () => {
  const app = await createApp()

  // Atteindre la limite (3 requêtes)
  for (let i = 0; i < 3; i++) {
    await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email: 'user@test.com' }
    })
  }

  // 4ème requête bloquée
  const resBlocked = await app.inject({
    method: 'POST',
    url: '/api/auth/forgot-password',
    payload: { email: 'user@test.com' }
  })
  expect(resBlocked.statusCode).toBe(429)

  // Simuler passage du temps (mock time)
  jest.advanceTimersByTime(60 * 60 * 1000 + 1000) // 1h + 1s

  // Requête devrait passer maintenant ✅
  const resOk = await app.inject({
    method: 'POST',
    url: '/api/auth/forgot-password',
    payload: { email: 'user@test.com' }
  })
  expect(resOk.statusCode).toBe(200)
})
```

---

## Références

- [@fastify/rate-limit Documentation](https://github.com/fastify/fastify-rate-limit)
- [OWASP Rate Limiting](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)

---

**Auteur**: Documentation générée pour la boilerplate Node.js
**Date**: 2025-10-10
**Version**: 1.0.0
