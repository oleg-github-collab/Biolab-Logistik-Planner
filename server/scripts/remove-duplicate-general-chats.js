const { pool } = require('../config/database');
const logger = require('../utils/logger');

async function removeDuplicateGeneralChats() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Searching for general chats...');
    
    // Find all general chats
    const generalChatsResult = await client.query(`
      SELECT id, name, created_at, 
             (SELECT COUNT(*) FROM message_conversation_members WHERE conversation_id = mc.id) as member_count,
             (SELECT COUNT(*) FROM messages WHERE conversation_id = mc.id) as message_count
      FROM message_conversations mc
      WHERE LOWER(name) LIKE '%allgemein%'
         OR LOWER(name) LIKE '%general%'
      ORDER BY created_at ASC
    `);

    if (generalChatsResult.rows.length === 0) {
      console.log('❌ No general chats found!');
      return;
    }

    if (generalChatsResult.rows.length === 1) {
      console.log('✅ Only one general chat exists - no duplicates to remove!');
      const chat = generalChatsResult.rows[0];
      console.log('   Chat: "' + chat.name + '" (ID: ' + chat.id + ')');
      console.log('   Members: ' + chat.member_count + ', Messages: ' + chat.message_count);
      return;
    }

    console.log('\n📋 Found ' + generalChatsResult.rows.length + ' general chats:');
    generalChatsResult.rows.forEach((chat, index) => {
      console.log('   ' + (index + 1) + '. "' + chat.name + '" (ID: ' + chat.id + ')');
      console.log('      Created: ' + chat.created_at);
      console.log('      Members: ' + chat.member_count + ', Messages: ' + chat.message_count);
    });

    // Keep the one with most messages, or if equal, the oldest one
    const keepChat = generalChatsResult.rows.reduce((best, current) => {
      if (current.message_count > best.message_count) return current;
      if (current.message_count === best.message_count && current.created_at < best.created_at) return current;
      return best;
    });

    const chatsToDelete = generalChatsResult.rows.filter(chat => chat.id !== keepChat.id);

    console.log('\n✅ Keeping: "' + keepChat.name + '" (ID: ' + keepChat.id + ')');
    console.log('   Reason: ' + keepChat.message_count + ' messages, created ' + keepChat.created_at);

    if (chatsToDelete.length === 0) {
      console.log('\n✅ No duplicates to delete!');
      return;
    }

    console.log('\n🗑️  Deleting ' + chatsToDelete.length + ' duplicate chat(s):');
    
    for (const chat of chatsToDelete) {
      console.log('   Deleting "' + chat.name + '" (ID: ' + chat.id + ')...');
      
      // Delete messages first
      await client.query('DELETE FROM messages WHERE conversation_id = $1', [chat.id]);
      
      // Delete members
      await client.query('DELETE FROM message_conversation_members WHERE conversation_id = $1', [chat.id]);
      
      // Delete conversation
      await client.query('DELETE FROM message_conversations WHERE id = $1', [chat.id]);
      
      console.log('   ✓ Deleted successfully');
    }

    console.log('\n✅ Cleanup complete! Kept "' + keepChat.name + '", deleted ' + chatsToDelete.length + ' duplicate(s).');

  } catch (error) {
    console.error('❌ Error removing duplicate general chats:', error);
    logger.error('Error removing duplicate general chats', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
removeDuplicateGeneralChats();
