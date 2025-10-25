# Railway Deployment Setup Guide

## Необхідні Кредешнали для Railway

### 1. PostgreSQL Database

**Спосіб налаштування:**
1. У Railway проекті натисніть "+ New" → "Database" → "Add PostgreSQL"
2. Railway автоматично створить змінну `DATABASE_URL`

**Змінна середовища:**
```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

Ця змінна автоматично включає:
- Host
- Port
- Database name
- Username
- Password

**Формат:** `postgresql://user:password@host:port/database`

### 2. Redis Cache

**Спосіб налаштування:**
1. У Railway проекті натисніть "+ New" → "Database" → "Add Redis"
2. Railway автоматично створить змінну `REDIS_URL`

**Змінна середовища:**
```env
REDIS_URL=${{Redis.REDIS_URL}}
```

**Формат:** `redis://default:password@host:port`

### 3. JWT та Session Secrets

**ВАЖЛИВО:** Згенеруйте безпечні випадкові ключі!

**Змінні середовища:**
```env
JWT_SECRET=<ваш-секретний-ключ-32-символи>
SESSION_SECRET=<інший-секретний-ключ-32-символи>
```

**Як згенерувати безпечний ключ:**

**Спосіб 1 - Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Спосіб 2 - OpenSSL:**
```bash
openssl rand -hex 32
```

**Спосіб 3 - Python:**
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 4. Налаштування середовища

```env
NODE_ENV=production
PORT=5000
```

**Примітка:** PORT зазвичай автоматично встановлюється Railway, але можна вказати явно.

### 5. Налаштування файлів

```env
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=52428800
```

- `UPLOAD_DIR` - папка для завантажених файлів (автоматично створюється)
- `MAX_FILE_SIZE` - максимальний розмір файлу в байтах (50MB)

### 6. CORS та безпека (опціонально)

```env
ALLOWED_ORIGINS=https://your-frontend-domain.com,https://your-app.railway.app
```

---

## Повний Список Змінних для Railway

Скопіюйте і додайте в **Railway → Variables**:

```env
# Database (автоматично від Railway PostgreSQL addon)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Redis (автоматично від Railway Redis addon)
REDIS_URL=${{Redis.REDIS_URL}}

# Security - ЗГЕНЕРУЙТЕ ВЛАСНІ КЛЮЧІ!
JWT_SECRET=ЗМІНІТЬ_НА_ВИПАДКОВИЙ_32_СИМВОЛЬНИЙ_КЛЮЧ
SESSION_SECRET=ЗМІНІТЬ_НА_ІНШИЙ_ВИПАДКОВИЙ_32_СИМВОЛЬНИЙ_КЛЮЧ

# Environment
NODE_ENV=production
PORT=5000

# File Upload
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=52428800

# Optional - CORS (якщо потрібно обмежити домени)
# ALLOWED_ORIGINS=https://your-domain.com
```

---

## Покрокова Інструкція Deployment на Railway

### Крок 1: Створення проекту

