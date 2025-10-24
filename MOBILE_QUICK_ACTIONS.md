# 📱 Mobile Quick Actions System
## Smart Input System for Logistics

**Версія**: 3.0 - Mobile First
**Дата**: 19 Жовтня 2025

---

## 🎯 Огляд

Потужна система швидкого введення даних, оптимізована для мобільних пристроїв з:
- ⚡ **Quick Actions** - миттєвий доступ до всіх функцій
- 🎤 **Voice Input** - голосове введення для часу та завдань
- 🗑️ **Smart Waste System** - повна класифікація сміття згідно з європейськими стандартами
- 📋 **Templates** - шаблони для частих операцій
- 👆 **Swipe Gestures** - свайпи для навігації

---

## 🧬 Система Класифікації Сміття

### Файл: `client/src/data/wasteClassification.js`

#### Категорії (7):
1. **Biological** 🧬 - Біологічні відходи (критичний рівень)
2. **Chemical** 🧪 - Хімічні відходи (високий рівень)
3. **Sharps** 💉 - Гострі предмети (критичний рівень)
4. **Pharmaceutical** 💊 - Фармацевтичні (середній рівень)
5. **Radioactive** ☢️ - Радіоактивні (критичний рівень)
6. **General** 🗑️ - Загальні (низький рівень)
7. **Recyclable** ♻️ - Перероблювані (без небезпеки)

#### Коди Сміття (18 типів):

**Біологічне сміття (AS18):**
- `AS180101` - Гострі предмети (канюлі, скальпелі)
- `AS180102` - Частини тіла та органи
- `AS180103` - Інфекційні відходи
- `AS180104` - Неінфекційні відходи

**Хімічне сміття (AS16, AS14):**
- `AS160504` - Небезпечні гази
- `AS160506` - Лабораторні хімікати
- `AS140601` - Галогеновані розчинники
- `AS140602` - Негалогеновані розчинники

**Фармацевтичне сміття (AS18):**
- `AS180205` - Цитостатики (хіміотерапія)
- `AS180206` - Інші медикаменти

**Радіоактивне сміття:**
- `AS180103S` - Радіоактивно заражені матеріали

**Перероблюване:**
- `AS150101` - Папір і картон
- `AS150102` - Пластикова упаковка
- `AS150107` - Скляна упаковка

### Властивості Кожного Коду:

```javascript
{
  code: 'AS180103',
  category: 'biological',
  name: 'Infektiöse Abfälle',
  description: 'З кров'ю/тіловими рідинами',
  containerType: 'yellow-bag',
  disposalMethod: 'autoclave-incineration',
  requiresAutoclave: true,
  maxStorageDays: 7,
  hazardSymbols: ['biohazard'],
  color: '#FBBF24'
}
```

### Типи Контейнерів (8):

1. **Sharps Container** - Контейнер для голок (2L)
2. **Yellow Bag** - Жовтий мішок для інфекційних (60L)
3. **Sealed Bag** - Герметичний мішок (30L)
4. **Chemical Container** - Хімічний контейнер (20L)
5. **Solvent Container** - Контейнер для розчинників (20L)
6. **Cytotoxic Container** - Цитостатики (10L)
7. **Lead Container** - Свинцевий контейнер (5L)
8. **Standard Bag** - Стандартний мішок (120L)

### Методи Утилізації (7):

1. **Autoclave + Incineration** - Автоклав + спалювання
2. **Incineration** - Пряме спалювання >1000°C
3. **High-temp Incineration** - >1200°C
4. **Chemical Treatment** - Хімічна обробка
5. **Radioactive Disposal** - Радіоактивне захоронення
6. **Recycling** - Переробка
7. **Standard Disposal** - Стандартна утилізація

### Символи Небезпеки (9):

- ☣️ **Biohazard** - Біологічна небезпека
- ☢️ **Radioactive** - Радіоактивність
- ☠️ **Toxic** - Токсично
- 🧪 **Corrosive** - Їдке
- 🔥 **Flammable** - Займисте
- 💨 **Compressed Gas** - Стиснений газ
- 💉 **Sharp** - Гостре
- ⚠️ **Carcinogenic** - Канцерогенне
- 🌍 **Environmental** - Екологічно небезпечне

---

## 📱 Компоненти Quick Actions

### 1. Mobile Quick Actions
**Файл**: `client/src/components/MobileQuickActions.js`

#### Особливості:
- **3 вкладки**: Час, Завдання, Сміття
- **Swipe навігація**: Гортання між вкладками
- **Quick buttons**: 3 швидкі кнопки на вкладку
- **Drag handle**: Візуальна ручка для закриття
- **Bottom sheet**: Висувна панель знизу

