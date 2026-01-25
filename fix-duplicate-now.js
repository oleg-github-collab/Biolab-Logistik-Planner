const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

(async () => {
  try {
    console.log('🔍 Шукаю дублікати чатів...');

    const chats = await pool.query(`
      SELECT id, name, created_at,
             (SELECT COUNT(*) FROM message_conversation_members WHERE conversation_id = message_conversations.id) as members,
             (SELECT COUNT(*) FROM messages WHERE conversation_id = message_conversations.id) as messages
      FROM message_conversations
      WHERE LOWER(name) LIKE '%allgemein%' OR LOWER(name) LIKE '%general%'
      ORDER BY created_at ASC
    `);

    console.log(`\n📊 Знайдено чатів: ${chats.rows.length}`);
    chats.rows.forEach((c, i) => {
      console.log(`${i + 1}. ID: ${c.id}, Name: "${c.name}", Created: ${c.created_at}, Members: ${c.members}, Messages: ${c.messages}`);
    });

    if (chats.rows.length < 2) {
      console.log('\n✅ Немає дублікатів!');
      await pool.end();
      process.exit(0);
    }

    const keep = chats.rows[0];
    console.log(`\n📌 ЗАЛИШАЮ: ID ${keep.id} (created ${keep.created_at})`);

    for (let i = 1; i < chats.rows.length; i++) {
      const del = chats.rows[i];
      console.log(`\n🗑️  ВИДАЛЯЮ: ID ${del.id} (created ${del.created_at})`);

      await pool.query('DELETE FROM messages WHERE conversation_id = $1', [del.id]);
      await pool.query('DELETE FROM message_conversation_members WHERE conversation_id = $1', [del.id]);
      await pool.query('DELETE FROM message_conversations WHERE id = $1', [del.id]);

      console.log(`   ✅ Видалено chat ID ${del.id}`);
    }

    console.log('\n✅ ГОТОВО! Дублікати видалено.');
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ ПОМИЛКА:', err);
    await pool.end();
    process.exit(1);
  }
})();
