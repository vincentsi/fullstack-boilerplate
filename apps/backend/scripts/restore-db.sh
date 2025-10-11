#!/bin/bash

###############################################################################
# Database Restore Script
#
# This script restores a PostgreSQL database from a backup file
#
# Usage:
#   ./scripts/restore-db.sh <backup_file>
#
# Example:
#   ./scripts/restore-db.sh ./backups/backup_20250110_143000.sql.gz
###############################################################################

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if backup file is provided
if [ -z "$1" ]; then
  echo -e "${RED}❌ ERROR: No backup file specified${NC}"
  echo ""
  echo "Usage: ./scripts/restore-db.sh <backup_file>"
  echo ""
  echo "Available backups:"
  ls -lh ./backups/backup_*.sql.gz 2>/dev/null || echo "No backups found"
  exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo -e "${RED}❌ ERROR: Backup file not found: $BACKUP_FILE${NC}"
  exit 1
fi

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Extract database credentials from DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ ERROR: DATABASE_URL not found in environment${NC}"
  exit 1
fi

# Parse DATABASE_URL
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo -e "${YELLOW}⚠️  WARNING: This will restore the database and OVERWRITE existing data!${NC}"
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "Backup file: $BACKUP_FILE"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo -e "${YELLOW}❌ Restore cancelled${NC}"
  exit 0
fi

# Export password for psql
export PGPASSWORD="$DB_PASSWORD"

# Decompress if needed
TEMP_FILE="/tmp/restore_temp.sql"
if [[ "$BACKUP_FILE" == *.gz ]]; then
  echo -e "${YELLOW}📦 Decompressing backup...${NC}"
  gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
else
  TEMP_FILE="$BACKUP_FILE"
fi

# Restore database
echo -e "${YELLOW}🔄 Restoring database...${NC}"
psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  < "$TEMP_FILE"

# Check if restore was successful
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Database restored successfully!${NC}"
else
  echo -e "${RED}❌ Restore failed${NC}"
  exit 1
fi

# Cleanup temp file if it was created
if [[ "$BACKUP_FILE" == *.gz ]]; then
  rm -f "$TEMP_FILE"
fi

# Unset password
unset PGPASSWORD

echo ""
echo -e "${GREEN}✅ Restore completed successfully!${NC}"