#### Використання:
```javascript
<MobileQuickActions
  onClose={() => setShowQuickActions(false)}
/>
```

---

### 2. Smart Time Entry
**Файл**: `client/src/components/SmartTimeEntry.js`

#### 3 Режими:
1. **Quick Mode** ⚡
   - Шаблони змін (ранкова, денна, вечірня, нічна)
   - Швидкий вибір тривалості (4h, 6h, 8h, 10h, 12h)
   - Типи: Робота, Перерва, Понаднормово

2. **Detailed Mode** 📝
   - Вибір дати
   - Час початку/кінця
   - Проект/Задача
   - Опис

3. **Voice Mode** 🎤 (якщо підтримується)
   - Автоматичне розпізнавання мови (німецька)
   - Парсинг команд: "8 Stunden gearbeitet"
   - Визначення типу: "Pause", "Überstunden"
   - Проект з голосу: "Projekt Labor Analyse"

#### Шаблони Змін:
- 🌅 **Frühschicht**: 06:00 - 14:00
- ☀️ **Tagschicht**: 08:00 - 16:00
- 🌆 **Spätschicht**: 14:00 - 22:00
- 🌙 **Nachtschicht**: 22:00 - 06:00

#### Використання:
```javascript
<SmartTimeEntry
  onSave={(data) => {
    // data: { type, startTime, endTime, date, description, project }
    console.log('Time entry:', data);
  }}
/>
```

---

### 3. Quick Task Entry
**Файл**: `client/src/components/QuickTaskEntry.js`

#### Шаблони Завдань (6):
1. 🧪 **Probenkontrolle** - Контроль проб (високий пріоритет)
2. 📦 **Bestandsaufnahme** - Інвентаризація (середній)
3. 🧹 **Reinigung** - Прибирання (низький)
4. 📝 **Dokumentation** - Документація (середній)
5. ✓ **Qualitätskontrolle** - Контроль якості (високий)
6. ♻️ **Abfallentsorgung** - Утилізація (високий)

#### Пріоритети (4):
- ⬇️ **Niedrig** (Low)
- ➡️ **Mittel** (Medium)
- ⬆️ **Hoch** (High)
- 🔥 **Dringend** (Urgent)

#### Терміни (4):
- 📅 **Heute** - Сьогодні
- 🌅 **Morgen** - Завтра
- 📆 **Diese Woche** - Цього тижня (+7 днів)
- 🗓️ **Nächste Woche** - Наступного тижня (+14 днів)

#### Використання:
```javascript
<QuickTaskEntry
  onSave={(data) => {
    // data: { title, priority, dueDate, category, assignee }
    console.log('Task created:', data);
  }}
/>
```

---

### 4. Quick Waste Entry
**Файл**: `client/src/components/QuickWasteEntry.js`

#### 4 Режими:
1. **Quick Mode** - Найпопулярніше сміття (6 типів)
2. **Category Mode** - Перегляд за категоріями
3. **Search Mode** - Пошук по коду/назві
4. **Details Mode** - Введення деталей

#### Процес Введення:

##### Крок 1: Вибір Типу Сміття
- Швидкий вибір з популярних
- Пошук по коду/назві
- Перегляд по категоріях

##### Крок 2: Деталі
- **Кількість**: Цифрове введення
- **Одиниця**: kg, L, Stück, Beutel
- **Контейнер**: Автоматично згідно з типом
- **Дата утилізації**: Date picker
- **Нотатки**: Опціонально

##### Крок 3: Попередження
- Максимальний час зберігання
- Символи небезпеки
- Вимоги до контейнера

#### Використання:
```javascript
<QuickWasteEntry
  onSave={(data) => {
    // data: {
    //   wasteCode, wasteName, amount, unit,
    //   container, disposalDate, notes,
    //   category, hazardLevel
    // }
    console.log('Waste entry:', data);
  }}
/>
```

---

### 5. Floating Action Button
**Файл**: `client/src/components/FloatingActionButton.js`

#### Поведінка:

**Mobile** (< 768px):
- Одна кнопка з **+**
- Клік → відкриває MobileQuickActions

**Desktop** (≥ 768px):
- Головна кнопка з **+**
- Клік → розгортає меню
- 3 підкнопки з лейблами
- Overlay для закриття

#### Особливості:
- **Pulse animation** при завантаженні
- **Smooth transitions** при відкритті
- **Escape key** для закриття
- **Fixed position**: bottom-right
- **Z-index**: 40 (вище контенту)

#### Інтеграція:
```javascript
import FloatingActionButton from './components/FloatingActionButton';

function App() {
  return (
    <>
      {/* Your app content */}
      <FloatingActionButton />
    </>
  );
}
```

