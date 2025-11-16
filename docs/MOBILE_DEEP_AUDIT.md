# ГЛИБИННИЙ АУДИТ МОБІЛЬНОГО ДИЗАЙНУ

## КРИТИЧНІ ПРОБЛЕМИ:

### 1. BOTTOM NAVIGATION ⚠️ КРИТИЧНО
**Проблема:**
- 7 items в nav - ЗАНАДТО БАГАТО
- На iPhone SE (375px) не поміщається
- Items: Dashboard, Kanban, Messages, Schedule, Kisten, Knowledge, Profile
- Мінімум 52px * 7 = 364px + gaps = overflow

**Рішення:**
- Залишити тільки 4-5 найважливіших
- Решту перенести в header menu
- Або зробити horizontal scroll з snap points

---

### 2. HEADER MENU - НЕ РЕАЛІЗОВАНО ⚠️ БЛОКЕР
**Проблема:**
- CSS є в mobile-header.css
- Але Header.js НЕ використовує ці класи
- Класи: `.mobile-menu-fullscreen`, `.mobile-menu-backdrop` не застосовані
- Menu відкривається як toast, не full-screen

**Рішення:**
- Переробити Header.js щоб використовувати full-screen modal
- Додати backdrop
- Додати slide-up animation

---

### 3. CALENDAR VIEW SELECTOR - ПЕРЕКРИВАЄТЬСЯ
**Проблема:**
- Кнопки Week/Day/Month можуть перекриватися з arrow buttons
- Недостатньо spacing
- Pull indicator в bottom nav може конфліктувати з calendar controls

**Рішення:**
- Збільшити gap між елементами
- Зробити view selector як dropdown на малих екранах
- Або horizontal scroll з snap

---

### 4. EVENT MODAL - КЛАСИ НЕ ЗАСТОСОВУЮТЬСЯ
**Проблема:**
- EventDetailsModal.js використовує класи типу `.modal-backdrop-mobile`
- Але CSS в mobile-calendar.css селектори не збігаються точно
- Modal може не мати pull handle

**Рішення:**
- Синхронізувати класи між JS та CSS
- Переконатися що pull handle відображається

---

### 5. MESSENGER EVENT PICKER - НЕ РЕАЛІЗОВАНО
**Проблема:**
- CSS є в mobile-messenger.css
- Але DirectMessenger.js може не використовувати ці класи
- Event picker може бути не bottom sheet style

**Рішення:**
- Перевірити DirectMessenger.js
- Переконатися що event picker має правильну структуру

---

### 6. NOTIFICATIONS - КОМПОНЕНТ НЕ АДАПТОВАНИЙ
**Проблема:**
- CSS є в mobile-notifications.css
- NotificationDropdown.js може не використовувати slide panel на mobile
- Може відкриватися як desktop dropdown

**Рішення:**
- Адаптувати NotificationDropdown.js
- Додати mobile detection
- Використовувати slide panel замість dropdown

---

### 7. PLANNER TOGGLES - СЕЛЕКТОРИ МОЖУТЬ НЕ ПРАЦЮВАТИ
**Проблема:**
- CSS має селектори типу `.toggle-switch`, `.form-switch`
- Але реальні компоненти можуть використовувати інші класи
- Toggles можуть залишитися сірими замість зелених

**Рішення:**
- Знайти всі toggle компоненти
- Перевірити їх класи
- Додати відсутні селектори

---

### 8. FORMS - CONFLICT З TAILWIND
**Проблема:**
- mobile-forms.css має стилі для input/textarea/select
- Tailwind також стилізує ці елементи
- Може бути conflict і !important не спрацює

**Рішення:**
- Збільшити specificity селекторів
- Або використовувати @layer utilities

---

### 9. Z-INDEX CONFLICTS
**Проблема:**
- Bottom nav: z-index 1000
- Header: z-index 50
- Modals: z-index 10000
- Toast в Dashboard: z-index 1200
- Може бути конфлікт коли відкрито кілька елементів

**Рішення:**
- Стандартизувати z-index scale
- Bottom nav: 1000
- Header: 1010
- Notification panel: 9998-9999
- Menu modal: 9998-9999
- Event modal: 10000-10001
- Toast: 10010

---

### 10. SAFE AREAS - НЕКОРЕКТНО
**Проблема:**
- `padding-bottom: calc(8px + env(safe-area-inset-bottom))`
- На Android env() не працює - падає до 8px
- На iPhone з Dynamic Island може бути недостатньо

**Рішення:**
- Додати fallback: `padding-bottom: 8px;`
- Потім: `padding-bottom: calc(8px + env(safe-area-inset-bottom, 0));`

---

