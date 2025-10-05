# 🚀 Інструкція з розгортання Biolab Logistik Planner

## 📋 Передумови

- Node.js v14 або новіша версія
- npm v6 або новіша версія
- Git

## 🔧 Встановлення

### 1. Клонування репозиторію

```bash
git clone <repository-url>
cd Biolab-Logistik-Planner
```

### 2. Встановлення залежностей

#### Сервер
```bash
cd server
npm install
```

#### Клієнт
```bash
cd ../client
npm install
```

### 3. Налаштування середовища

Створіть файл `.env` у папці `server/`:

```env
# Server Configuration
PORT=5000
NODE_ENV=production

# JWT Secret (змініть на власний випадковий рядок)
JWT_SECRET=your-very-secure-random-secret-key-change-this

# Database
DB_PATH=../data/biolab.db

# CORS
CORS_ORIGIN=http://localhost:3000
```

## 🧹 Очищення тестових даних

Перед розгортанням видаліть всі тестові дані:

```bash
cd server
node scripts/cleanup-test-data.js
```

## 🧪 Тестування системи

Перевірте працездатність системи:

```bash
# Запустіть сервер у іншому терміналі
cd server
npm run dev

# У новому терміналі запустіть тести
node scripts/test-system.js
```

## 🎯 Запуск у режимі розробки

### Сервер
```bash
cd server
npm run dev
```

Сервер буде доступний на http://localhost:5000

### Клієнт
```bash
cd client
npm start
```

Клієнт буде доступний на http://localhost:3000

## 📦 Збірка для production

### Клієнт
```bash
cd client
npm run build
```

Збірка буде створена у папці `client/build/`

## 🔐 Облікові дані за замовчуванням

**Admin:**
- Username: `admin`
- Password: `admin123`

⚠️ **ВАЖЛИВО:** Змініть пароль адміністратора після першого входу!

## 🚀 Розгортання на production сервері

### 1. Підготовка сервера

```bash
# Оновіть систему
sudo apt update && sudo apt upgrade -y

# Встановіть Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Встановіть PM2 для управління процесами
sudo npm install -g pm2
```

### 2. Клонування та налаштування

```bash
git clone <repository-url>
cd Biolab-Logistik-Planner

# Встановіть залежності
cd server && npm install --production
cd ../client && npm install && npm run build
```

### 3. Налаштування PM2

```bash
cd server
pm2 start index.js --name biolab-server
pm2 save
pm2 startup
```

### 4. Налаштування Nginx (опціонально)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Клієнтська частина
    location / {
        root /path/to/Biolab-Logistik-Planner/client/build;
        try_files $uri /index.html;
    }

    # API та WebSocket
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

## 🔍 Моніторинг

### Перегляд логів PM2
```bash
pm2 logs biolab-server
```

### Перезапуск сервера
```bash
pm2 restart biolab-server
```

### Статус серверу
```bash
pm2 status
```

## 📊 Резервне копіювання

Регулярно створюйте резервні копії бази даних:

```bash
# Створення резервної копії
cp data/biolab.db data/backups/biolab-$(date +%Y%m%d-%H%M%S).db

# Автоматичне резервне копіювання (додайте до crontab)
0 2 * * * cd /path/to/Biolab-Logistik-Planner && cp data/biolab.db data/backups/biolab-$(date +\%Y\%m\%d).db
```

## 🛠️ Усунення проблем

### Порт вже використовується
```bash
# Знайти процес на порту 5000
lsof -i :5000

# Вбити процес
kill -9 <PID>
```

### База даних заблокована
```bash
# Перевірити блокування
lsof data/biolab.db

# Перезапустити сервер
pm2 restart biolab-server
```

### WebSocket не підключається
- Переконайтесь, що CORS налаштовано правильно
- Перевірте налаштування Nginx/proxy
- Перевірте firewall правила

## 📚 Додаткові ресурси

- Документація API: `/docs/API.md`
- Система повідомлень: `/docs/NOTIFICATION_SYSTEM.md`
- Kanban Board: `/docs/REALTIME_KANBAN_EXAMPLES.md`
- Waste Management: `/docs/WASTE_DISPOSAL_PLANNER_DOCUMENTATION.md`

## 🤝 Підтримка

Для звіту про проблеми або запитів нових функцій, створіть issue у репозиторії.

## 📝 Ліцензія

[Вкажіть вашу ліцензію тут]
