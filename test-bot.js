/**
 * Test script to verify BL_Bot OpenAI integration
 * Run: node test-bot.js
 */

require('dotenv').config();
const OpenAI = require('openai');

console.log('🧪 Testing BL_Bot OpenAI Integration\n');
console.log('=' .repeat(80));

// Check environment variable
console.log('\n1. Environment Variable Check:');
console.log('   OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
if (process.env.OPENAI_API_KEY) {
  const key = process.env.OPENAI_API_KEY;
  console.log('   Key length:', key.length);
  console.log('   Key prefix:', key.substring(0, 10) + '...');
  console.log('   Key format:', key.startsWith('sk-') ? '✅ Valid format' : '❌ Invalid format');
} else {
  console.log('   ❌ OPENAI_API_KEY not set in .env file!');
  process.exit(1);
}

// Test OpenAI initialization
console.log('\n2. OpenAI Initialization:');
let openai;
try {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  console.log('   ✅ OpenAI instance created');
} catch (error) {
  console.log('   ❌ Failed to create OpenAI instance:', error.message);
  process.exit(1);
}

// Test API call
console.log('\n3. Testing API Call:');
async function testAPICall() {
  try {
    console.log('   Calling gpt-4o-mini...');
    const start = Date.now();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say "Hello from BL_Bot test!" in German.' }
      ],
      temperature: 0.7,
      max_tokens: 50
    });

    const duration = Date.now() - start;

    console.log('   ✅ API call successful!');
    console.log('   Response time:', duration + 'ms');
    console.log('   Model used:', completion.model);
    console.log('   Tokens used:', completion.usage.total_tokens);
    console.log('\n   Bot response:');
    console.log('   ' + '-'.repeat(76));
    console.log('   ' + completion.choices[0].message.content);
    console.log('   ' + '-'.repeat(76));

    console.log('\n✅ ALL TESTS PASSED! BL_Bot OpenAI integration is working correctly.');
    console.log('\n📝 Next steps:');
    console.log('   1. Add this same OPENAI_API_KEY to Railway environment variables');
    console.log('   2. Go to: https://railway.app → Your Project → Variables');
    console.log('   3. Add: OPENAI_API_KEY = ' + process.env.OPENAI_API_KEY.substring(0, 15) + '...');
    console.log('   4. Save and redeploy');

  } catch (error) {
    console.log('   ❌ API call failed!');
    console.log('   Error:', error.message);
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Details:', error.response.data);
    }

    console.log('\n❌ TESTS FAILED!');
    console.log('\n📝 Possible issues:');
    console.log('   1. Invalid API key - check https://platform.openai.com/api-keys');
    console.log('   2. No credits on OpenAI account - add billing');
    console.log('   3. API key doesn\'t have access to gpt-4o-mini model');
    console.log('   4. Rate limit exceeded - wait a few minutes');

    process.exit(1);
  }
}

testAPICall();