### 11. TOUCH TARGETS - МЕНШЕ 44PX
**Проблема:**
- В mobile-calendar.css кнопки 40px
- Apple HIG рекомендує мінімум 44px
- В mobile-messenger.css також 36px buttons

**Рішення:**
- Всі touch targets мінімум 44x44px
- Icon-only buttons: 44px
- Text buttons: мінімум 44px height

---

### 12. FONT SIZE - iOS ZOOM
**Проблема:**
- Деякі inputs можуть не мати `font-size: 16px !important`
- iOS автоматично zoom in якщо font < 16px
- Погана UX

**Рішення:**
- Всі inputs: `font-size: 16px !important`
- Textarea: `font-size: 16px !important`
- Select: `font-size: 16px !important`

---

### 13. HORIZONTAL SCROLL - НЕ ВИДНО
**Проблема:**
- Calendar glance, notification filters - horizontal scroll
- Але немає scroll indicators
- Користувач може не знати що можна scroll

**Рішення:**
- Додати fade gradient на краях
- Або додати scroll indicators (dots)

---

### 14. ANIMATIONS - TOO SLOW
**Проблема:**
- Modal slide-up: 0.4s - занадто повільно
- Menu slide: 0.3s - нормально
- Transition на buttons: 0.2s - ок

**Рішення:**
- Modal animations: 0.3s максимум
- Buttons: 0.15s
- Hover states: 0.1s

---

### 15. LOADING STATES - ВІДСУТНІ
**Проблема:**
- Немає loading spinners на mobile
- Skeleton screens відсутні
- Користувач не розуміє що відбувається

**Рішення:**
- Додати loading spinners
- Skeleton screens для lists
- Pull-to-refresh indicators

---

### 16. ERROR STATES - ПОГАНО ВИДНО
**Проблема:**
- Error borders на inputs можуть бути слабкі
- Error messages малі
- На яскравому екрані не видно

**Рішення:**
- Error border: 2px solid #ef4444
- Error message: 14px bold
- Error icon поруч з input

---

### 17. DARK MODE - НЕ ПІДТРИМУЄТЬСЯ
**Проблема:**
- Всі стилі тільки для light mode
- @media (prefers-color-scheme: dark) відсутнє
- Користувачі з dark mode системи бачать білий екран

**Рішення:**
- Додати dark mode variables
- Або поки що force light mode
- Або використовувати system colors

---

### 18. KEYBOARD - ПЕРЕКРИВАЄ КОНТЕНТ
**Проблема:**
- На iOS клавіатура з'являється і перекриває inputs
- Scroll може не працювати правильно
- Submit button може бути під клавіатурою

**Рішення:**
- `window.visualViewport` API
- Або `scrollIntoView()` на focus
- Або padding-bottom коли keyboard visible

---

### 19. PULL TO REFRESH - НЕ РЕАЛІЗОВАНО
**Проблема:**
- Native мобільна UX передбачає pull-to-refresh
- Зараз немає такої функції
- Користувач повинен manually refresh

**Рішення:**
- Додати pull-to-refresh на lists
- Calendar, Messages, Notifications, Kanban

---

### 20. GESTURES - НЕ ПІДТРИМУЮТЬСЯ
**Проблема:**
- Swipe-to-delete на items
- Swipe-to-close modals
- Pinch-to-zoom де потрібно
- Все відсутнє

**Рішення:**
- Swipe на notification items → delete/archive
- Swipe на modal → close
- Swipe на calendar → next/prev day

---

## СЕРЕДНІ ПРОБЛЕМИ:

### 21. SCROLL PERFORMANCE
- `-webkit-overflow-scrolling: touch` додано
- Але може бути lag на старих пристроях
- Потрібно `will-change: transform`

### 22. IMAGE OPTIMIZATION
- Якщо є images, немає lazy loading
- Немає responsive images
- Немає WebP fallback

### 23. OFFLINE SUPPORT
- Немає offline indicators
- Немає cached data
- Немає service worker

### 24. ACCESSIBILITY
- ARIA labels можуть бути відсутні
- Focus management погано
- Screen reader support weak

---

## PRIORITY FIX LIST:

**P0 - БЛОКЕРИ (зараз не працює):**
1. Header menu не full-screen
2. Bottom nav overflow (7 items)
3. Event modal класи не застосовуються

**P1 - КРИТИЧНО (погана UX):**
4. Touch targets < 44px
5. iOS zoom на inputs
6. Z-index conflicts
7. Safe areas fallback

**P2 - ВАЖЛИВО (покращення):**
8. Animations speed
9. Loading states
10. Error visibility
11. Keyboard handling

**P3 - NICE TO HAVE:**
12. Pull to refresh
13. Gestures
14. Dark mode
15. Offline support
