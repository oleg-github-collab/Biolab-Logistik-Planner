const pool = require('../config/database');
const logger = require('../utils/logger');

async function removeDuplicateGeneralChats() {
  try {
    logger.info('Starting duplicate general chat removal...');

    // Find all general chats
    const chats = await pool.query(`
      SELECT id, name, created_at,
             (SELECT COUNT(*) FROM message_conversation_members WHERE conversation_id = message_conversations.id) as member_count,
             (SELECT COUNT(*) FROM messages WHERE conversation_id = message_conversations.id) as message_count
      FROM message_conversations
      WHERE LOWER(name) LIKE '%allgemein%' OR LOWER(name) LIKE '%general%'
      ORDER BY created_at ASC
    `);

    console.log('\n=== Found General Chats ===');
    chats.rows.forEach((chat, idx) => {
      console.log(`${idx + 1}. ID: ${chat.id}, Name: "${chat.name}"`);
      console.log(`   Created: ${chat.created_at}`);
      console.log(`   Members: ${chat.member_count}, Messages: ${chat.message_count}`);
    });

    if (chats.rows.length < 2) {
      console.log('\n✅ No duplicates found - only one general chat exists');
      return;
    }

    // Keep the oldest (first one)
    const keepChat = chats.rows[0];
    console.log(`\n📌 KEEPING: Chat ID ${keepChat.id} (created ${keepChat.created_at})`);

    // Delete all newer duplicates
    let deletedCount = 0;
    for (let i = 1; i < chats.rows.length; i++) {
      const deleteChat = chats.rows[i];
      console.log(`\n🗑️  DELETING: Chat ID ${deleteChat.id} (created ${deleteChat.created_at})`);

      // Delete in correct order (foreign keys)
      const messagesDeleted = await pool.query('DELETE FROM messages WHERE conversation_id = $1', [deleteChat.id]);
      console.log(`   - Deleted ${messagesDeleted.rowCount} messages`);

      const membersDeleted = await pool.query('DELETE FROM message_conversation_members WHERE conversation_id = $1', [deleteChat.id]);
      console.log(`   - Deleted ${membersDeleted.rowCount} members`);

      await pool.query('DELETE FROM message_conversations WHERE id = $1', [deleteChat.id]);
      console.log(`   ✅ Deleted conversation ID ${deleteChat.id}`);

      deletedCount++;
    }

    console.log(`\n✅ COMPLETE: Deleted ${deletedCount} duplicate chat(s)`);
    console.log(`✅ Remaining: 1 general chat (ID ${keepChat.id})`);

  } catch (error) {
    logger.error('Error removing duplicate chats:', error);
    console.error('❌ ERROR:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run immediately
removeDuplicateGeneralChats()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
