# АНАЛІЗ ПРОБЛЕМ МОБІЛЬНОГО ДИЗАЙНУ

## КРИТИЧНІ ПРОБЛЕМИ:

### 1. **BOTTOM NAVIGATION (MobileBottomNav.js)**
**Проблема:**
- Показується текст під іконками (`<span className="font-medium">{t(labelKey)}</span>`)
- Немає pull indicator для розгортання меню
- 7 items - занадто багато, не поміщається

**Рішення:**
- Сховати всі span елементи
- Додати pull indicator через ::before
- Показувати тільки іконки

### 2. **HEADER (Header.js)**
**Проблема:**
- Використовує класи `top-nav-mobile`, `btn-icon-mobile` які не визначені
- Mobile menu не повноекранний
- Неправильна структура для slide-in меню

**Рішення:**
- Створити proper full-screen modal для меню
- Додати backdrop
- Правильні класи та стилі

### 3. **CALENDAR (CalendarView.js)**
**Проблема:**
- Класи `calendar-mobile-*` існують в index.css але конфліктують
- Занадто вузькі елементи
- Рамки навколо кнопок view selector

**Рішення:**
- Власний CSS файл для calendar mobile
- Прибрати всі borders з view selector
- Збільшити spacing

### 4. **EVENT MODAL (EventDetailsModal.js)**
**Проблема:**
- Класи `modal-backdrop-mobile`, `btn-mobile` не визначені proper
- Занадто низько розміщена модалка
- Неправильний bottom sheet style

**Рішення:**
- Створити proper bottom sheet modal
- 85vh висота
- Pull handle
- Правильні paddings

### 5. **MESSENGER (DirectMessenger.js)**
**Проблема:**
- Класи `messenger-mobile-*` частково визначені
- Конфлікти стилів
- Event picker modal погано виглядає

**Рішення:**
- Окремий CSS для messenger mobile
- Proper event picker modal (bottom sheet)
- Великі touchable areas

### 6. **PLANNER TOGGLES**
**Проблема:**
- CSS для toggles є але не працює на всіх toggles
- Неправильні селектори

**Рішення:**
- Специфічні селектори для planner page
- Стандартні iOS toggles 52x32px
- Зелений #10b981

### 7. **NOTIFICATIONS**
**Проблема:**
- Панель не існує як компонент
- Стилі є але не застосовуються

**Рішення:**
- Перевірити NotificationDropdown.js
- Додати mobile-specific стилі
- Slide from right

## ПЛАН ВИПРАВЛЕННЯ:

1. ✅ **mobile-bottom-nav.css** - тільки для bottom navigation
2. ✅ **mobile-header.css** - header + full-screen menu
3. ✅ **mobile-calendar.css** - calendar view + event modals
4. ✅ **mobile-messenger.css** - messenger + event picker
5. ✅ **mobile-notifications.css** - notification panel
6. ✅ **mobile-planner.css** - planner toggles
7. ✅ **mobile-kanban.css** - kanban mobile
8. ✅ **mobile-forms.css** - всі форми та inputs
9. ✅ **mobile-global.css** - загальні стилі (buttons, modals, etc)

## СТАНДАРТИ:

- **Touch targets:** мінімум 44px (Apple HIG)
- **Spacing:** 16px, 20px, 24px (consistent)
- **Border radius:** 12px (buttons), 16px (cards), 20px (modals)
- **Typography:**
  - Body: 16px (1rem)
  - Small: 14px (0.875rem)
  - Headings: 20px, 24px, 28px
- **Colors:**
  - Primary: #3b82f6 (blue-500)
  - Success: #10b981 (green-500)
  - Danger: #ef4444 (red-500)
  - Gray: #64748b (slate-500)
  - Border: #e5e7eb (gray-200)
  - Background: #f8fafc (slate-50)
- **Animations:**
  - Duration: 0.2s (fast), 0.3s (normal), 0.4s (slow)
  - Easing: cubic-bezier(0.4, 0, 0.2, 1)
- **Z-index scale:**
  - Bottom nav: 1000
  - Header: 50
  - Modals: 9999
  - Backdrop: 9998
