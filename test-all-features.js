#!/usr/bin/env node

/**
 * Comprehensive Testing Script for Biolab Logistik Planner
 * Tests all critical features: Stories, Bot, Messenger, Calendar
 */

const axios = require('axios');
const { pool } = require('./server/config/database');
const colors = require('colors');

// Configuration
const BASE_URL = process.env.RAILWAY_URL || 'http://localhost:5000';
const API_URL = `${BASE_URL}/api`;

// Test results tracking
const testResults = {
  passed: [],
  failed: [],
  warnings: []
};

// Utility functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  switch(type) {
    case 'success':
      console.log(`✅ [${timestamp}] ${message}`.green);
      break;
    case 'error':
      console.log(`❌ [${timestamp}] ${message}`.red);
      break;
    case 'warning':
      console.log(`⚠️  [${timestamp}] ${message}`.yellow);
      break;
    case 'info':
      console.log(`ℹ️  [${timestamp}] ${message}`.cyan);
      break;
    case 'title':
      console.log(`\n${'='.repeat(60)}`.blue);
      console.log(`  ${message}`.blue.bold);
      console.log(`${'='.repeat(60)}\n`.blue);
      break;
  }
}

async function testDatabaseConnection() {
  log('DATABASE CONNECTION TEST', 'title');

  try {
    const result = await pool.query('SELECT NOW()');
    log('Database connection successful', 'success');
    testResults.passed.push('Database Connection');

    // Check critical tables
    const tables = ['users', 'user_stories', 'messages', 'events', 'tasks'];
    for (const table of tables) {
      try {
        const res = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        log(`Table ${table}: ${res.rows[0].count} records`, 'info');
      } catch (err) {
        log(`Table ${table} not found or accessible`, 'error');
        testResults.failed.push(`Table ${table}`);
      }
    }
  } catch (error) {
    log(`Database connection failed: ${error.message}`, 'error');
    testResults.failed.push('Database Connection');
  }
}

async function testStoriesFeature() {
  log('STORIES FEATURE TEST', 'title');

  try {
    // Check Stories table structure
    const schemaCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'user_stories'
      ORDER BY ordinal_position
    `);

    log('Stories table schema:', 'info');
    schemaCheck.rows.forEach(col => {
      log(`  ${col.column_name}: ${col.data_type} ${col.column_default ? `(default: ${col.column_default})` : ''}`, 'info');
    });

    // Check for UUID extension
    const uuidCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp'
      ) as has_uuid
    `);

    if (uuidCheck.rows[0].has_uuid) {
      log('UUID extension installed', 'success');
      testResults.passed.push('Stories UUID Setup');
    } else {
      log('UUID extension NOT installed - Stories creation will fail!', 'error');
      testResults.failed.push('Stories UUID Setup');
    }

    // Check for active stories
    const activeStories = await pool.query(`
      SELECT s.*, u.name as user_name
      FROM user_stories s
      JOIN users u ON s.user_id = u.id
      WHERE s.expires_at > NOW()
      LIMIT 5
    `);

    if (activeStories.rows.length > 0) {
      log(`Found ${activeStories.rows.length} active stories:`, 'success');
      activeStories.rows.forEach(story => {
        log(`  - ${story.user_name}: "${story.caption || 'No caption'}" (expires: ${story.expires_at})`, 'info');
      });
      testResults.passed.push('Stories Active');
    } else {
      log('No active stories found', 'warning');
      testResults.warnings.push('No active stories');
    }

    // Test Stories API endpoint
    try {
      const response = await axios.get(`${API_URL}/messages/stories`);
      log(`Stories API endpoint working: ${response.data.length} stories returned`, 'success');
      testResults.passed.push('Stories API');
    } catch (err) {
      log(`Stories API endpoint failed: ${err.message}`, 'error');
      testResults.failed.push('Stories API');
    }

  } catch (error) {
    log(`Stories feature test failed: ${error.message}`, 'error');
    testResults.failed.push('Stories Feature');
  }
}

