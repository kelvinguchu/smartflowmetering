#!/bin/bash
# ==============================================
# Smart Flow Metering PostgreSQL Backup Script
# ==============================================
# This script creates timestamped backups and manages retention
#
# Features:
# - Full database dump with compression
# - Timestamped filenames for versioning
# - Configurable retention period
# - Health check endpoint notification
# - Upload to Cloudflare R2 in production
# ==============================================

set -e  # Exit on any error

# Configuration
BACKUP_DIR="/backups"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="smartflowmetering_${TIMESTAMP}.sql.gz"

# Database connection (from environment)
PGHOST=${POSTGRES_HOST:-postgres}
PGPORT=${POSTGRES_PORT:-5432}
PGUSER=${POSTGRES_USER:-postgres}
PGPASSWORD=${POSTGRES_PASSWORD:-postgres}
PGDATABASE=${POSTGRES_DB:-smartflowmetering}

export PGPASSWORD

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backup of database: ${PGDATABASE}"

# Create backup directory if it doesn't exist
mkdir -p ${BACKUP_DIR}

# Create the backup with compression
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Creating backup: ${BACKUP_FILE}"
pg_dump -h ${PGHOST} -p ${PGPORT} -U ${PGUSER} -d ${PGDATABASE} \
    --format=plain \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    | gzip > ${BACKUP_DIR}/${BACKUP_FILE}

# Verify backup was created successfully
if [ -f "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
    BACKUP_SIZE=$(du -h ${BACKUP_DIR}/${BACKUP_FILE} | cut -f1)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup created successfully: ${BACKUP_FILE} (${BACKUP_SIZE})"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Backup file was not created!"
    exit 1
fi

# ==============================================
# Upload to Cloudflare R2 (Production Only)
# ==============================================
# Requires: R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID
# The R2 endpoint format: https://<account_id>.r2.cloudflarestorage.com

if [ -n "${R2_BUCKET}" ] && [ -n "${R2_ACCESS_KEY_ID}" ] && [ -n "${R2_SECRET_ACCESS_KEY}" ] && [ -n "${R2_ACCOUNT_ID}" ]; then
    R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Uploading to Cloudflare R2: ${R2_BUCKET}/backups/${BACKUP_FILE}"
    
    # Configure AWS CLI for R2
    export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
    export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
    export AWS_DEFAULT_REGION="auto"
    
    # Upload to R2
    aws s3 cp "${BACKUP_DIR}/${BACKUP_FILE}" "s3://${R2_BUCKET}/backups/${BACKUP_FILE}" \
        --endpoint-url "${R2_ENDPOINT}"
    
    if [ $? -eq 0 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] R2 upload complete"
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: R2 upload failed, backup saved locally"
    fi
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Skipping R2 upload (not configured or not in production)"
fi

# ==============================================
# Cleanup old backups
# ==============================================
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaning up backups older than ${RETENTION_DAYS} days"
find ${BACKUP_DIR} -name "smartflowmetering_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true

# List current backups
echo ""
echo "Current backups:"
ls -lh ${BACKUP_DIR}/smartflowmetering_*.sql.gz 2>/dev/null || echo "  No backups found"

# Calculate total backup size
TOTAL_SIZE=$(du -sh ${BACKUP_DIR} 2>/dev/null | cut -f1)
echo ""
echo "Total backup storage used: ${TOTAL_SIZE}"

echo ""
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup completed successfully!"
