# Smart Flow Metering Backup & Recovery Guide

## Overview

Smart Flow Metering uses automated PostgreSQL backups to ensure data safety for all financial transactions, meter data, and customer records.

## Backup Strategy

### Automated Backups

Backups are created automatically by the `smartflowmetering-backup` container using `prodrigestivill/postgres-backup-local`.

| Frequency   | Retention           | Location             |
| ----------- | ------------------- | -------------------- |
| **Hourly**  | 7 days (168 hours)  | `./backups/hourly/`  |
| **Daily**   | 4 weeks (28 days)   | `./backups/daily/`   |
| **Weekly**  | 6 months (24 weeks) | `./backups/weekly/`  |
| **Monthly** | 1 year (12 months)  | `./backups/monthly/` |

### Backup Contents

Each backup includes:

- All database tables (transactions, meters, customers, etc.)
- Compressed format (`.sql.gz`)
- Full schema with data
- Timestamped filenames

## Manual Backup

To create an immediate backup outside the schedule:

```bash
# Trigger a manual backup
docker compose exec backup /backup.sh
```

## Viewing Backups

```bash
# List all backups
ls -lah ./backups/

# List by category
ls -lah ./backups/hourly/
ls -lah ./backups/daily/
ls -lah ./backups/weekly/
ls -lah ./backups/monthly/

# Check backup container logs
docker compose logs backup
```

## Restoring from Backup

### Using the Restore Script

```bash
# List available backups
./scripts/restore-backup.sh

# Restore a specific backup
./scripts/restore-backup.sh smartflowmetering_20260103_120000.sql.gz
```

### Manual Restore

```bash
# 1. Stop the API to prevent writes
docker compose stop api

# 2. Restore the backup
gunzip -c ./backups/hourly/smartflowmetering_20260103_120000.sql.gz | \
  docker compose exec -T postgres psql -U postgres -d smartflowmetering

# 3. Restart the API
docker compose start api
```

## Off-Site Backup (Recommended for Production)

### Option 1: Cloudflare R2 (S3-compatible, cheap)

Add to your `.env`:

```env
R2_BUCKET=smartflowmetering-backups
R2_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID=your_r2_access_key
AWS_SECRET_ACCESS_KEY=your_r2_secret_key
```

Create a sync script (`scripts/sync-backups-r2.sh`):

```bash
#!/bin/bash
aws s3 sync ./backups s3://${R2_BUCKET}/backups \
  --endpoint-url ${R2_ENDPOINT}
```

### Option 2: AWS S3

Add to your `.env`:

```env
S3_BUCKET=smartflowmetering-backups
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_DEFAULT_REGION=eu-west-1
```

Sync command:

```bash
aws s3 sync ./backups s3://${S3_BUCKET}/backups
```

### Option 3: Rsync to Remote Server

```bash
rsync -avz --delete ./backups/ user@backup-server:/backups/smartflowmetering/
```

## Monitoring Backups

### Check Last Backup Time

```bash
# Show most recent backup
ls -lt ./backups/hourly/ | head -5
```

### Health Check Integration

For production, add health check monitoring (e.g., healthchecks.io):

1. Create a check at https://healthchecks.io
2. Add to `docker-compose.yml` under backup service:
   ```yaml
   environment:
     HEALTHCHECK_URL: https://hc-ping.com/your-uuid
   ```

This will ping the health check URL after each successful backup.

## Disaster Recovery Runbook

### Scenario: Complete Data Loss

1. **Provision new infrastructure**
2. **Clone repository and configure**

   ```bash
   git clone <repo>
   cp .env.example .env
   # Configure .env with production values
   ```

3. **Start base services (without API)**

   ```bash
   docker compose up -d postgres redis
   ```

4. **Wait for postgres to be healthy**

   ```bash
   docker compose ps
   ```

5. **Restore latest backup**

   ```bash
   # Download from remote storage if needed
   aws s3 cp s3://smartflowmetering-backups/backups/daily/latest.sql.gz ./backups/

   # Restore
   gunzip -c ./backups/latest.sql.gz | \
     docker compose exec -T postgres psql -U postgres -d smartflowmetering
   ```

6. **Start remaining services**

   ```bash
   docker compose up -d
   ```

7. **Verify**

   ```bash
   # Check API health
   curl http://localhost:3000/api/health

   # Check database
   docker compose exec postgres psql -U postgres -d smartflowmetering -c "SELECT COUNT(*) FROM transactions;"
   ```

## Best Practices

1. **Test restores regularly** - Don't assume backups work until you've tested restoring
2. **Monitor backup size** - Watch for unexpected growth or shrinkage
3. **Keep off-site copies** - Local backups won't help if the server is lost
4. **Encrypt sensitive backups** - For off-site storage with customer data
5. **Document recovery time** - Know how long a full restore takes