async function testBLBot() {
  log('BL_BOT FUNCTIONALITY TEST', 'title');

  try {
    // Check if BL_Bot user exists
    const botCheck = await pool.query(`
      SELECT id, name, email, is_system_user, is_active
      FROM users
      WHERE email IN ('bl_bot@biolab.de', 'entsorgungsbot@biolab.de')
      AND is_system_user = true
    `);

    if (botCheck.rows.length > 0) {
      const bot = botCheck.rows[0];
      log(`BL_Bot user found: ${bot.name} (ID: ${bot.id})`, 'success');
      testResults.passed.push('BL_Bot User');

      // Check OpenAI configuration
      const hasKey = !!process.env.OPENAI_API_KEY;
      const isPlaceholder = process.env.OPENAI_API_KEY === 'sk-your-openai-api-key-here';

      if (!hasKey) {
        log('OpenAI API key NOT configured', 'error');
        testResults.failed.push('OpenAI Configuration');
      } else if (isPlaceholder) {
        log('OpenAI API key is still placeholder - Bot won\'t work properly!', 'error');
        testResults.failed.push('OpenAI Configuration');
      } else {
        log(`OpenAI API key configured (length: ${process.env.OPENAI_API_KEY.length})`, 'success');

        // Test OpenAI connection
        const OpenAI = require('openai');
        try {
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are a test bot. Reply with exactly: TEST_SUCCESS' },
              { role: 'user', content: 'Test' }
            ],
            max_tokens: 10
          });

          if (completion.choices[0].message.content.includes('TEST_SUCCESS')) {
            log('OpenAI API working correctly', 'success');
            testResults.passed.push('OpenAI API');
          } else {
            log('OpenAI API returned unexpected response', 'warning');
            testResults.warnings.push('OpenAI Response');
          }
        } catch (err) {
          log(`OpenAI API test failed: ${err.message}`, 'error');
          testResults.failed.push('OpenAI API');
        }
      }

      // Check recent bot messages
      const recentMessages = await pool.query(`
        SELECT COUNT(*) as count
        FROM messages
        WHERE sender_id = $1
        AND created_at > NOW() - INTERVAL '24 hours'
      `, [bot.id]);

      log(`Bot sent ${recentMessages.rows[0].count} messages in last 24 hours`, 'info');

    } else {
      log('BL_Bot user NOT found in database!', 'error');
      testResults.failed.push('BL_Bot User');
    }

  } catch (error) {
    log(`BL_Bot test failed: ${error.message}`, 'error');
    testResults.failed.push('BL_Bot');
  }
}

async function testMessenger() {
  log('MESSENGER FUNCTIONALITY TEST', 'title');

  try {
    // Check message conversations
    const conversations = await pool.query(`
      SELECT
        mc.id,
        mc.conversation_type,
        COUNT(DISTINCT mcm.user_id) as member_count,
        COUNT(m.id) as message_count
      FROM message_conversations mc
      LEFT JOIN message_conversation_members mcm ON mc.id = mcm.conversation_id
      LEFT JOIN messages m ON mc.id = m.conversation_id
      GROUP BY mc.id, mc.conversation_type
      LIMIT 10
    `);

    log(`Found ${conversations.rows.length} conversations:`, 'info');
    conversations.rows.forEach(conv => {
      log(`  - ${conv.conversation_type} (${conv.member_count} members, ${conv.message_count} messages)`, 'info');
    });

    if (conversations.rows.length > 0) {
      testResults.passed.push('Messenger Conversations');
    } else {
      testResults.warnings.push('No conversations found');
    }

    // Check WebSocket functionality
    try {
      const io = require('socket.io-client');
      const socket = io(BASE_URL, {
        transports: ['websocket'],
        timeout: 5000
      });

      await new Promise((resolve, reject) => {
        socket.on('connect', () => {
          log('WebSocket connection successful', 'success');
          testResults.passed.push('WebSocket');
          socket.disconnect();
          resolve();
        });

        socket.on('connect_error', (error) => {
          log(`WebSocket connection failed: ${error.message}`, 'error');
          testResults.failed.push('WebSocket');
          reject(error);
        });

        setTimeout(() => reject(new Error('WebSocket timeout')), 5000);
      });
    } catch (err) {
      log(`WebSocket test failed: ${err.message}`, 'warning');
      testResults.warnings.push('WebSocket');
    }

  } catch (error) {
    log(`Messenger test failed: ${error.message}`, 'error');
    testResults.failed.push('Messenger');
  }
}

