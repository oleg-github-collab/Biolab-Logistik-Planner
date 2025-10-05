const http = require('http');
const WebSocket = require('ws');

const SERVER_URL = 'http://localhost:5000';
const WS_URL = 'ws://localhost:5000';

console.log('🧪 Тестування системи Biolab Logistik Planner\n');
console.log('='.repeat(50));

// Перевірка HTTP сервера
function testHTTPServer() {
  return new Promise((resolve, reject) => {
    console.log('\n📡 Перевірка HTTP сервера...');

    http.get(`${SERVER_URL}/api/health`, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ HTTP сервер працює');
          console.log(`   Status: ${res.statusCode}`);
          resolve();
        } else {
          console.log('❌ HTTP сервер повернув помилку');
          reject(new Error(`Status: ${res.statusCode}`));
        }
      });
    }).on('error', (err) => {
      console.log('❌ Не вдалося підключитися до HTTP сервера');
      console.log(`   Помилка: ${err.message}`);
      reject(err);
    });
  });
}

// Перевірка WebSocket сервера
function testWebSocketServer() {
  return new Promise((resolve, reject) => {
    console.log('\n🔌 Перевірка WebSocket сервера...');

    const ws = new WebSocket(WS_URL);
    let timeout;

    ws.on('open', () => {
      console.log('✅ WebSocket з\'єднання встановлено');
      clearTimeout(timeout);
      ws.close();
      resolve();
    });

    ws.on('error', (err) => {
      console.log('❌ Не вдалося підключитися до WebSocket сервера');
      console.log(`   Помилка: ${err.message}`);
      clearTimeout(timeout);
      reject(err);
    });

    // Таймаут через 5 секунд
    timeout = setTimeout(() => {
      console.log('❌ Таймаут підключення до WebSocket');
      ws.close();
      reject(new Error('Connection timeout'));
    }, 5000);
  });
}

// Перевірка бази даних
function testDatabase() {
  return new Promise((resolve, reject) => {
    console.log('\n💾 Перевірка підключення до бази даних...');

    const sqlite3 = require('sqlite3').verbose();
    const path = require('path');

    const dbPath = path.join(__dirname, '..', '..', 'data', 'biolab.db');
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.log('❌ Помилка підключення до бази даних');
        console.log(`   Помилка: ${err.message}`);
        reject(err);
      } else {
        console.log('✅ Підключення до бази даних успішне');

        // Перевірка таблиць
        db.all(`SELECT name FROM sqlite_master WHERE type='table'`, (err, tables) => {
          if (err) {
            console.log('❌ Помилка отримання списку таблиць');
            reject(err);
          } else {
            console.log(`✅ Знайдено ${tables.length} таблиць:`);
            tables.forEach(table => {
              console.log(`   - ${table.name}`);
            });
            db.close();
            resolve();
          }
        });
      }
    });
  });
}

// Запуск всіх тестів
async function runTests() {
  try {
    await testDatabase();

    console.log('\n⏳ Очікування запуску серверів...');
    console.log('   Переконайтесь, що сервер запущено командою: npm run dev\n');

    // Пауза для запуску сервера
    await new Promise(resolve => setTimeout(resolve, 2000));

    await testHTTPServer();
    await testWebSocketServer();

    console.log('\n' + '='.repeat(50));
    console.log('✨ Всі тести пройдено успішно!');
    console.log('='.repeat(50) + '\n');

    console.log('📋 Наступні кроки:');
    console.log('   1. Запустіть клієнт: cd client && npm start');
    console.log('   2. Відкрийте браузер: http://localhost:3000');
    console.log('   3. Увійдіть з обліковими даними admin');
    console.log('\n');

  } catch (error) {
    console.log('\n' + '='.repeat(50));
    console.log('❌ Тести не пройдено');
    console.log('='.repeat(50) + '\n');
    console.log('💡 Переконайтесь, що:');
    console.log('   - Сервер запущено: cd server && npm run dev');
    console.log('   - Порт 5000 вільний');
    console.log('   - База даних існує');
    console.log('\n');
    process.exit(1);
  }
}

runTests();