1. Перейдіть на [railway.app](https://railway.app)
2. Увійдіть через GitHub
3. Натисніть "New Project"
4. Оберіть "Deploy from GitHub repo"
5. Оберіть репозиторій `Biolab-Logistik-Planner`

### Крок 2: Додавання PostgreSQL

1. У проекті натисніть "+ New"
2. Оберіть "Database"
3. Оберіть "Add PostgreSQL"
4. Дочекайтесь створення (1-2 хв)

### Крок 3: Додавання Redis

1. У проекті натисніть "+ New"
2. Оберіть "Database"
3. Оберіть "Add Redis"
4. Дочекайтесь створення (1-2 хв)

### Крок 4: Налаштування змінних середовища

1. Відкрийте ваш сервіс (не database)
2. Перейдіть у вкладку "Variables"
3. Додайте всі змінні зі списку вище:

**Обов'язково згенеруйте власні ключі для:**
- `JWT_SECRET`
- `SESSION_SECRET`

Використовуйте команду:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Крок 5: Додавання Volume (для файлів)

1. У сервісі перейдіть у вкладку "Settings"
2. Scroll down до "Volumes"
3. Натисніть "New Volume"
4. Mount Path: `/app/uploads`
5. Натисніть "Add"

### Крок 6: Запуск міграцій

**Після першого deployment:**

1. Відкрийте Railway Dashboard
2. Перейдіть у вкладку сервісу
3. Натисніть на "..." (три крапки) → "View Logs"
4. Перевірте, чи успішно підключилась база даних

**Запуск міграцій через Railway CLI:**

```bash
# Встановіть Railway CLI
npm install -g @railway/cli

# Залогіньтесь
railway login

# Підключіться до проекту
railway link

# Запустіть міграції
railway run npm run migrate
```

**Або запустіть міграції безпосередньо через SQL:**

1. У Railway відкрийте PostgreSQL addon
2. Перейдіть у вкладку "Data"
3. Натисніть "Query"
4. Скопіюйте та виконайте SQL з файлів:
   - `server/migrations/001_initial_schema.sql`
   - `server/migrations/002_knowledge_base.sql`
   - `server/migrations/003_advanced_task_management.sql`
   - `server/migrations/004_enhanced_messenger.sql`

### Крок 7: Перевірка deployment

1. Дочекайтесь завершення build (3-5 хв)
2. Відкрийте згенерований URL (наприклад, `https://your-app.up.railway.app`)
3. Перейдіть на `/health` для перевірки:
   ```
   https://your-app.up.railway.app/health
   ```

Очікувана відповідь:
```json
{
  "status": "OK",
  "timestamp": "2025-01-15T12:00:00.000Z",
  "environment": "production"
}
```

### Крок 8: Створення першого суперадміна

1. Відкрийте ваш додаток
2. Перейдіть на сторінку реєстрації (First Setup)
3. Створіть перший акаунт - автоматично стане superadmin

---

## Troubleshooting

### Проблема: "Database connection failed"

**Рішення:**
1. Перевірте, чи створено PostgreSQL addon
2. Перевірте, чи змінна `DATABASE_URL` правильно референсується:
   ```env
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   ```
3. Перезапустіть deployment

### Проблема: "Redis connection failed"

**Рішення:**
1. Перевірте, чи створено Redis addon
2. Перевірте змінну `REDIS_URL`:
   ```env
   REDIS_URL=${{Redis.REDIS_URL}}
   ```
3. Redis не є критичним - додаток працюватиме без нього, але з меншою продуктивністю

### Проблема: 404 на всіх API endpoints

**Рішення:**
1. Перевірте логи: Railway → Service → Logs
2. Переконайтесь, що build успішний
3. Перевірте, чи файли `.pg.js` routes існують в репозиторії

### Проблема: "Invalid token" після логіну

**Рішення:**
1. Переконайтесь, що `JWT_SECRET` встановлено в Railway
2. Очистіть localStorage в браузері
3. Перелогіньтесь

### Проблема: File uploads не працюють

**Рішення:**
1. Перевірте, чи створено Volume з mount path `/app/uploads`
2. Перевірте змінну `UPLOAD_DIR=/app/uploads`
3. Перезапустіть сервіс після додавання Volume

---

## Оновлення Додатку

Кожен push до `main` гілки автоматично запускає новий deployment в Railway.

**Ручне перезапускання:**
1. Railway Dashboard → Service
2. Натисніть "Deploy" → "Redeploy"

**Відкат до попередньої версії:**
1. Railway Dashboard → Service → "Deployments"
2. Оберіть попередній успішний deployment
3. Натисніть "..." → "Redeploy"

---

## Моніторинг та Логи

### Перегляд логів реального часу:
```bash
railway logs
```

### Перегляд метрик:
1. Railway Dashboard → Service
2. Вкладка "Metrics"
3. Переглядайте CPU, Memory, Network

### Audit Trail:
Адмін панель додатку → Audit Logs
```
https://your-app.railway.app/admin
```

---

## Додаткові Ресурси

- [Railway Documentation](https://docs.railway.app/)
- [PostgreSQL на Railway](https://docs.railway.app/databases/postgresql)
- [Redis на Railway](https://docs.railway.app/databases/redis)
- [Volumes на Railway](https://docs.railway.app/reference/volumes)

---

## Контакти

При виникненні проблем:
1. Перевірте логи в Railway
2. Перевірте змінні середовища
3. Перезапустіть сервіс
4. Перевірте документацію вище

**Успішного deployment! 🚀**
