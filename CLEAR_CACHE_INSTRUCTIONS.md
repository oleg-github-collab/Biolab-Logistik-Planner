# 🔄 Інструкції по очищенню кешу

## Для розробки (Development):

```bash
# Очистити кеш і запустити dev server
cd client
rm -rf node_modules/.cache .cache
npm start
```

## Для білду (Production):

```bash
# Білд без кешу (рекомендовано)
cd client
npm run build:clean

# АБО вручну
rm -rf node_modules/.cache build .cache
npm run build
```

## Очищення кешу браузера:

### Chrome/Edge:
1. Натисніть `Cmd + Shift + Delete` (Mac) або `Ctrl + Shift + Delete` (Windows)
2. Виберіть "Cached images and files"
3. Натисніть "Clear data"

### Safari:
1. Натисніть `Cmd + Option + E` для очищення кешу
2. Оновіть сторінку `Cmd + R`

### Жорстке оновлення (Hard Reload):
- Chrome/Edge: `Cmd + Shift + R` (Mac) або `Ctrl + Shift + R` (Windows)
- Safari: `Cmd + Option + R`

## Перевірка що кеш очищено:

1. Відкрийте DevTools (`F12`)
2. Перейдіть на вкладку Network
3. Поставте галочку "Disable cache"
4. Оновіть сторінку

## Version bump:

Поточна версія: `v2.0.1`

Якщо проблема залишається, перевірте що в index.html є:
```html
<link rel="icon" href="%PUBLIC_URL%/favicon.ico?v=2.0.1" />
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
```
