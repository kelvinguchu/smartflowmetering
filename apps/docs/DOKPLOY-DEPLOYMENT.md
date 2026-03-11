# Smart Flow Metering Dokploy Deployment Guide

## Overview

This guide covers deploying Smart Flow Metering to a VPS using Dokploy - a self-hosted PaaS for Docker deployments.

## Prerequisites

1. **VPS Requirements**
   - Ubuntu 22.04+ or Debian 12+
   - Minimum 2GB RAM, 2 vCPU, 40GB SSD
   - Recommended: 4GB RAM, 2 vCPU, 80GB SSD (for 100k transactions/day)

2. **Domain Setup**
   - Point these DNS records to your VPS IP:
     - `smartmetering.africa` â†’ A record â†’ `YOUR_VPS_IP`
     - `api.smartmetering.africa` â†’ A record â†’ `YOUR_VPS_IP`
     - `db.smartmetering.africa` â†’ A record â†’ `YOUR_VPS_IP` (optional, for Adminer)

3. **Dokploy Installed**
   ```bash
   curl -sSL https://dokploy.com/install.sh | sh
   ```

## Deployment Steps

### Step 1: Create Project in Dokploy

1. Open Dokploy dashboard (default: `https://YOUR_VPS_IP:3000`)
2. Click **"Create Project"**
3. Name it: `Smart Flow Metering`

### Step 2: Add Docker Compose Service

1. In your project, click **"Add Service"** â†’ **"Docker Compose"**
2. **Source**: Choose "Git Repository"
3. **Repository URL**: `https://github.com/your-org/smartflowmetering.git`
4. **Branch**: `main`
5. **Compose File Path**: `docker-compose.dokploy.yml`

### Step 3: Configure Environment Variables

In Dokploy's Environment Variables section, add:

```env
# Required - Database
POSTGRES_PASSWORD=your_super_secure_password_here
POSTGRES_DB=smartflowmetering

# Required - Authentication
BETTER_AUTH_SECRET=generate_a_64_char_random_string

# Required - M-Pesa Integration
MPESA_SHORTCODE=your_paybill_number
MPESA_CONSUMER_KEY=your_daraja_consumer_key
MPESA_CONSUMER_SECRET=your_daraja_consumer_secret
MPESA_PASSKEY=your_mpesa_passkey

# Required - Domains (for Traefik SSL)
WEB_DOMAIN=smartmetering.africa
API_DOMAIN=api.smartmetering.africa
ADMINER_DOMAIN=db.smartmetering.africa

# Required - Frontend API URL
VITE_API_URL=https://api.smartmetering.africa

# Optional - Adminer Basic Auth (generate with: htpasswd -nb admin password)
ADMINER_AUTH=admin:$$apr1$$xxxxx$$yyyyy
```

**Generate secure passwords:**

```bash
# POSTGRES_PASSWORD (32 characters)
openssl rand -base64 32

# BETTER_AUTH_SECRET (64 characters)
openssl rand -base64 48

# ADMINER_AUTH (basic auth hash)
htpasswd -nb admin your_secure_password
# Note: In the .env, replace $ with $$ for escaping
```

### Step 4: Configure Domains (via Dokploy UI)

For each service that needs a domain:

1. Go to your Docker Compose service
2. Click on the service (web, api, adminer)
3. Go to **"Domains"** tab
4. Add domain and enable HTTPS

**Alternative: Manual Traefik Labels**

The `docker-compose.dokploy.yml` already includes Traefik labels. Just ensure your `WEB_DOMAIN`, `API_DOMAIN`, and `ADMINER_DOMAIN` environment variables are set.

### Step 5: Deploy

1. Click **"Deploy"** in Dokploy
2. Monitor the build logs
3. Wait for all health checks to pass (green status)

## Post-Deployment

### Verify Services

```bash
# Check all containers are running
docker ps | grep smartflowmetering

# Check API health
curl https://api.smartmetering.africa/api/health

# Check web frontend
curl https://smartmetering.africa
```

