# 🧪 Biolab Logistik Planner

> Комплексна система управління логістикою та плануванням для біологічних лабораторій

[![Production Ready](https://img.shields.io/badge/status-production%20ready-success)](https://github.com)
[![Real-time](https://img.shields.io/badge/sync-real--time-blue)](https://github.com)
[![WebSocket](https://img.shields.io/badge/websocket-enabled-orange)](https://github.com)

## ⚡ Швидкий старт

```bash
# 1. Встановити залежності
cd server && npm install
cd ../client && npm install

# 2. Запустити (2 термінали)
cd server && npm run dev    # Термінал 1
cd client && npm start      # Термінал 2

# 3. Відкрити http://localhost:3000
# Логін: admin / Пароль: admin123
```

📖 **Детальніше:** [QUICKSTART.md](QUICKSTART.md)

---

## ✨ Основні можливості

### 🔄 Real-time синхронізація
- ⚡ Миттєве оновлення між користувачами
- 🔌 WebSocket з автоматичним переподключенням
- 💓 Heartbeat механізм для стабільності

### 📋 Kanban Board
- ✅ Створення/редагування/видалення завдань
- 🎯 Drag & Drop між колонками
- 👥 Індикатори редагування (хто працює з задачею)
- 🔄 Conflict resolution при одночасному редагуванні
- 📊 Optimistic UI для миттєвого відгуку

### 💬 Система повідомлень
- 📨 Миттєва доставка повідомлень
- ✓✓ Read receipts (статуси прочитання)
- ⌨️ Typing indicators
- 🟢 Online/Offline статуси
- 🔔 Desktop та звукові сповіщення
- 🎬 Підтримка GIF

### 📅 Календар та планування
- 📆 Створення та управління подіями
- 🗑️ Waste disposal планування
- 🏷️ Фільтрація за категоріями
- 👥 Управління розкладом команди

### 👥 Управління користувачами
- 🔐 JWT автентифікація
- 🎭 Рольова система доступу
- 👤 Профілі користувачів
- 📊 Відстеження активності

---

## 🏗️ Технології

### Frontend
- ⚛️ React 18
- 🎨 Tailwind CSS
- 🔌 Socket.io Client
- 📅 date-fns
- 🎯 React Beautiful DnD

### Backend
- 🚀 Node.js + Express
- 💾 SQLite
- 🔌 Socket.io
- 🔐 JWT + bcrypt
- 📝 Winston Logger

---

## 📚 Документація

| Документ | Опис |
|----------|------|
| [QUICKSTART.md](QUICKSTART.md) | Швидкий старт за 3 хвилини |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Повна інструкція розгортання |
| [FINAL_REPORT.md](FINAL_REPORT.md) | Детальний звіт про зміни |
| [DOCKER_FIX.md](DOCKER_FIX.md) | Виправлення Docker build |
| [docs/](docs/) | Додаткова документація |

---

## 🚀 Production розгортання

### Docker
```bash
docker build -t biolab-planner .
docker run -p 3000:3000 biolab-planner
```

### PM2 (рекомендовано)
```bash
# 1. Зібрати клієнт
cd client && npm run build

# 2. Запустити через PM2
cd ../server
pm2 start index.js --name biolab-server
pm2 save
pm2 startup
```

📖 **Детальніше:** [DEPLOYMENT.md](DEPLOYMENT.md)

---

## 🧪 Тестування

```bash
# Перевірка системи
cd server
node scripts/test-system.js

# Очищення тестових даних
node scripts/cleanup-test-data.js
```

---

## 🗄️ PostgreSQL vollständig neu aufsetzen

```bash
# Kompletten Datenbestand löschen und Schema + Demo-Daten auf Deutsch neu anlegen
npm run db:rebuild
```

> ⚠️ Dieser Befehl löscht **alle** Datenbanken-Tabellen und erstellt sie anschließend mit den aktuellen SQL-Migrationen sowie deutschen Standarddaten neu. Ideal für frische Setups oder um defekte Umgebungen zu bereinigen.

---

## 🚂 Railway Umgebung

| Variable | Beschreibung |
|----------|--------------|
| `DATABASE_URL` | Wird von Railway/PostgreSQL bereitgestellt. Enthält Benutzer, Passwort, Host und DB-Namen. |
| `REDIS_URL`    | Redis-Connection-String (`redis://default:pass@host:port`). TLS-Varianten (`rediss://`) werden automatisch erkannt. |

Beide Services werden beim Start automatisch verbunden. Schlägt die Redis-Verbindung fehl, läuft die App weiter und protokolliert eine Warnung.

---

## 📊 Архітектура

```
┌─────────────┐         WebSocket          ┌─────────────┐
│   React     │ ◄────────────────────────► │   Express   │
│   Client    │                             │   Server    │
└─────────────┘                             └─────────────┘
      │                                            │
      │ HTTP/REST                         ┌────────────────┐
      └──────────────────────────────────►│    SQLite      │
                                           │   Database     │
                                           └────────────────┘
```

### Real-time Events

**Task Updates:**
- `task:created` → Нова задача створена
- `task:updated` → Задача оновлена
- `task:moved` → Задача переміщена
- `task:deleted` → Задача видалена
- `task:user_editing` → Користувач редагує

**Messages:**
- `new_message` → Нове повідомлення
- `message_read` → Повідомлення прочитано
- `user_typing` → Користувач друкує

**User Status:**
- `user_online` → Користувач онлайн
- `user_offline` → Користувач офлайн

---

## 🔒 Безпека

- ✅ JWT автентифікація для всіх API endpoints
- ✅ WebSocket authentication через токен
- ✅ CORS захист
- ✅ SQL injection захист (prepared statements)
- ✅ Bcrypt password hashing
- ✅ Rate limiting на критичних endpoints

---

## 🐛 Усунення проблем

### Порт зайнятий
```bash
lsof -i :5000
kill -9 <PID>
```

### WebSocket не підключається
```bash
# Перевірте .env файл
cd server
cat .env

# Перевірте CORS налаштування
```

### База даних заблокована
```bash
pm2 restart biolab-server
```

📖 **Більше:** [DEPLOYMENT.md](DEPLOYMENT.md#troubleshooting)

---

## 📈 Статус проекту

- ✅ **Real-time sync** - Працює бездоганно
- ✅ **API Integration** - Всі endpoints готові
- ✅ **WebSocket** - Стабільне з'єднання
- ✅ **Production Build** - Успішно
- ✅ **Documentation** - Повна
- ✅ **Testing** - Протестовано

**Готовність до production: 100%** 🎉

---

## 🤝 Внесок в проект

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📝 Ліцензія

[Вкажіть вашу ліцензію]

---

## 👨‍💻 Автори

- Розробка та оптимізація системи
- Real-time функціонал
- Production deployment

---

## 🎯 Наступні кроки

1. ✅ Запустити систему
2. 📧 Створити користувачів
3. 📋 Додати задачі
4. 💬 Протестувати повідомлення
5. 🚀 Розгорнути на production

---

<div align="center">

**Зроблено з ❤️ для Biolab**

[Почати](QUICKSTART.md) • [Документація](DEPLOYMENT.md) • [Звіт](FINAL_REPORT.md)

</div>