async function testCalendarEvents() {
  log('CALENDAR & EVENTS TEST', 'title');

  try {
    // Check events table
    const upcomingEvents = await pool.query(`
      SELECT
        e.*,
        u.name as creator_name
      FROM events e
      JOIN users u ON e.created_by = u.id
      WHERE e.start_time > NOW()
      ORDER BY e.start_time
      LIMIT 5
    `);

    if (upcomingEvents.rows.length > 0) {
      log(`Found ${upcomingEvents.rows.length} upcoming events:`, 'success');
      upcomingEvents.rows.forEach(event => {
        log(`  - ${event.title} (${event.event_type}) on ${new Date(event.start_time).toLocaleDateString()}`, 'info');
      });
      testResults.passed.push('Calendar Events');
    } else {
      log('No upcoming events found', 'warning');
      testResults.warnings.push('No upcoming events');
    }

    // Check event participants
    const participantCount = await pool.query(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM event_participants
    `);

    log(`Total event participants: ${participantCount.rows[0].count}`, 'info');

  } catch (error) {
    log(`Calendar test failed: ${error.message}`, 'error');
    testResults.failed.push('Calendar');
  }
}

async function testMobileOptimization() {
  log('MOBILE OPTIMIZATION TEST', 'title');

  // Check if mobile-specific components exist
  const fs = require('fs');
  const path = require('path');

  const mobileComponents = [
    'client/src/components/MessengerComplete.js',
    'client/src/components/MobileOptimizedMessenger.js',
    'client/src/components/StoriesCarousel.js',
    'client/src/components/StoriesViewer.js'
  ];

  mobileComponents.forEach(component => {
    const fullPath = path.join(__dirname, component);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const hasMobileCode = content.includes('isMobile') || content.includes('@media');

      if (hasMobileCode) {
        log(`${path.basename(component)}: Mobile optimizations found`, 'success');
        testResults.passed.push(`Mobile: ${path.basename(component)}`);
      } else {
        log(`${path.basename(component)}: No mobile-specific code detected`, 'warning');
        testResults.warnings.push(`Mobile: ${path.basename(component)}`);
      }
    } else {
      log(`${path.basename(component)}: File not found`, 'error');
      testResults.failed.push(`Mobile: ${path.basename(component)}`);
    }
  });
}

async function generateReport() {
  log('TEST RESULTS SUMMARY', 'title');

  const total = testResults.passed.length + testResults.failed.length + testResults.warnings.length;
  const passRate = total > 0 ? ((testResults.passed.length / total) * 100).toFixed(1) : 0;

  console.log('\n' + '='.repeat(60));
  console.log(`✅ PASSED: ${testResults.passed.length}`.green.bold);
  testResults.passed.forEach(test => {
    console.log(`   ✓ ${test}`.green);
  });

  console.log(`\n⚠️  WARNINGS: ${testResults.warnings.length}`.yellow.bold);
  testResults.warnings.forEach(test => {
    console.log(`   ⚠ ${test}`.yellow);
  });

  console.log(`\n❌ FAILED: ${testResults.failed.length}`.red.bold);
  testResults.failed.forEach(test => {
    console.log(`   ✗ ${test}`.red);
  });

  console.log('\n' + '='.repeat(60));
  console.log(`OVERALL PASS RATE: ${passRate}%`.bold);

  if (testResults.failed.length === 0) {
    console.log('\n🎉 ALL CRITICAL TESTS PASSED! 🎉'.green.bold);
  } else {
    console.log('\n⚠️  CRITICAL ISSUES FOUND - IMMEDIATE ACTION REQUIRED!'.red.bold);

    // Provide specific recommendations
    console.log('\n📋 RECOMMENDED ACTIONS:'.yellow.bold);

    if (testResults.failed.includes('OpenAI Configuration')) {
      console.log('1. Add valid OpenAI API key to .env and Railway Variables'.yellow);
    }
    if (testResults.failed.includes('Stories UUID Setup')) {
      console.log('2. Run: CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'.yellow);
    }
    if (testResults.failed.includes('BL_Bot User')) {
      console.log('3. Run migration to create BL_Bot user'.yellow);
    }
    if (testResults.failed.includes('WebSocket')) {
      console.log('4. Check WebSocket server configuration'.yellow);
    }
  }
}

// Main execution
async function runAllTests() {
  console.log('🚀 Starting Comprehensive System Tests...'.cyan.bold);
  console.log(`Testing ${BASE_URL}`.cyan);
  console.log('='.repeat(60));

  try {
    await testDatabaseConnection();
    await testStoriesFeature();
    await testBLBot();
    await testMessenger();
    await testCalendarEvents();
    await testMobileOptimization();
    await generateReport();
  } catch (error) {
    console.error('Test suite failed:', error);
  } finally {
    await pool.end();
    process.exit(testResults.failed.length > 0 ? 1 : 0);
  }
}

// Run tests
runAllTests();