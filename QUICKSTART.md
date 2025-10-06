# 🚀 Швидкий старт Biolab Logistik Planner

## ⚡ Запуск за 3 хвилини

### Крок 1: Встановлення залежностей

```bash
# Сервер
cd server
npm install

# Клієнт
cd ../client
npm install
```

### Крок 2: Запуск системи

**Варіант A: Розробка (Development)**

```bash
# Термінал 1 - Сервер (http://localhost:5000)
cd server
npm run dev

# Термінал 2 - Клієнт (http://localhost:3000)
cd client
npm start
```

**Варіант B: Production**

```bash
# 1. Очистити тестові дані
cd server
node scripts/cleanup-test-data.js

# 2. Зібрати клієнт
cd ../client
npm run build

# 3. Запустити сервер
cd ../server
npm start
# або через PM2:
pm2 start index.js --name biolab-server
```

### Крок 3: Вхід в систему

Відкрийте браузер: **http://localhost:3000**

**Облікові дані за замовчуванням:**
- Username: `admin`
- Password: `admin123`

⚠️ **Важливо:** Змініть пароль після першого входу!

---

## 🔧 Корисні команди

### Тестування системи
```bash
cd server
node scripts/test-system.js
```

### Очищення бази даних
```bash
cd server
node scripts/cleanup-test-data.js
```

### Моніторинг (PM2)
```bash
pm2 logs biolab-server    # Переглянути логи
pm2 restart biolab-server  # Перезапустити
pm2 stop biolab-server     # Зупинити
pm2 status                 # Статус всіх процесів
```

---

## 📊 Що працює Real-time

### ✅ Канбан дошка
- Створення/редагування/видалення задач
- Drag & Drop між колонками
- Індикатори: хто редагує задачу
- Конфлікт резолюшн при одночасному редагуванні

### ✅ Повідомлення
- Миттєва доставка повідомлень
- Typing indicators ("друкує...")
- Read receipts (✓ доставлено, ✓✓ прочитано)
- Online/Offline статуси
- Desktop та звукові сповіщення
- Підтримка GIF

### ✅ Календар
- Створення подій
- Waste disposal планування
- Фільтрація за категоріями

---

## 🐛 Усунення проблем

### Порт вже зайнятий
```bash
# Знайти процес на порту 5000
lsof -i :5000

# Вбити процес
kill -9 <PID>
```

### WebSocket не підключається
1. Перевірте, чи запущений сервер
2. Перевірте CORS налаштування в `.env`
3. Очистіть кеш браузера

### База даних заблокована
```bash
# Перезапустити сервер
pm2 restart biolab-server
# або
cd server && npm run dev
```

---

## 📚 Документація

- **Повна документація:** [DEPLOYMENT.md](DEPLOYMENT.md)
- **Звіт про зміни:** [FINAL_REPORT.md](FINAL_REPORT.md)
- **API документація:** `docs/` папка

---

## 🎯 Структура проекту

```
Biolab-Logistik-Planner/
├── client/              # React додаток
│   ├── src/
│   │   ├── components/  # UI компоненти
│   │   ├── hooks/       # Custom hooks
│   │   ├── pages/       # Сторінки
│   │   └── utils/       # Утиліти
│   └── build/           # Production збірка
│
├── server/              # Express API
│   ├── routes/          # API endpoints
│   ├── middleware/      # Middleware
│   ├── scripts/         # Утилітні скрипти
│   └── websocket.js     # WebSocket сервер
│
├── data/                # База даних
│   └── biolab.db        # SQLite
│
└── docs/                # Документація
```

---

## 🔐 Безпека

- ✅ JWT автентифікація
- ✅ WebSocket auth через токен
- ✅ CORS захист
- ✅ SQL injection захист
- ✅ Bcrypt password hashing

---

## 🌟 Особливості

- **Real-time sync** - миттєва синхронізація між користувачами
- **Optimistic UI** - миттєвий відгук інтерфейсу
- **Offline support** - fallback на HTTP при відсутності WebSocket
- **Error recovery** - автоматичний rollback при помилках
- **Mobile responsive** - повна підтримка мобільних пристроїв

---

## 💡 Наступні кроки

1. ✅ Запустити систему (вище)
2. 📧 Створити облікові записи користувачів
3. 📋 Додати задачі в Kanban
4. 💬 Протестувати повідомлення
5. 📅 Створити події в календарі

---

## 🤝 Підтримка

**Статус:** ✅ Готово до використання

Для детальної інформації дивіться [DEPLOYMENT.md](DEPLOYMENT.md) та [FINAL_REPORT.md](FINAL_REPORT.md)
