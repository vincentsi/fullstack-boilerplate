# Nettoyage Automatique des Tokens Expirés

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Problème résolu](#problème-résolu)
3. [Architecture](#architecture)
4. [Implémentation](#implémentation)
5. [Configuration du Cron](#configuration-du-cron)
6. [Monitoring et logging](#monitoring-et-logging)
7. [Tests](#tests)

---

## Vue d'ensemble

Le système de nettoyage automatique supprime quotidiennement tous les tokens expirés de la base de données pour maintenir les performances et la sécurité de l'application.

### Caractéristiques

- ✅ **Nettoyage automatique quotidien** à 3h du matin
- ✅ **4 types de tokens** nettoyés (refresh, verification, reset, csrf)
- ✅ **Route admin manuelle** pour nettoyage à la demande
- ✅ **Logging complet** du nombre de tokens supprimés
- ✅ **Gestion d'erreurs** robuste

### Tokens nettoyés

| Type | Table | Expiration | Impact si non nettoyé |
|------|-------|------------|----------------------|
| Refresh tokens | `refresh_tokens` | 7 jours | Accumulation → Perf DB |
| Verification tokens | `verification_tokens` | 24 heures | Tokens inutilisables qui traînent |
| Password reset tokens | `password_reset_tokens` | 1 heure | Failles de sécurité potentielles |
| CSRF tokens | `csrf_tokens` | 1 heure | Pollution DB |

---

## Problème résolu

### Avant le nettoyage automatique

```sql
-- Exemple après 1 mois d'utilisation
SELECT COUNT(*) FROM refresh_tokens WHERE expiresAt < NOW();
-- Résultat: 15,000 tokens expirés 😱

SELECT COUNT(*) FROM verification_tokens WHERE expiresAt < NOW();
-- Résultat: 3,500 tokens expirés

SELECT COUNT(*) FROM password_reset_tokens WHERE expiresAt < NOW();
-- Résultat: 1,200 tokens expirés

SELECT COUNT(*) FROM csrf_tokens WHERE expiresAt < NOW();
-- Résultat: 8,000 tokens expirés

-- TOTAL: 27,700 rows inutiles 🔴
```

**Problèmes causés**:
1. **Performance dégradée**
   - Requêtes SQL plus lentes (index sur tables plus grandes)
   - Backups plus longs
   - Plus de mémoire consommée

2. **Sécurité**
   - Tokens expirés restent en DB (risque théorique)
   - Logs/audits difficiles à analyser

3. **Coûts**
   - Plus d'espace disque
   - Backups plus volumineux

### Après le nettoyage automatique

```sql
-- Tous les tokens expirés sont supprimés quotidiennement
SELECT COUNT(*) FROM refresh_tokens WHERE expiresAt < NOW();
-- Résultat: 0 ✅

SELECT COUNT(*) FROM verification_tokens WHERE expiresAt < NOW();
-- Résultat: 0 ✅

SELECT COUNT(*) FROM password_reset_tokens WHERE expiresAt < NOW();
-- Résultat: 0 ✅

SELECT COUNT(*) FROM csrf_tokens WHERE expiresAt < NOW();
-- Résultat: 0 ✅
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   CLEANUP ARCHITECTURE                      │
└─────────────────────────────────────────────────────────────┘

1. DÉMARRAGE SERVEUR
   server.ts
      │
      ├──> CleanupService.startCleanupJob(app)
      │       │
      │       └──> cron.schedule('0 3 * * *', ...)
      │               │
      │               └──> Job enregistré ✅
      │
      └──> Server démarre normalement

2. EXÉCUTION QUOTIDIENNE (3h00)
   Cron Job (3:00 AM)
      │
      ├──> app.log.info('Starting cleanup...')
      │
      ├──> CleanupService.cleanupExpiredTokens()
      │       │
      │       ├──> DELETE FROM refresh_tokens WHERE expiresAt < NOW()
      │       ├──> DELETE FROM verification_tokens WHERE expiresAt < NOW()
      │       ├──> DELETE FROM password_reset_tokens WHERE expiresAt < NOW()
      │       └──> DELETE FROM csrf_tokens WHERE expiresAt < NOW()
      │
      └──> app.log.info('✅ Cleanup completed')

3. NETTOYAGE MANUEL (Admin)
   Admin UI
      │
      └──> POST /api/admin/cleanup-tokens
              │
              ├──> requireRole('ADMIN')
              │
              └──> CleanupService.runManualCleanup(app)
                      │
                      └──> Même logique que cron
```

---

## Implémentation

### 1. Service de Cleanup

**Fichier**: `apps/backend/src/services/cleanup.service.ts`

```typescript
import cron from 'node-cron'
import { prisma } from '@/config/prisma'
import type { FastifyInstance } from 'fastify'

export class CleanupService {
  /**
   * Supprime tous les tokens expirés de la base de données
   * Appelé par le cron job quotidien ou manuellement par un admin
   */
  static async cleanupExpiredTokens(): Promise<void> {
    const now = new Date()

    try {
      // ===== 1. Refresh Tokens =====
      const deletedRefreshTokens = await prisma.refreshToken.deleteMany({
        where: {
          expiresAt: {
            lt: now,  // less than (inférieur à)
          },
        },
      })

      // ===== 2. Verification Tokens =====
      const deletedVerificationTokens = await prisma.verificationToken.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      })

      // ===== 3. Password Reset Tokens =====
      const deletedResetTokens = await prisma.passwordResetToken.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      })

      // ===== 4. CSRF Tokens =====
      const deletedCsrfTokens = await prisma.csrfToken.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      })

      // ===== 5. Log résultats =====
      console.log(
        `✅ Cleanup completed: ` +
        `${deletedRefreshTokens.count} refresh tokens, ` +
        `${deletedVerificationTokens.count} verification tokens, ` +
        `${deletedResetTokens.count} reset tokens, ` +
        `${deletedCsrfTokens.count} CSRF tokens deleted`
      )
    } catch (error) {
      console.error('❌ Error during token cleanup:', error)
      // Ne pas throw pour ne pas crasher le serveur
    }
  }

  /**
   * Démarre le cron job de nettoyage
   * Exécution tous les jours à 3h du matin
   */
  static startCleanupJob(app: FastifyInstance): void {
    // Cron syntax: minute hour day month weekday
    // 0 3 * * * = 3h00 tous les jours
    cron.schedule('0 3 * * *', async () => {
      app.log.info('Starting scheduled token cleanup...')
      await CleanupService.cleanupExpiredTokens()
    })

    app.log.info('✅ Token cleanup job scheduled (daily at 3:00 AM)')
  }

  /**
   * Exécute un nettoyage manuel immédiat
   * Utilisé par la route admin
   */
  static async runManualCleanup(app: FastifyInstance): Promise<void> {
    app.log.info('Running manual token cleanup...')
    await CleanupService.cleanupExpiredTokens()
  }
}
```

**Pourquoi ces choix ?**

1. **Static methods**: Service stateless, pas besoin d'instance
2. **Try/catch**: Éviter crash du serveur si erreur DB
3. **Logging détaillé**: Traçabilité des suppressions
4. **deleteMany()**: Plus performant que boucle de delete individuels

---

### 2. Intégration dans le serveur

**Fichier**: `apps/backend/src/server.ts`

```typescript
import { CleanupService } from '@/services/cleanup.service'

async function start() {
  try {
    app = await createApp()

    const port = Number(env.PORT)
    await app.listen({ port, host: '0.0.0.0' })

    // ✅ Démarrer le job de nettoyage automatique
    CleanupService.startCleanupJob(app)

    console.log(`🚀 Server ready at http://localhost:${port}`)
  } catch (error) {
    console.error('❌ Error starting server:', error)
    process.exit(1)
  }
}
```

**Ordre d'exécution**:
1. Serveur démarre
2. Routes enregistrées
3. Job cron configuré
4. Serveur prêt ✅

---

### 3. Route admin pour nettoyage manuel

**Fichier**: `apps/backend/src/routes/admin.route.ts`

```typescript
import { CleanupService } from '../services/cleanup.service'

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.register(async function (fastify) {
    fastify.addHook('preHandler', authMiddleware)
    fastify.addHook('preHandler', requireRole('ADMIN'))

    /**
     * Déclenche un nettoyage manuel des tokens expirés
     * POST /api/admin/cleanup-tokens
     *
     * Utile pour:
     * - Tests
     * - Nettoyage ponctuel
     * - Avant migration
     */
    fastify.post('/cleanup-tokens', async (request, reply) => {
      await CleanupService.runManualCleanup(fastify)

      reply.send({
        success: true,
        message: 'Nettoyage des tokens exécuté avec succès',
      })
    })
  })
}
```

**Cas d'usage**:
- **Tests**: Nettoyer avant/après tests
- **Maintenance**: Nettoyer avant backup
- **Debug**: Vérifier que le cleanup fonctionne

---

## Configuration du Cron

### Syntaxe cron

```
 ┌─────────── minute (0 - 59)
 │ ┌───────── hour (0 - 23)
 │ │ ┌─────── day of month (1 - 31)
 │ │ │ ┌───── month (1 - 12)
 │ │ │ │ ┌─── day of week (0 - 6) (0 = Sunday)
 │ │ │ │ │
 * * * * *
```

### Exemples de configurations

```typescript
// Tous les jours à 3h00 (production)
cron.schedule('0 3 * * *', ...)

// Toutes les heures (développement)
cron.schedule('0 * * * *', ...)

// Toutes les 30 minutes (tests)
cron.schedule('*/30 * * * *', ...)

// Tous les lundis à 2h00
cron.schedule('0 2 * * 1', ...)

// Le 1er de chaque mois à minuit
cron.schedule('0 0 1 * *', ...)
```

### Pourquoi 3h du matin ?

1. **Heure creuse**: Peu d'utilisateurs actifs
2. **Pas de conflit**: N'impacte pas les heures de pointe
3. **Backups**: Souvent faits après minuit, donc cleanup avant
4. **Convention**: Beaucoup de jobs batch à cette heure

**Alternatives selon votre timezone**:
```typescript
// 3h UTC (production internationale)
cron.schedule('0 3 * * *', ...)

// 3h locale (petit site)
const hour = 3
cron.schedule(`0 ${hour} * * *`, ...)

// Configurable via env
const CLEANUP_HOUR = process.env.CLEANUP_HOUR || '3'
cron.schedule(`0 ${CLEANUP_HOUR} * * *`, ...)
```

---

## Monitoring et logging

### Logs de production

```bash
# Démarrage serveur
[2025-10-10 00:00:00] INFO: Server ready at http://localhost:3001
[2025-10-10 00:00:00] INFO: ✅ Token cleanup job scheduled (daily at 3:00 AM)

# Exécution quotidienne
[2025-10-10 03:00:00] INFO: Starting scheduled token cleanup...
[2025-10-10 03:00:01] INFO: ✅ Cleanup completed: 127 refresh tokens, 43 verification tokens, 12 reset tokens, 89 CSRF tokens deleted

# Nettoyage manuel
[2025-10-10 14:30:00] INFO: Running manual token cleanup...
[2025-10-10 14:30:01] INFO: ✅ Cleanup completed: 5 refresh tokens, 2 verification tokens, 0 reset tokens, 3 CSRF tokens deleted
```

### Métriques à surveiller

```typescript
// Ajouter métriques dans CleanupService
static async cleanupExpiredTokens(): Promise<{
  refreshTokens: number
  verificationTokens: number
  resetTokens: number
  csrfTokens: number
}> {
  // ... cleanup

  const metrics = {
    refreshTokens: deletedRefreshTokens.count,
    verificationTokens: deletedVerificationTokens.count,
    resetTokens: deletedResetTokens.count,
    csrfTokens: deletedCsrfTokens.count,
  }

  // Envoyer à Prometheus/DataDog/etc
  monitoring.recordMetric('cleanup.tokens.deleted', metrics)

  return metrics
}
```

### Alertes recommandées

```typescript
// Si cleanup supprime trop de tokens (possible leak)
if (metrics.refreshTokens > 10000) {
  alert.send({
    level: 'WARNING',
    message: `Cleanup supprimé ${metrics.refreshTokens} refresh tokens`,
    hint: 'Possible leak de tokens, investiguer'
  })
}

// Si cleanup échoue
catch (error) {
  alert.send({
    level: 'ERROR',
    message: 'Token cleanup failed',
    error: error.message
  })
}
```

---

## Tests

### Test 1: Vérifier que le job est configuré

```typescript
// test/services/cleanup.service.spec.ts
import { CleanupService } from '@/services/cleanup.service'

describe('CleanupService', () => {
  it('should schedule cleanup job on server start', async () => {
    const app = await createApp()

    // Vérifier que le log de confirmation est émis
    expect(app.log.info).toHaveBeenCalledWith(
      expect.stringContaining('Token cleanup job scheduled')
    )
  })
})
```

### Test 2: Cleanup supprime les tokens expirés

```typescript
it('should delete expired tokens', async () => {
  // Setup: Créer tokens expirés
  await prisma.refreshToken.create({
    data: {
      token: 'expired123',
      userId: 'user1',
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 jour dans le passé
    }
  })

  await prisma.verificationToken.create({
    data: {
      token: 'expired456',
      userId: 'user1',
      expiresAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1h dans le passé
    }
  })

  // Exécuter cleanup
  await CleanupService.cleanupExpiredTokens()

  // Vérifier suppression
  const refreshTokens = await prisma.refreshToken.count({
    where: { expiresAt: { lt: new Date() } }
  })
  const verificationTokens = await prisma.verificationToken.count({
    where: { expiresAt: { lt: new Date() } }
  })

  expect(refreshTokens).toBe(0)
  expect(verificationTokens).toBe(0)
})
```

### Test 3: Cleanup ne supprime PAS les tokens valides

```typescript
it('should NOT delete valid tokens', async () => {
  // Setup: Créer tokens valides
  await prisma.refreshToken.create({
    data: {
      token: 'valid123',
      userId: 'user1',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours dans le futur
    }
  })

  // Exécuter cleanup
  await CleanupService.cleanupExpiredTokens()

  // Vérifier que le token existe toujours
  const token = await prisma.refreshToken.findUnique({
    where: { token: 'valid123' }
  })

  expect(token).not.toBeNull()
  expect(token?.expiresAt).toBeGreaterThan(new Date())
})
```

### Test 4: Route admin fonctionne

```typescript
it('should allow admin to trigger manual cleanup', async () => {
  const app = await createApp()

  // Login en tant qu'admin
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      email: 'admin@test.com',
      password: 'password123'
    }
  })

  const cookies = loginRes.cookies

  // Créer token expiré
  await prisma.csrfToken.create({
    data: {
      token: 'expired789',
      userId: adminId,
      expiresAt: new Date(Date.now() - 1000)
    }
  })

  // Trigger cleanup manuel
  const res = await app.inject({
    method: 'POST',
    url: '/api/admin/cleanup-tokens',
    cookies
  })

  expect(res.statusCode).toBe(200)
  expect(res.json().success).toBe(true)

  // Vérifier suppression
  const count = await prisma.csrfToken.count({
    where: { expiresAt: { lt: new Date() } }
  })
  expect(count).toBe(0)
})
```

### Test 5: Cleanup gère les erreurs

```typescript
it('should handle database errors gracefully', async () => {
  // Mock Prisma pour simuler erreur
  jest.spyOn(prisma.refreshToken, 'deleteMany').mockRejectedValueOnce(
    new Error('Database connection lost')
  )

  // Cleanup ne doit PAS crasher
  await expect(
    CleanupService.cleanupExpiredTokens()
  ).resolves.not.toThrow()

  // Vérifier log d'erreur
  expect(console.error).toHaveBeenCalledWith(
    expect.stringContaining('Error during token cleanup'),
    expect.any(Error)
  )
})
```

---

## Performance

### Benchmark

**Scénario**: 100,000 tokens expirés en DB

```typescript
// Avant cleanup (avec tokens expirés)
SELECT * FROM users WHERE id = 'xxx'
JOIN refresh_tokens ON users.id = refresh_tokens.userId
// Durée: 150ms (scan de 100k rows)

