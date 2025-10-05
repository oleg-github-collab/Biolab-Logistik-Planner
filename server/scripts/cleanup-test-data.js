const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'data', 'biolab.db');
const db = new sqlite3.Database(dbPath);

console.log('🧹 Очищення тестових даних...\n');

db.serialize(() => {
  // Видалити тестові повідомлення
  db.run('DELETE FROM messages WHERE id > 0', function(err) {
    if (err) {
      console.error('❌ Помилка видалення повідомлень:', err);
    } else {
      console.log(`✅ Видалено ${this.changes} повідомлень`);
    }
  });

  // Видалити тестові завдання
  db.run('DELETE FROM tasks WHERE id > 0', function(err) {
    if (err) {
      console.error('❌ Помилка видалення завдань:', err);
    } else {
      console.log(`✅ Видалено ${this.changes} завдань`);
    }
  });

  // Видалити тестові події календаря (якщо таблиця існує)
  db.run('DELETE FROM calendar_events WHERE id > 0', function(err) {
    if (err && !err.message.includes('no such table')) {
      console.error('❌ Помилка видалення подій:', err.message);
    } else if (!err) {
      console.log(`✅ Видалено ${this.changes} подій календаря`);
    }
  });

  // Видалити тестові графіки відходів (окрім активних, якщо таблиця існує)
  db.run('DELETE FROM waste_schedules WHERE status = "draft"', function(err) {
    if (err && !err.message.includes('no such table')) {
      console.error('❌ Помилка видалення графіків відходів:', err.message);
    } else if (!err) {
      console.log(`✅ Видалено ${this.changes} чернеток графіків відходів`);
    }
  });

  // Залишити тільки admin користувача
  db.run('DELETE FROM users WHERE id > 1', function(err) {
    if (err) {
      console.error('❌ Помилка видалення користувачів:', err);
    } else {
      console.log(`✅ Видалено ${this.changes} тестових користувачів`);
    }
  });

  // Скинути AUTO_INCREMENT для всіх таблиць
  const tables = ['messages', 'tasks', 'calendar_events', 'waste_schedules'];

  tables.forEach(table => {
    db.run(`DELETE FROM sqlite_sequence WHERE name='${table}'`, (err) => {
      if (err && !err.message.includes('no such table')) {
        console.error(`❌ Помилка скидання AUTO_INCREMENT для ${table}:`, err);
      }
    });
  });

  console.log('\n✨ Очищення завершено!');
  console.log('📊 База даних готова до використання\n');
});

db.close((err) => {
  if (err) {
    console.error('Помилка закриття з\'єднання:', err);
  }
});