---

## 🎨 UX Features

### Swipe Gestures:
- **Swipe Left**: Наступна вкладка
- **Swipe Right**: Попередня вкладка
- **Vertical Swipe**: Закрити панель

### Touch Optimizations:
- **Min touch target**: 44x44px
- **Active states**: Scale feedback
- **No zoom**: 16px font size
- **Smooth scrolling**: Kinetic scrolling

### Animations:
- **Slide Up**: Bottom sheet appearance
- **Slide In Right**: FAB menu items
- **Fade In**: Overlays
- **Scale**: Button press feedback
- **Ping**: FAB attention animation

---

## 📊 API Integration

### Приклад: Збереження Часу

```javascript
const saveTimeEntry = async (data) => {
  try {
    const response = await fetch('/api/time-tracking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        userId: user.id,
        type: data.type,
        startTime: data.startTime,
        endTime: data.endTime,
        date: data.date,
        project: data.project,
        description: data.description,
        createdAt: new Date().toISOString()
      })
    });

    if (!response.ok) throw new Error('Failed');

    const result = await response.json();
    showSuccess('Zeit erfasst!');
    return result;
  } catch (error) {
    showError('Fehler beim Speichern');
    // Add to offline queue
    offlineQueue.enqueue({
      type: 'time-entry',
      data
    });
  }
};
```

### Приклад: Збереження Сміття

```javascript
const saveWasteEntry = async (data) => {
  const waste = WASTE_CODES[data.wasteCode];

  try {
    const response = await fetch('/api/waste', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        wasteCode: data.wasteCode,
        wasteName: waste.name,
        category: waste.category,
        amount: parseFloat(data.amount),
        unit: data.unit,
        containerType: data.container,
        disposalDate: data.disposalDate,
        disposalMethod: waste.disposalMethod,
        requiresAutoclave: waste.requiresAutoclave,
        maxStorageDays: waste.maxStorageDays,
        hazardSymbols: waste.hazardSymbols,
        notes: data.notes,
        createdBy: user.id,
        createdAt: new Date().toISOString()
      })
    });

    if (!response.ok) throw new Error('Failed');

    const result = await response.json();

    // Log to audit
    auditLogger.logDataChange(
      'create',
      user.id,
      'waste',
      result.id,
      { wasteCode: data.wasteCode, amount: data.amount }
    );

    showSuccess('Abfall erfasst!');
    return result;
  } catch (error) {
    showError('Fehler beim Speichern');
  }
};
```

---

## ✅ Готово до Використання!

### Створені Файли:

1. **`client/src/data/wasteClassification.js`**
   - 7 категорій сміття
   - 18 кодів відходів
   - 8 типів контейнерів
   - 7 методів утилізації
   - 9 символів небезпеки

2. **`client/src/components/MobileQuickActions.js`**
   - Bottom sheet панель
   - Swipe навігація
   - 3 вкладки

3. **`client/src/components/SmartTimeEntry.js`**
   - 3 режими введення
   - Voice input
   - 4 шаблони змін
   - 5 швидких тривалостей

4. **`client/src/components/QuickTaskEntry.js`**
   - 6 шаблонів завдань
   - 4 рівні пріоритету
   - 4 швидкі терміни
   - Voice button

5. **`client/src/components/QuickWasteEntry.js`**
   - 4 режими вибору
   - Smart search
   - Category browse
   - Automatic container selection
   - Hazard warnings

6. **`client/src/components/FloatingActionButton.js`**
   - Адаптивна поведінка
   - Desktop menu
   - Mobile modal
   - Animations

---

## 🎯 Переваги Системи

### Для Користувачів:
- ⚡ **Швидко**: 3 кліки до введення даних
- 🎤 **Голос**: Hands-free введення
- 📱 **Мобільно**: Оптимізовано для телефонів
- 🎨 **Зрозуміло**: Іконки + кольори
- ✓ **Безпечно**: Перевірка коректності даних

### Для Логістики:
- 🗑️ **Повна класифікація**: Європейські стандарти
- ⚠️ **Безпека**: Символи + попередження
- 📊 **Контроль**: Терміни зберігання
- 📦 **Контейнери**: Автоматичний вибір
- ♻️ **Методи**: Правильна утилізація

### Для Адмінів:
- 📝 **Audit trail**: Всі дії логуються
- 📊 **Статистика**: По категоріям
- 🔍 **Пошук**: По кодам та назвам
- 📱 **Доступність**: З будь-якого пристрою

---

**Generated by Claude Code**
**Date**: 2025-10-19
**Version**: 3.0 - Mobile First & Smart Waste System
