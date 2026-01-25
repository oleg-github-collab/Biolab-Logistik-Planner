# Видалення дублікату чату

## Спосіб 1: Через консоль браузера (НАЙПРОСТІШИЙ)

1. Відкрий DevTools (F12)
2. Перейди на вкладку Console
3. Вставь і виконай:

```javascript
fetch('/api/admin/remove-duplicate-chats', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token'),
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(data => {
  console.log('✅ Результат:', data);
  alert('Дублікати видалено! Оновлюю сторінку...');
  setTimeout(() => window.location.reload(), 1000);
})
.catch(err => console.error('❌ Помилка:', err));
```

## Спосіб 2: Через curl

```bash
curl -X POST https://biolab.railway.app/api/admin/remove-duplicate-chats \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

## Що станеться:

- Знайдуться всі "Allgemeiner Chat"
- Залишиться найстарший (той що "vor 3 Tagen")
- Видаляться новіші дублікати разом з повідомленнями і членами
- Сторінка автоматично перезавантажиться
