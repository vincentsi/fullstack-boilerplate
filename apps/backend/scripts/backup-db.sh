#!/bin/bash

###############################################################################
# Database Backup Script
#
# This script creates automated backups of your PostgreSQL database
# with rotation (keeps only last N backups)
#
# Usage:
#   ./scripts/backup-db.sh
#
# Environment variables required:
#   DATABASE_URL - PostgreSQL connection string
#   BACKUP_RETENTION_DAYS - Number of days to keep backups (default: 7)
###############################################################################

set -e  # Exit on error

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Configuration
BACKUP_DIR="./backups"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql"
COMPRESSED_FILE="${BACKUP_FILE}.gz"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Extract database credentials from DATABASE_URL
# Format: postgresql://user:password@host:port/database
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ ERROR: DATABASE_URL not found in environment${NC}"
  echo "Please set DATABASE_URL in .env file"
  exit 1
fi

# Parse DATABASE_URL
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo -e "${GREEN}🗄️  Starting database backup...${NC}"
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "Backup file: $COMPRESSED_FILE"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Export password for pg_dump (avoid password prompt)
export PGPASSWORD="$DB_PASSWORD"

# Create backup
echo -e "${YELLOW}📦 Creating backup...${NC}"
pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --format=plain \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  > "$BACKUP_FILE"

# Check if backup was successful
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Backup created successfully${NC}"
else
  echo -e "${RED}❌ Backup failed${NC}"
  rm -f "$BACKUP_FILE"
  exit 1
fi

# Compress backup
echo -e "${YELLOW}🗜️  Compressing backup...${NC}"
gzip "$BACKUP_FILE"

# Get file size
FILE_SIZE=$(du -h "$COMPRESSED_FILE" | cut -f1)
echo -e "${GREEN}✅ Compressed backup: $FILE_SIZE${NC}"

# Cleanup old backups
echo -e "${YELLOW}🧹 Cleaning up old backups (keeping last $RETENTION_DAYS days)...${NC}"
find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

# Count remaining backups
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f | wc -l)
echo -e "${GREEN}✅ Total backups: $BACKUP_COUNT${NC}"

# List recent backups
echo ""
echo -e "${GREEN}📋 Recent backups:${NC}"
ls -lh "$BACKUP_DIR"/backup_*.sql.gz | tail -5

# Unset password
unset PGPASSWORD

echo ""
echo -e "${GREEN}✅ Backup completed successfully!${NC}"
echo "Backup location: $COMPRESSED_FILE"
