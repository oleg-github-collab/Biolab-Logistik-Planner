# Railway Deployment Guide - Biolab Logistik Planner

## 🚀 Complete Setup Guide

### Prerequisites
- Railway account (https://railway.app)
- GitHub account with repository access
- Railway CLI (optional but recommended)

---

## Step 1: Create Railway Project

1. Go to https://railway.app and login
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose `Biolab-Logistik-Planner` repository
5. Railway will auto-detect the Node.js app

---

## Step 2: Add PostgreSQL Database

1. In your Railway project, click "+ New"
2. Select "Database" → "Add PostgreSQL"
3. Railway will automatically create a PostgreSQL database
4. Copy the connection string (you'll need it later)

**Automatic Environment Variables Created:**
- `DATABASE_URL` - Full PostgreSQL connection string
- `POSTGRES_URL` - Alternative format
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` - Individual components

---

## Step 3: Add Redis

1. In your Railway project, click "+ New"
2. Select "Database" → "Add Redis"
3. Railway will automatically create a Redis instance

**Automatic Environment Variables Created:**
- `REDIS_URL` - Redis connection string
- `REDIS_PRIVATE_URL` - Private network URL

---

## Step 4: Add Volume for File Uploads

1. Click on your main service (Node.js app)
2. Go to "Settings" → "Volumes"
3. Click "+ New Volume"
4. Set:
   - **Mount Path**: `/app/uploads`
   - **Size**: 5GB (or as needed)

This ensures uploaded files persist across deployments.

---

## Step 5: Configure Environment Variables

Click on your service → "Variables" tab → Add the following:

### Required Variables

```env
# Node Environment
NODE_ENV=production
PORT=5000

# JWT Secret (generate a strong random string)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars-long

# PostgreSQL (auto-filled by Railway, but verify)
DATABASE_URL=${{Postgres.DATABASE_URL}}
POSTGRES_URL=${{Postgres.POSTGRES_URL}}

# Redis (auto-filled by Railway)
REDIS_URL=${{Redis.REDIS_URL}}
REDIS_HOST=${{Redis.REDIS_PRIVATE_URL}}

# File Upload Configuration
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=52428800

# CORS (your frontend domain)
CLIENT_URL=https://your-frontend-domain.railway.app
CORS_ORIGIN=https://your-frontend-domain.railway.app

# Session Settings
SESSION_SECRET=another-super-secret-key-for-sessions
SESSION_TTL=604800

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=/app/logs

# Optional: External Services
# CLOUDINARY_CLOUD_NAME=your-cloud-name
# CLOUDINARY_API_KEY=your-api-key
# CLOUDINARY_API_SECRET=your-api-secret

# Optional: Email Notifications
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password
```

### Using Railway's Variable Reference

Railway allows you to reference other services' variables:
- `${{Postgres.DATABASE_URL}}` - References PostgreSQL URL
- `${{Redis.REDIS_URL}}` - References Redis URL
- `${{Railway.ENVIRONMENT}}` - Current environment
- `${{Railway.REGION}}` - Deployment region

---

## Step 6: Run Database Migrations

### Option A: Using Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run migrations
railway run node server/migrations/migrate.js
```

### Option B: Using Railway Dashboard

1. Go to your service → "Settings" → "Deployments"
2. Find the latest deployment
3. Click "View Logs"
4. You should see migration logs automatically running on startup

**OR** add a deploy hook to package.json:

```json
{
  "scripts": {
    "start": "node server/migrations/migrate.js && node server/index.js"
  }
}
```

---

## Step 7: Deploy!

### Automatic Deployment

Railway automatically deploys when you push to your GitHub repository's main branch.

```bash
git add .
git commit -m "feat: Production-ready deployment"
git push origin main
```

### Manual Deployment

In Railway Dashboard:
1. Go to your service
2. Click "Deploy" → "Redeploy"

---

## Step 8: Verify Deployment

### Check Service Health

Visit your deployment URL + `/health`:
```
https://your-app.railway.app/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "2025-10-25T...",
  "uptime": 123.45,
  "services": {
    "database": "connected",
    "redis": "connected",
    "fileSystem": "ok"
  }
}
```

### Check Logs

1. Go to your service
2. Click "Logs" tab
3. Look for:
   - ✅ "PostgreSQL clients connected successfully"
   - ✅ "Redis clients connected successfully"
   - ✅ "Server running on port 5000"

---

## Step 9: Database Seeding (Optional)

If you want to add sample data:

```bash
railway run npm run seed
```

Or add seed data via SQL in Railway's PostgreSQL dashboard.

---

## Step 10: Custom Domain (Optional)

1. Go to your service → "Settings" → "Domains"
2. Click "Add Custom Domain"
3. Enter your domain (e.g., `biolab.yourdomain.com`)
4. Add the CNAME record to your DNS provider:
   - Name: `biolab`
   - Value: `your-app.railway.app`
5. Wait for DNS propagation (5-30 minutes)

---

## Environment-Specific Configuration

### Development
```env
NODE_ENV=development
LOG_LEVEL=debug
```

### Staging
```env
NODE_ENV=staging
LOG_LEVEL=info
```

### Production
```env
NODE_ENV=production
LOG_LEVEL=warn
```

---

## Monitoring & Maintenance

### View Metrics

Railway Dashboard → Service → "Metrics" tab shows:
- CPU usage
- Memory usage
- Network traffic
- Request rate

### View Logs

```bash
# Using Railway CLI
railway logs

# Or in dashboard
Service → "Logs" tab
```

### Database Backups

PostgreSQL backups are automatic on Railway:
- Point-in-time recovery available
- 7-day retention on free tier
- 30-day retention on pro tier

### Redis Persistence

Redis on Railway is configured with:
- AOF (Append Only File) enabled
- Automatic snapshots every 60 seconds

---

## Troubleshooting

### Issue: Database Connection Fails

**Solution:**
1. Check `DATABASE_URL` is set correctly
2. Verify PostgreSQL service is running
3. Check firewall rules (Railway handles this automatically)
4. Look for connection errors in logs

### Issue: Redis Connection Fails

**Solution:**
1. Check `REDIS_URL` is set correctly
2. Verify Redis service is running
3. Check if Redis password is required

### Issue: File Uploads Not Persisting

**Solution:**
1. Ensure Volume is mounted at `/app/uploads`
2. Check `UPLOAD_DIR` environment variable
3. Verify write permissions

### Issue: Out of Memory

**Solution:**
1. Upgrade to larger Railway plan
2. Optimize image processing (reduce Sharp quality)
3. Enable Redis cache for frequently accessed data
4. Implement pagination for large datasets

### Issue: Slow Performance

**Solution:**
1. Enable Redis caching
2. Add database indexes
3. Optimize queries (use EXPLAIN ANALYZE)
4. Enable connection pooling (already configured)
5. Use CDN for static assets

---

## Scaling

### Horizontal Scaling

Railway supports horizontal scaling on Pro plans:

1. Go to Service → "Settings" → "Scaling"
2. Increase "Replicas" count
3. Railway will load balance across instances

### Vertical Scaling

Upgrade your Railway plan for more resources:
- **Starter**: 512MB RAM, 0.5 vCPU
- **Pro**: Up to 32GB RAM, 32 vCPU

---

## Cost Optimization

### Free Tier Limits
- $5/month free credit
- All services count toward usage
- ≈ 500 hours of runtime/month

### Tips to Reduce Costs
1. Use shared PostgreSQL/Redis instead of dedicated
2. Implement aggressive caching
3. Optimize image sizes before upload
4. Clean up old logs and files
5. Use Railway's sleep mode for development

---

## Security Checklist

- ✅ Strong JWT_SECRET (min 32 characters)
- ✅ Different SESSION_SECRET
- ✅ HTTPS enabled (automatic on Railway)
- ✅ Environment variables secured
- ✅ CORS configured correctly
- ✅ Rate limiting enabled
- ✅ SQL injection protection (parameterized queries)
- ✅ File upload validation
- ✅ Helmet.js security headers
- ✅ Password hashing with bcrypt

---

## Backup Strategy

### PostgreSQL Backups

```bash
# Manual backup
railway run pg_dump $DATABASE_URL > backup.sql

# Restore from backup
railway run psql $DATABASE_URL < backup.sql
```

### File Uploads Backup

Since files are in a Volume:
1. Download files via SFTP (Railway provides access)
2. Or implement S3/Cloudinary for file storage
3. Set up automated backups to cloud storage

### Redis Backup

Redis data is volatile - important data should be in PostgreSQL.
For critical cache data:
1. Enable AOF persistence
2. Export data periodically

---

## Rollback Procedure

### Option 1: Redeploy Previous Version

1. Go to Service → "Deployments"
2. Find previous successful deployment
3. Click "..." → "Redeploy"

### Option 2: Git Rollback

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or reset to specific commit
git reset --hard <commit-hash>
git push origin main --force
```

---

## Performance Benchmarks

Expected performance on Railway Starter plan:

- **API Response Time**: < 100ms (cached)
- **API Response Time**: < 500ms (database query)
- **File Upload**: ~1MB/s
- **Concurrent Users**: 50-100
- **WebSocket Connections**: 100+

---

## Support & Resources

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- PostgreSQL Docs: https://www.postgresql.org/docs/
- Redis Docs: https://redis.io/docs/

---

## Next Steps After Deployment

1. ✅ Test all features in production
2. ✅ Set up monitoring alerts
3. ✅ Configure automated backups
4. ✅ Set up error tracking (e.g., Sentry)
5. ✅ Enable analytics (optional)
6. ✅ Create admin user
7. ✅ Add sample data for testing
8. ✅ Configure email notifications
9. ✅ Set up CI/CD pipeline
10. ✅ Document API endpoints

---

**🎉 Congratulations! Your Biolab Logistik Planner is now live!**

Access your app at: `https://your-app.railway.app`
