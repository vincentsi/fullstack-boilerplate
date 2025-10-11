import cron from 'node-cron'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'
import type { FastifyInstance } from 'fastify'

const execAsync = promisify(exec)

/**
 * Backup Service
 *
 * Automated database backups with:
 * - Scheduled daily backups
 * - Automatic rotation (keeps last N days)
 * - Manual backup trigger
 * - Backup compression
 *
 * Architecture:
 * 1. Uses pg_dump for PostgreSQL backups
 * 2. Compresses backups with gzip
 * 3. Stores in ./backups directory
 * 4. Auto-deletes old backups based on retention policy
 */
export class BackupService {
  private static backupDir = path.join(process.cwd(), 'backups')
  private static retentionDays = Number(process.env.BACKUP_RETENTION_DAYS) || 7
  private static cronSchedule = process.env.BACKUP_CRON_SCHEDULE || '0 3 * * *' // 3 AM daily

  /**
   * Start automated backup job
   * Runs daily at 3 AM by default
   */
  static startBackupJob(fastify: FastifyInstance) {
    // Skip in development (uncomment to enable in dev)
    if (process.env.NODE_ENV === 'development') {
      fastify.log.info('⏭️  Backup job disabled in development')
      return
    }

    // Validate cron schedule
    if (!cron.validate(this.cronSchedule)) {
      fastify.log.error(`❌ Invalid backup cron schedule: ${this.cronSchedule}`)
      return
    }

    // Schedule backup job
    cron.schedule(this.cronSchedule, async () => {
      fastify.log.info('🔄 Starting scheduled database backup...')

      try {
        const backupPath = await this.createBackup()
        fastify.log.info(`✅ Scheduled backup completed: ${backupPath}`)
      } catch (error) {
        fastify.log.error('❌ Scheduled backup failed:', error)

        // Report to Sentry if available
        if (process.env.SENTRY_DSN) {
          const { captureException } = await import('@/config/sentry')
          captureException(error as Error, { context: 'scheduled-backup' })
        }
      }
    })

    fastify.log.info(
      `✅ Backup job scheduled: ${this.cronSchedule} (retention: ${this.retentionDays} days)`
    )
  }

  /**
   * Create a manual backup
   * Can be called from admin endpoint
   */
  static async createBackup(): Promise<string> {
    try {
      // Ensure backup directory exists
      await fs.mkdir(this.backupDir, { recursive: true })

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const filename = `backup_${timestamp}.sql`
      const filepath = path.join(this.backupDir, filename)
      const compressedPath = `${filepath}.gz`

      // Get DATABASE_URL
      const databaseUrl = process.env.DATABASE_URL
      if (!databaseUrl) {
        throw new Error('DATABASE_URL not configured')
      }

      // Parse database URL
      const dbConfig = this.parseDatabaseUrl(databaseUrl)

      // Create backup using pg_dump
      const dumpCommand = `pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} --format=plain --no-owner --no-acl --clean --if-exists > "${filepath}"`

      // Set password env var for pg_dump
      const env = { ...process.env, PGPASSWORD: dbConfig.password }

      await execAsync(dumpCommand, { env })

      // Compress backup
      await execAsync(`gzip "${filepath}"`)

      // Get file size
      const stats = await fs.stat(compressedPath)
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2)

      console.log(`✅ Backup created: ${compressedPath} (${sizeMB} MB)`)

      // Cleanup old backups
      await this.cleanupOldBackups()

      return compressedPath
    } catch (error) {
      console.error('❌ Backup failed:', error)
      throw error
    }
  }

  /**
   * List all available backups
   */
  static async listBackups(): Promise<
    Array<{
      filename: string
      path: string
      size: number
      sizeFormatted: string
      createdAt: Date
    }>
  > {
    try {
      await fs.mkdir(this.backupDir, { recursive: true })

      const files = await fs.readdir(this.backupDir)
      const backupFiles = files.filter((f) => f.startsWith('backup_') && f.endsWith('.sql.gz'))

      const backups = await Promise.all(
        backupFiles.map(async (filename) => {
          const filepath = path.join(this.backupDir, filename)
          const stats = await fs.stat(filepath)

          return {
            filename,
            path: filepath,
            size: stats.size,
            sizeFormatted: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
            createdAt: stats.birthtime,
          }
        })
      )

      // Sort by creation date (newest first)
      return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    } catch (error) {
      console.error('❌ Failed to list backups:', error)
      return []
    }
  }

  /**
   * Delete backups older than retention period
   */
  private static async cleanupOldBackups(): Promise<void> {
    try {
      const backups = await this.listBackups()
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays)

      let deletedCount = 0

      for (const backup of backups) {
        if (backup.createdAt < cutoffDate) {
          await fs.unlink(backup.path)
          console.log(`🗑️  Deleted old backup: ${backup.filename}`)
          deletedCount++
        }
      }

      if (deletedCount > 0) {
        console.log(`✅ Cleaned up ${deletedCount} old backup(s)`)
      }
    } catch (error) {
      console.error('❌ Failed to cleanup old backups:', error)
    }
  }

  /**
   * Parse PostgreSQL connection string
   * Format: postgresql://user:password@host:port/database
   */
  private static parseDatabaseUrl(url: string) {
    const regex = /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/
    const match = url.match(regex)

    if (!match) {
      throw new Error('Invalid DATABASE_URL format')
    }

    return {
      user: match[1],
      password: match[2],
      host: match[3],
      port: match[4],
      database: match[5],
    }
  }

  /**
   * Get backup statistics
   */
  static async getBackupStats() {
    const backups = await this.listBackups()

    const totalSize = backups.reduce((sum, b) => sum + b.size, 0)
    const totalSizeFormatted = `${(totalSize / (1024 * 1024)).toFixed(2)} MB`

    return {
      totalBackups: backups.length,
      totalSize,
      totalSizeFormatted,
      oldestBackup: backups[backups.length - 1]?.createdAt || null,
      newestBackup: backups[0]?.createdAt || null,
      retentionDays: this.retentionDays,
      schedule: this.cronSchedule,
    }
  }
}