### Run Database Migrations

```bash
# SSH into VPS, then:
docker exec smartflowmetering-api npm run db:push
```

### Trigger Initial Backup

```bash
docker exec smartflowmetering-backup /backup.sh
```

### Verify Backups

```bash
# List backups
docker exec smartflowmetering-backup ls -la /backups/

# Check backup logs
docker logs smartflowmetering-backup
```

## Monitoring & Logs

### View Logs in Dokploy

1. Go to your Docker Compose service
2. Click on individual service (api, web, postgres, etc.)
3. Click **"Logs"** tab

### View Logs via CLI

```bash
# API logs
docker logs -f smartflowmetering-api

# Postgres logs
docker logs -f smartflowmetering-postgres

# All services
docker compose -f docker-compose.dokploy.yml logs -f
```

## Backup Management

### Access Backups

Backups are stored in the `smartflowmetering_backup_data` Docker volume.

```bash
# List backups
docker run --rm -v smartflowmetering_backup_data:/backups alpine ls -la /backups/

# Copy backup to host
docker cp smartflowmetering-backup:/backups/hourly/latest.sql.gz ./

# Copy to external storage (example: S3)
aws s3 cp ./latest.sql.gz s3://your-bucket/smartflowmetering-backups/
```

### Restore from Backup

```bash
# 1. Stop API
docker stop smartflowmetering-api

# 2. Copy backup from volume
docker cp smartflowmetering-backup:/backups/hourly/latest.sql.gz ./

# 3. Restore
gunzip -c latest.sql.gz | docker exec -i smartflowmetering-postgres psql -U postgres -d smartflowmetering

# 4. Restart API
docker start smartflowmetering-api
```

## Updating the Application

### Via Dokploy UI

1. Push changes to your Git repository
2. In Dokploy, click **"Redeploy"**
3. Dokploy will pull, build, and deploy with zero downtime

### Via Webhook (Auto-Deploy)

1. In Dokploy, go to your service â†’ **"Deployments"**
2. Copy the **Webhook URL**
3. Add it to your GitHub/GitLab repository settings

## Security Checklist

- [ ] Strong `POSTGRES_PASSWORD` (32+ characters)
- [ ] Strong `BETTER_AUTH_SECRET` (64+ characters)
- [ ] HTTPS enabled on all public endpoints
- [ ] Adminer protected with basic auth or removed
- [ ] M-Pesa credentials secured in Dokploy environment
- [ ] Rate limiting enabled in API
- [ ] Backups running and verified
- [ ] Firewall configured (only ports 80, 443 open)

## Troubleshooting

### Container Won't Start

```bash
# Check container logs
docker logs smartflowmetering-api

# Check health status
docker inspect smartflowmetering-api | grep -A 10 "Health"
```

### Database Connection Issues

```bash
# Verify postgres is healthy
docker exec smartflowmetering-postgres pg_isready -U postgres

# Test connection from API container
docker exec smartflowmetering-api nc -zv postgres 5432
```

### SSL Certificate Issues

```bash
# Check Traefik logs
docker logs traefik

# Verify domain DNS
dig smartmetering.africa
dig api.smartmetering.africa
```

### dokploy-network Not Found

If you see "network dokploy-network not found":

```bash
# The network should exist if Dokploy is installed. Verify:
docker network ls | grep dokploy

# If missing, Dokploy may not be properly initialized
```

## Performance Tuning

### For 100k transactions/day:

1. **Increase PostgreSQL connections**
   Add to postgres environment:

   ```yaml
   POSTGRES_INITDB_ARGS: "--data-checksums"
   command:
     - postgres
     - -c
     - max_connections=200
     - -c
     - shared_buffers=256MB
   ```

2. **Add Redis memory limit**

   ```yaml
   command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
   ```

3. **Scale API horizontally** (future)
   Consider running multiple API replicas behind Traefik load balancer.
