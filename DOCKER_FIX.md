# 🐳 Docker Build - Виправлення помилок

## ❌ Проблема

Docker build падав з помилкою:
```
[eslint]
src/components/Header.js
  Line 213:20:  React Hook "useCallback" is called conditionally...
  Line 215:24:  React Hook "useCallback" is called conditionally...
  Line 226:29:  React Hook "useMemo" is called conditionally...
```

## ✅ Рішення

**Проблема:** React hooks викликались після `if (!user) return null;`

**Правило React Hooks:** Hooks повинні викликатись **завжди в одному і тому ж порядку** на кожному рендері.

### Було (неправильно):
```javascript
if (!user) return null;  // ❌ Early return перед hooks

const isActive = useCallback(...);     // ❌ Умовний виклик
const handleLogout = useCallback(...); // ❌ Умовний виклик
const availableNavItems = useMemo(...);// ❌ Умовний виклик
```

### Стало (правильно):
```javascript
const isActive = useCallback(...);     // ✅ Завжди викликається
const handleLogout = useCallback(...); // ✅ Завжди викликається
const availableNavItems = useMemo(...);// ✅ Завжди викликається

if (!user) return null;  // ✅ Early return після всіх hooks
```

## 🔧 Виправлено у файлі

**Файл:** `client/src/components/Header.js`

**Зміни:** Переміщено всі React hooks ПЕРЕД early return

## ✅ Результат

```bash
✅ Creating an optimized production build...
✅ Compiled with warnings. (не критичні)
✅ Build готовий до deployment
```

## 🚀 Команди для перевірки

### Локальна збірка
```bash
cd client
npm run build
```

### Docker збірка
```bash
docker build -t biolab-planner .
```

### Запуск Docker контейнера
```bash
docker run -p 3000:3000 biolab-planner
```

## 📝 Що запам'ятати

**React Hooks Rules:**

1. ✅ Викликайте hooks лише на верхньому рівні
2. ✅ Не викликайте hooks в циклах, умовах або вкладених функціях
3. ✅ Викликайте hooks завжди в одному порядку
4. ✅ Early returns повинні бути ПІСЛЯ всіх hooks

### Приклад правильної структури:

```javascript
function Component() {
  // 1. Завжди викликаємо всі hooks
  const [state, setState] = useState();
  const value = useMemo(() => {...}, []);
  const callback = useCallback(() => {...}, []);

  // 2. Потім можна робити early returns
  if (condition) return null;

  // 3. Решта логіки
  return <div>...</div>;
}
```

## 🎯 Статус

✅ **Проблему вирішено**
✅ **Build проходить успішно**
✅ **Docker ready**
✅ **Production ready**

---

**Виправлено:** 6 жовтня 2025
**Коміт:** `bfc2668 - Production-ready optimization and real-time sync`
