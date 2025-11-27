# 🚀 Vercel Environment Variables Setup

## ❌ ПРОБЛЕМА

**Stories та Bot не працюють на production!**

**Причина:** Frontend (Vercel) не знає куди слати API requests.

Локально `MessengerComplete.js` використовує:
```javascript
baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api'
```

Якщо `REACT_APP_API_URL` не встановлений, frontend шле requests на `localhost` - який НЕ існує на production!

## ✅ РІШЕННЯ

### Крок 1: Додай environment variable в Vercel

1. **Перейди на:** https://vercel.com/dashboard
2. **Вибери проект:** biolab-logistik-planner (або твоя назва)
3. **Settings** → **Environment Variables**
4. **Додай нову змінну:**
   ```
   Name: REACT_APP_API_URL
   Value: https://biolab-logistik-planner-production.up.railway.app/api
   ```
5. **Environments:** Production, Preview, Development (всі 3)
6. **Save**

### Крок 2: Redeploy

Після додавання змінної, Vercel НЕ автоматично rebuild.

**Опція A - Trigger redeploy через UI:**
1. Vercel Dashboard → Deployments
2. Клік на останній deployment
3. **⋯ (три крапки)** → **Redeploy**
4. Підтверди

**Опція B - Trigger через Git:**
```bash
git commit --allow-empty -m "Trigger Vercel redeploy"
git push origin main
```

### Крок 3: Перевір що працює

1. **Відкрий production URL**
   - https://biolab-logistik-planner.vercel.app (або твій URL)

2. **Відкрий Browser DevTools** (F12)
   - Network tab
   - Filter: XHR/Fetch

3. **Відкрий Messenger**
   - Має з'явитися Stories секція
   - Network tab має показувати requests до:
     ```
     https://biolab-logistik-planner-production.up.railway.app/api/messages/stories
     ```
   - **НЕ** до `localhost`!

4. **Тестуй BL_Bot**
   - Створи розмову з ботом
   - Надішли повідомлення
   - Network tab має показати POST до:
     ```
     https://biolab-logistik-planner-production.up.railway.app/api/messages
     ```

## 🔍 Як перевірити що змінна встановлена

### В Vercel Dashboard:
```
Settings → Environment Variables
Має бути:
REACT_APP_API_URL = https://biolab-logistik-planner-production.up.railway.app/api
```

### В Browser Console (production):
```javascript
// Відкрий https://biolab-logistik-planner.vercel.app
// F12 → Console
console.log(process.env.REACT_APP_API_URL)
// Має вивести: undefined (це нормально - React app вже compiled)

// Але API calls мають йти на правильний URL
// Перевір в Network tab
```

### В Deployment Logs:
```
Vercel Dashboard → Deployments → Latest → Build Logs

Шукай:
"Creating an optimized production build..."
"Build environment variables:"
REACT_APP_API_URL=https://biolab-logistik-planner-production.up.railway.app/api
```

## ⚠️ Важливо

### ❌ НЕ КОМИТЬ .env.production в Git!

`.env` файли в `.gitignore` - це ПРАВИЛЬНО і безпечно!

Production secrets мають бути ТІЛЬКИ в:
- Vercel Environment Variables (frontend)
- Railway Environment Variables (backend)

### ✅ Що має бути в Vercel:

| Variable | Value | Environments |
|----------|-------|--------------|
| REACT_APP_API_URL | https://biolab-logistik-planner-production.up.railway.app/api | Production, Preview, Development |

### ✅ Що має бути в Railway:

| Variable | Value |
|----------|-------|
| OPENAI_API_KEY | sk-proj-твій-ключ |
| DATABASE_URL | (auto-generated) |
| JWT_SECRET | твій-секрет |
| CORS_ORIGIN | https://biolab-logistik-planner.vercel.app |
| FRONTEND_URL | https://biolab-logistik-planner.vercel.app |
| NODE_ENV | production |
| PORT | (auto-generated) |

## 🐛 Troubleshooting

### Stories не завантажуються

**Перевір Network tab:**
```
F12 → Network → Filter: stories

Request URL має бути:
https://biolab-logistik-planner-production.up.railway.app/api/messages/stories

ЯКЩО бачиш:
http://localhost:5000/api/messages/stories
або
https://biolab-logistik-planner.vercel.app/api/messages/stories

→ REACT_APP_API_URL не встановлений або Vercel не rebuild!
```

**Рішення:**
1. Перевір що змінна є в Vercel Settings
2. Redeploy через Vercel UI або git push
3. Очисти browser cache (Ctrl+Shift+R)

### Bot не відповідає

**Перевір:**
1. **Railway logs:**
   ```
   Railway Dashboard → Logs
   Шукай: "🤖 BL_Bot processing incoming message"
   ```

2. **Network tab - POST /api/messages:**
   - Request йде на Railway URL
   - Response status 201 Created
   - Response має message object

3. **OpenAI ключ:**
   ```
   Railway Logs → Шукай:
   "✅ BL_Bot initialized successfully"
   "aiEnabled: true"  ← МАЄ БУТИ true!
   ```

### CORS errors

Якщо бачиш:
```
Access to fetch at 'https://...' from origin 'https://biolab-logistik-planner.vercel.app'
has been blocked by CORS policy
```

**Рішення:**

1. **Railway Variables - додай:**
   ```
   CORS_ORIGIN=https://biolab-logistik-planner.vercel.app
   FRONTEND_URL=https://biolab-logistik-planner.vercel.app
   ```

2. **Якщо маєш custom domain:**
   ```
   CORS_ORIGIN=https://your-custom-domain.com,https://biolab-logistik-planner.vercel.app
   ```

3. **Restart Railway deployment**

## 📝 Checklist

### Vercel
- [ ] Додано REACT_APP_API_URL в Environment Variables
- [ ] Value = https://biolab-logistik-planner-production.up.railway.app/api
- [ ] Environments = Production, Preview, Development
- [ ] Triggered redeploy
- [ ] Deployment успішний (зелена галочка)
- [ ] Перевірено Network tab - requests йдуть на Railway
- [ ] Stories завантажуються
- [ ] Bot отримує повідомлення

### Railway
- [ ] OPENAI_API_KEY встановлений (справжній ключ)
- [ ] CORS_ORIGIN = https://biolab-logistik-planner.vercel.app
- [ ] FRONTEND_URL = https://biolab-logistik-planner.vercel.app
- [ ] Logs показують: aiEnabled: true
- [ ] 3 test stories в DB (active)
- [ ] API /health returns 200

### End-to-End
- [ ] Відкрив production URL
- [ ] Залогінився
- [ ] Перейшов в Messenger
- [ ] Бачу Stories секцію
- [ ] Бачу 3 тестові stories
- [ ] Створив розмову з BL_Bot
- [ ] Надіслав повідомлення
- [ ] Отримав ChatGPT відповідь (не заглушку)

---

**Після виконання цих кроків ВСЕ МАЄ ПРАЦЮВАТИ!** 🎉