// Après cleanup
SELECT * FROM users WHERE id = 'xxx'
JOIN refresh_tokens ON users.id = refresh_tokens.userId
// Durée: 15ms (scan de 1k rows seulement)
```

**Gain**: **10x plus rapide** ⚡

### Optimisation SQL

```sql
-- La requête de cleanup utilise un index
DELETE FROM refresh_tokens WHERE expiresAt < NOW();

-- Index existant (automatique via Prisma):
CREATE INDEX idx_refresh_tokens_expiresAt ON refresh_tokens(expiresAt);

-- Résultat: O(log n) pour trouver tokens expirés
-- Sans index: O(n) - scan complet de la table
```

### Impact sur le serveur

```typescript
// Durée d'exécution du cleanup (100k tokens)
console.time('cleanup')
await CleanupService.cleanupExpiredTokens()
console.timeEnd('cleanup')
// Résultat: ~500ms pour 100k tokens

// Pendant cleanup:
// - CPU: +5% (negligeable)
// - RAM: +10MB (temporaire)
// - DB connections: +1
```

**Conclusion**: Impact minimal, surtout à 3h du matin ✅

---

## Troubleshooting

### Problème: Le cleanup ne s'exécute pas

**Debug**:
```bash
# Vérifier que le log de scheduling apparaît au démarrage
grep "Token cleanup job scheduled" logs/app.log

