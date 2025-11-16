# 🚀 Railway Deployment Guide - Biolab Logistik Planner

## ✅ Voraussetzungen

1. **Railway Account**: https://railway.app
2. **Railway CLI**: `npm install -g @railway/cli`
3. **Git Repository**: Code muss in Git sein

## 📋 Schritt-für-Schritt Anleitung

### 1️⃣ Railway Projekt erstellen

```bash
# Bei Railway einloggen
railway login

# Neues Projekt erstellen
railway new

# Projekt mit Git verknüpfen
railway link
```

### 2️⃣ PostgreSQL Datenbank hinzufügen

1. Öffnen Sie https://railway.app/dashboard
2. Wählen Sie Ihr Projekt
3. Klicken Sie auf "New" → "Database" → "PostgreSQL"
4. Warten Sie bis die Datenbank bereitgestellt ist

### 3️⃣ Umgebungsvariablen setzen

```bash
# JWT Secret generieren (starker zufälliger String)
railway variables set JWT_SECRET="ihr-sehr-geheimer-schluessel-hier"

# Node Environment
railway variables set NODE_ENV="production"

# Optional: Redis für WebSocket-Skalierung
# railway variables set REDIS_URL="redis://..."
```

DATABASE_URL wird automatisch von Railway gesetzt!

### 4️⃣ Datenbank initialisieren

```bash
# Skript ausführbar machen
chmod +x rebuild-railway-database.sh

# Datenbank aufbauen
./rebuild-railway-database.sh
```

### 5️⃣ Deployment

```bash
# Code zu Git committen
git add .
git commit -m "🚀 Production-ready optimization and real-time sync

## Major Changes

### ✅ WebSocket & Real-time System
- Optimized WebSocket connections with auto-reconnect
- Added heartbeat mechanism (30s intervals)
- Implemented typing indicators for messages
- Real-time user online/offline status

### ✅ Kanban Board Integration
- Migrated from localStorage to API endpoints
- Implemented optimistic UI updates
- Added real-time task synchronization
- Created conflict resolution dialogs
- Task editing indicators (who's editing what)

### ✅ Messaging System
- Instant message delivery via WebSocket
- Read receipts (double check marks)
- Desktop & sound notifications
- GIF support with optimized loading

### ✅ Code Quality
- Removed duplicate files (6 files)
- Fixed React hooks rules violation in Header.js
- Organized documentation into docs/ folder
- Created utility scripts for maintenance

### ✅ Documentation & Scripts
- Added DEPLOYMENT.md with full deployment guide
- Created FINAL_REPORT.md with detailed changelog
- Added cleanup-test-data.js script
- Added test-system.js for health checks

### 🔧 Technical Improvements
- All CRUD operations via API
- Optimistic UI with rollback on errors
- Full error handling and recovery
- Production build ready
- Clean repository structure

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Zu Railway pushen
git push

# Railway deployment triggern
railway up
```

### 6️⃣ Volume für File-Uploads mounten

1. Gehen Sie zu https://railway.app/dashboard
2. Wählen Sie Ihren Service
3. Gehen Sie zu "Settings" → "Volumes"
4. Klicken Sie auf "Add Volume"
5. Mount path: `/uploads`
6. Size: 5GB (oder nach Bedarf)

## 🔍 Überprüfung

### Health Check
```bash
# Railway URL abrufen
railway domain

# Health check
curl https://your-app.railway.app/health
```

### Logs überwachen
```bash
railway logs --tail
```

### Datenbank-Status prüfen
```bash
railway run psql -c "\dt"
```

## 📱 First Setup

1. Öffnen Sie: `https://your-app.railway.app`
2. System erkennt automatisch First-Setup
3. Erstellen Sie Superadmin Account
4. Login und weitere Benutzer anlegen

## 🛠️ Wartung

### Datenbank zurücksetzen
```bash
./rebuild-railway-database.sh
```

### Logs anzeigen
```bash
railway logs
```

### Variables anzeigen
```bash
railway variables
```

### SSH in Container
```bash
railway shell
```

## ⚠️ Wichtige Hinweise

1. **DATABASE_URL**: Wird automatisch von Railway gesetzt - NICHT überschreiben!
2. **JWT_SECRET**: MUSS in Production geändert werden!
3. **Volumes**: Für persistente File-Uploads erforderlich
4. **WebSocket**: Funktioniert automatisch über Railway Proxy
5. **SSL/HTTPS**: Automatisch von Railway bereitgestellt

## 🚨 Troubleshooting

### App startet nicht
```bash
# Logs prüfen
railway logs

# Umgebungsvariablen prüfen
railway variables
```

### Datenbank-Fehler
```bash
# Migrations manuell ausführen
railway run npm run migrate:pg
```

### WebSocket-Probleme
- Prüfen Sie CORS-Einstellungen
- Redis für Skalierung hinzufügen

### File-Upload funktioniert nicht
- Volume korrekt gemountet?
- Berechtigungen prüfen
- Max file size in ENV?

## 📞 Support

Bei Problemen:
1. Railway Discord: https://discord.gg/railway
2. GitHub Issues: https://github.com/your-repo/issues
3. Railway Docs: https://docs.railway.app

## ✅ Deployment Checklist

- [ ] Railway CLI installiert
- [ ] Projekt erstellt und verknüpft
- [ ] PostgreSQL Datenbank hinzugefügt
- [ ] JWT_SECRET gesetzt
- [ ] Datenbank initialisiert
- [ ] Code deployed
- [ ] Volume für Uploads gemountet
- [ ] Health Check erfolgreich
- [ ] First Setup abgeschlossen
- [ ] WebSocket getestet
- [ ] File Upload getestet

---

🎉 **Fertig!** Ihre Biolab Logistik Planner App läuft jetzt auf Railway!