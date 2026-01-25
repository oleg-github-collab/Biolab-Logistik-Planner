const { pool } = require('../config/database');
const logger = require('../utils/logger');

async function fixGeneralChat() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Searching for general chat...');
    
    // Find general chat
    const generalChatResult = await client.query(`
      SELECT id, name FROM message_conversations
      WHERE LOWER(name) LIKE '%allgemein%'
         OR LOWER(name) LIKE '%general%'
      LIMIT 1
    `);

    if (generalChatResult.rows.length === 0) {
      console.log('❌ General chat not found!');
      console.log('Please create it first from the messenger interface.');
      return;
    }

    const generalChat = generalChatResult.rows[0];
    console.log(`✅ Found general chat: "${generalChat.name}" (ID: ${generalChat.id})`);

    // Get all active users not in general chat
    const usersToAddResult = await client.query(`
      SELECT u.id, u.name, u.email, u.role
      FROM users u
      WHERE u.is_active = TRUE
        AND NOT EXISTS (
            SELECT 1
            FROM message_conversation_members mcm
            WHERE mcm.conversation_id = $1
              AND mcm.user_id = u.id
        )
    `, [generalChat.id]);

    if (usersToAddResult.rows.length === 0) {
      console.log('✅ All users are already in the general chat!');
      return;
    }

    console.log(`\n📝 Found ${usersToAddResult.rows.length} users to add:`);
    usersToAddResult.rows.forEach(u => {
      console.log(`   - ${u.name} (${u.email}) [${u.role}]`);
    });

    console.log('\n🔧 Adding users to general chat...');

    for (const user of usersToAddResult.rows) {
      await client.query(`
        INSERT INTO message_conversation_members (conversation_id, user_id, role, joined_at)
        VALUES ($1, $2, 'member', NOW())
        ON CONFLICT (conversation_id, user_id) DO NOTHING
      `, [generalChat.id, user.id]);

      console.log(`   ✓ Added ${user.name}`);
    }

    console.log(`\n✅ Successfully added ${usersToAddResult.rows.length} users to general chat!`);
    console.log('🔄 Please refresh your messenger to see the changes.');

  } catch (error) {
    console.error('❌ Error fixing general chat:', error);
    logger.error('Error fixing general chat', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
fixGeneralChat();