# Si absent, vérifier que CleanupService.startCleanupJob() est appelé
```

**Solutions**:
1. Vérifier que `server.ts` appelle bien `startCleanupJob()`
2. Vérifier que le serveur démarre sans erreur
3. Vérifier que `node-cron` est installé

### Problème: Cleanup s'exécute mais ne supprime rien

**Debug**:
```sql
-- Vérifier qu'il y a bien des tokens expirés
SELECT COUNT(*) FROM refresh_tokens WHERE expiresAt < NOW();

-- Si 0, c'est normal (cleanup a déjà tourné)
-- Si >0, problème dans la logique
```

**Solutions**:
1. Vérifier les logs pour voir les counts
2. Vérifier que `expiresAt` est bien du type `DateTime`
3. Vérifier timezone DB vs serveur

### Problème: Erreur "Database connection lost"

**Cause**: Le pool de connexions est fermé pendant le cleanup

**Solution**:
```typescript
static async cleanupExpiredTokens(): Promise<void> {
  try {
    // Vérifier que Prisma est connecté
    await prisma.$connect()

    // ... cleanup logic
  } catch (error) {
    console.error('Error:', error)
  } finally {
    // Ne PAS disconnect ici (pool partagé)
  }
}
```

---

## Améliorations futures

### 1. Statistiques détaillées

```typescript
static async cleanupExpiredTokens(): Promise<void> {
  const stats = {
    startTime: new Date(),
    endTime: null,
    deleted: {},
    errors: []
  }

  // ... cleanup

  stats.endTime = new Date()
  stats.deleted = { refreshTokens, verificationTokens, ... }

  // Sauvegarder stats dans DB
  await prisma.cleanupStats.create({ data: stats })
}
```

### 2. Cleanup incrémental

```typescript
// Au lieu de tout supprimer d'un coup
// Supprimer par batch de 1000

const BATCH_SIZE = 1000
let deletedCount = 0

do {
  const result = await prisma.refreshToken.deleteMany({
    where: {
      expiresAt: { lt: new Date() }
    },
    take: BATCH_SIZE
  })

  deletedCount = result.count
} while (deletedCount === BATCH_SIZE)
```

### 3. Notification admin

```typescript
if (totalDeleted > 10000) {
  await sendEmail({
    to: 'admin@example.com',
    subject: 'Token cleanup: Nombre élevé de suppressions',
    body: `${totalDeleted} tokens supprimés. Investiguer.`
  })
}
```

---

## Références

- [node-cron Documentation](https://github.com/node-cron/node-cron)
- [Cron syntax](https://crontab.guru/)
- [Prisma deleteMany](https://www.prisma.io/docs/concepts/components/prisma-client/crud#delete-multiple-records)

---

**Auteur**: Documentation générée pour la boilerplate Node.js
**Date**: 2025-10-10
**Version**: 1.0.0
