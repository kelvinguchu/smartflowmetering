#!/bin/bash
# ==============================================
# Smart Flow Metering PostgreSQL Restore Script
# ==============================================
# Usage: ./restore.sh <backup_file.sql.gz>
#
# Example: ./restore.sh smartflowmetering_20260103_120000.sql.gz
# ==============================================

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -lh ./backups/*.sql.gz 2>/dev/null || echo "  No backups found in ./backups/"
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "./backups/${BACKUP_FILE}" ] && [ ! -f "${BACKUP_FILE}" ]; then
    echo "ERROR: Backup file not found: ${BACKUP_FILE}"
    echo ""
    echo "Available backups:"
    ls -lh ./backups/*.sql.gz 2>/dev/null || echo "  No backups found"
    exit 1
fi

# Determine full path
if [ -f "./backups/${BACKUP_FILE}" ]; then
    FULL_PATH="./backups/${BACKUP_FILE}"
else
    FULL_PATH="${BACKUP_FILE}"
fi

echo "==================================="
echo "Smart Flow Metering Database Restore"
echo "==================================="
echo ""
echo "WARNING: This will REPLACE the current database with the backup!"
echo "Backup file: ${FULL_PATH}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo ""
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting restore..."

# Stop the API to prevent writes during restore
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Stopping API container..."
docker compose stop api 2>/dev/null || true

# Restore the backup
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restoring database from: ${FULL_PATH}"
gunzip -c "${FULL_PATH}" | docker compose exec -T postgres psql -U postgres -d smartflowmetering

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Database restored successfully!"

# Restart the API
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restarting API container..."
docker compose start api

echo ""
echo "==================================="
echo "Restore completed successfully!"
echo "==================================="
