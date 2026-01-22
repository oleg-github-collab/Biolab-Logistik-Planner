#!/usr/bin/env node

/**
 * Database Cleanup Script
 * Залишає лише бота та суперадміна, видаляє всі інші дані
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function cleanupDatabase() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('🧹 Починаю очищення бази даних...\n');

    // 1. Знайти ID бота та суперадміна
    const botResult = await client.query(
      "SELECT id, name, email FROM users WHERE email ILIKE '%bot%' OR name ILIKE '%bot%' ORDER BY id LIMIT 1"
    );
    const adminResult = await client.query(
      "SELECT id, name, email FROM users WHERE role IN ('super_admin', 'superadmin', 'admin') ORDER BY id LIMIT 1"
    );

    const botId = botResult.rows[0]?.id;
    const adminId = adminResult.rows[0]?.id;

    console.log('🔍 Знайдено бота:', botResult.rows[0]);
    console.log('🔍 Знайдено адміна:', adminResult.rows[0]);

    if (!botId || !adminId) {
      // Якщо не знайдено, виведемо всіх користувачів
      const allUsers = await client.query('SELECT id, name, email, role FROM users ORDER BY id');
      console.log('\n📋 Всі користувачі в БД:');
      console.table(allUsers.rows);
      throw new Error('❌ Не знайдено бота або суперадміна!');
    }

    console.log(`✅ Знайдено бота (ID: ${botId}) та суперадміна (ID: ${adminId})\n`);

    // Helper для безпечного видалення (без транзакції)
    const safeDelete = async (tableName) => {
      try {
        // Перевіряємо чи існує таблиця
        const checkTable = await client.query(
          `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`,
          [tableName]
        );
        if (!checkTable.rows[0].exists) {
          console.log(`   ⚠️  Таблиця ${tableName} не існує, пропускаю`);
          return 0;
        }
        const result = await client.query(`DELETE FROM ${tableName}`);
        return result.rowCount;
      } catch (err) {
        console.error(`   ❌ Помилка при видаленні з ${tableName}:`, err.message);
        return 0;
      }
    };

    // 2. Видалити всі повідомлення та розмови
    console.log('🗑️  Видалення повідомлень...');
    let count = 0;
    count += await safeDelete('message_read_status');
    count += await safeDelete('messages');
    count += await safeDelete('message_conversation_members');
    count += await safeDelete('message_conversations');
    console.log(`   ✓ Видалено ${count} записів з повідомлень\n`);

    // 3. Видалити всі stories
    console.log('🗑️  Видалення stories...');
    count = 0;
    count += await safeDelete('user_story_views');
    count += await safeDelete('user_stories');
    console.log(`   ✓ Видалено ${count} stories\n`);

    // 4. Видалити всі статті та FAQ
    console.log('🗑️  Видалення статей та FAQ...');
    count = 0;
    count += await safeDelete('knowledge_base_articles');
    count += await safeDelete('faqs');
    console.log(`   ✓ Видалено ${count} статей\n`);

    // 5. Видалити всі таски, проекти, календарі
    console.log('🗑️  Видалення тасків та проектів...');
    count = 0;
    count += await safeDelete('tasks');
    count += await safeDelete('projects');
    count += await safeDelete('calendar_events');
    console.log(`   ✓ Видалено ${count} тасків/проектів\n`);

    // 6. Видалити notifications
    console.log('🗑️  Видалення сповіщень...');
    count = await safeDelete('notifications');
    console.log(`   ✓ Видалено ${count} сповіщень\n`);

    // 7. Видалити всіх користувачів КРІМ бота та адміна
    console.log('🗑️  Видалення користувачів (крім бота та адміна)...');
    const deleteResult = await client.query(
      'DELETE FROM users WHERE id NOT IN ($1, $2) RETURNING id, name, email',
      [botId, adminId]
    );
    console.log(`   ✓ Видалено ${deleteResult.rowCount} користувачів\n`);

    // 8. Скинути лічильники (якщо колонка існує)
    console.log('🔄 Перевірка лічильників...');
    const checkUnread = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'users' AND column_name = 'unread_count'`
    );
    if (checkUnread.rows.length > 0) {
      await client.query(
        'UPDATE users SET unread_count = 0 WHERE id IN ($1, $2)',
        [botId, adminId]
      );
      console.log('   ✓ Лічильники скинуто\n');
    } else {
      console.log('   ⚠️  Колонка unread_count не існує\n');
    }

    await client.query('COMMIT');

    console.log('✨ База даних успішно очищена!\n');
    console.log('📊 Залишилось:');
    console.log(`   - Бот (ID: ${botId})`);
    console.log(`   - Суперадмін (ID: ${adminId})`);
    console.log('   - Всі інші дані видалено\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Помилка при очищенні бази даних:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Запуск з підтвердженням
if (require.main === module) {
  console.log('\n⚠️  УВАГА! Це видалить всі дані крім бота та суперадміна!\n');
  console.log('Запуск через 3 секунди... (Ctrl+C для скасування)\n');

  setTimeout(() => {
    cleanupDatabase()
      .then(() => {
        console.log('✅ Готово!');
        process.exit(0);
      })
      .catch((error) => {
        console.error('❌ Помилка:', error.message);
        process.exit(1);
      });
  }, 3000);
}

module.exports = cleanupDatabase;
