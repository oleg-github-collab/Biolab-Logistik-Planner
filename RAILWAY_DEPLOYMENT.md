# Railway Deployment Guide

## ✅ Changes Deployed

- PostgreSQL-only backend (SQLite removed)
- All database migrations fixed and tested locally
- Production React build created
- Automatic migration runner on startup

## Railway Configuration

### Database
Railway should have a PostgreSQL database attached with `DATABASE_URL` environment variable set automatically.

### Environment Variables Required
```
NODE_ENV=production
DATABASE_URL=<automatically set by Railway PostgreSQL plugin>
JWT_SECRET=<your secure JWT secret>
PORT=<automatically set by Railway>
```

### Deployment Process

1. **Push triggers automatic deployment:**
   ```bash
   git push
   ```

2. **Railway will:**
   - Run `npm install`
   - Build React app: `cd client && npm install && npm run build`
   - Run migrations: `npm run migrate:pg`
   - Start server: `node server/index.js`

3. **Migrations will create 41 tables:**
   - users, tasks, messages, notifications
   - task_pool, task_help_requests
   - message_reactions, message_mentions, message_quotes
   - kb_articles, waste_management, schedules
   - And 30 more supporting tables

## First-Time Setup on Railway

### 1. After Deployment Completes

Visit your Railway app URL:
```
https://your-app.railway.app/first-setup
```

### 2. Create Superadmin

Fill in the registration form:
- Name
- Email
- Password
- Confirm Password

This creates the first user with **superadmin** role.

### 3. Login

After creating superadmin, you'll be redirected to login:
```
https://your-app.railway.app/login
```

## Troubleshooting

### If migrations fail on Railway:

1. **Check Railway logs:**
   - Go to Railway dashboard
   - Click on your service
   - View deployment logs

2. **Manually run migrations:**
   ```bash
   # Get DATABASE_URL from Railway
   railway variables

   # Run migrations locally against Railway database
   DATABASE_URL=<railway_url> npm run migrate:pg
   ```

3. **Verify database connection:**
   ```bash
   railway run psql $DATABASE_URL -c "SELECT COUNT(*) FROM users"
   ```

### Common Issues:

**Issue:** "relation already exists" errors
**Solution:** Migrations are idempotent - they skip existing tables. This is normal.

**Issue:** First-setup returns 404
**Solution:** Make sure deployment finished and server started successfully.

**Issue:** 500 errors on first-setup
**Solution:**
- Check Railway logs for database connection errors
- Verify DATABASE_URL is set correctly
- Ensure migrations completed successfully

## Manual Migration (if needed)

If automatic migrations fail, run manually:

```bash
# Option 1: Via Railway CLI
railway run npm run migrate:pg

# Option 2: With DATABASE_URL
DATABASE_URL=postgresql://... npm run migrate:pg
```

## Verification

After deployment, verify:

1. **Health check:**
   ```bash
   curl https://your-app.railway.app/health
   ```
   Should return: `{"status":"OK"}`

2. **First-setup status:**
   ```bash
   curl https://your-app.railway.app/api/auth/first-setup
   ```
   Should return: `{"isFirstSetup":true,"reason":"no_users"}`

3. **Database tables:**
   ```bash
   railway run psql $DATABASE_URL -c "\dt"
   ```
   Should show 41 tables.

## Next Deploy

For subsequent deployments, just push:
```bash
git add .
git commit -m "Your changes"
git push
```

Railway will automatically:
- Build the app
- Run migrations (skip existing tables)
- Restart server with zero downtime

## Rollback

If deployment fails:
```bash
# Via Railway UI: Go to deployments and click "Rollback"
# Or redeploy previous commit
git revert HEAD
git push
```
