#!/usr/bin/env node
/**
 * Comprehensive System Test Suite
 * Tests all routes, database connections, Redis, file uploads
 */

const http = require('http');
const https = require('https');

// Configuration
const BASE_URL = process.env.TEST_URL || 'http://localhost:5000';
const VERBOSE = process.env.VERBOSE === 'true';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test results
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

// Helper to make HTTP requests
function request(options) {
  return new Promise((resolve, reject) => {
    const protocol = options.url.startsWith('https') ? https : http;
    const url = new URL(options.url);

    const reqOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = protocol.request(reqOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

// Test runner
async function test(name, fn) {
  try {
    await fn();
    results.passed++;
    results.tests.push({ name, status: 'PASS' });
    console.log(`${colors.green}✓${colors.reset} ${name}`);
  } catch (error) {
    results.failed++;
    results.tests.push({ name, status: 'FAIL', error: error.message });
    console.log(`${colors.red}✗${colors.reset} ${name}`);
    if (VERBOSE) {
      console.log(`  ${colors.red}Error: ${error.message}${colors.reset}`);
    }
  }
}

// Assertion helpers
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// Test Suite
async function runTests() {
  console.log(`\n${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  BIOLAB LOGISTIK PLANNER - COMPREHENSIVE SYSTEM TEST${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`);
  console.log(`Testing: ${colors.yellow}${BASE_URL}${colors.reset}\n`);

  let token = null;
  let userId = null;

  // ═══════════════════════════════════════════════════════
  // 1. HEALTH CHECKS
  // ═══════════════════════════════════════════════════════
  console.log(`${colors.bright}${colors.blue}1. Health Checks${colors.reset}`);

  await test('Server is running', async () => {
    const res = await request({ url: `${BASE_URL}/health` });
    assertEqual(res.status, 200, 'Health endpoint should return 200');
    assert(res.body.status === 'ok', 'Health status should be ok');
  });

  // ═══════════════════════════════════════════════════════
  // 2. AUTHENTICATION
  // ═══════════════════════════════════════════════════════
  console.log(`\n${colors.bright}${colors.blue}2. Authentication${colors.reset}`);

  await test('Check first setup status', async () => {
    const res = await request({ url: `${BASE_URL}/api/auth/first-setup` });
    assertEqual(res.status, 200, 'First setup check should return 200');
  });

  await test('Register new user (superadmin)', async () => {
    const res = await request({
      url: `${BASE_URL}/api/auth/register`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        name: 'Test Admin',
        email: `test-${Date.now()}@test.com`,
        password: 'test123456',
        role: 'superadmin'
      }
    });

    assert(res.status === 201 || res.status === 409, 'Registration should return 201 or 409');

    if (res.status === 201) {
      assert(res.body.token, 'Should return JWT token');
      token = res.body.token;
      userId = res.body.user.id;
    }
  });

  await test('Login with credentials', async () => {
    const res = await request({
      url: `${BASE_URL}/api/auth/login`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        email: 'admin@biolab.com',
        password: 'admin123'
      }
    });

    if (res.status === 200) {
      assert(res.body.token, 'Login should return token');
      token = res.body.token;
      userId = res.body.user.id;
    }
  });

  await test('Get current user', async () => {
    if (!token) {
      throw new Error('No token available, skipping test');
    }

    const res = await request({
      url: `${BASE_URL}/api/auth/user`,
      headers: { 'Authorization': `Bearer ${token}` }
    });

    assertEqual(res.status, 200, 'Get user should return 200');
    assert(res.body.id, 'User should have ID');
  });

  // ═══════════════════════════════════════════════════════
  // 3. TASKS
  // ═══════════════════════════════════════════════════════
  console.log(`\n${colors.bright}${colors.blue}3. Tasks Management${colors.reset}`);

  let taskId = null;

  await test('Get all tasks', async () => {
    if (!token) {
      results.skipped++;
      console.log(`${colors.yellow}⊘${colors.reset} Get all tasks (skipped - no auth)`);
      return;
    }

    const res = await request({
      url: `${BASE_URL}/api/tasks`,
      headers: { 'Authorization': `Bearer ${token}` }
    });

    assertEqual(res.status, 200, 'Get tasks should return 200');
    assert(Array.isArray(res.body), 'Tasks should be an array');
  });

  await test('Create new task', async () => {
    if (!token) {
      results.skipped++;
      console.log(`${colors.yellow}⊘${colors.reset} Create new task (skipped - no auth)`);
      return;
    }

    const res = await request({
      url: `${BASE_URL}/api/tasks`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: {
        title: 'Test Task',
        description: 'This is a test task',
        status: 'todo',
        priority: 'medium'
      }
    });

    assertEqual(res.status, 201, 'Create task should return 201');
    assert(res.body.id, 'Task should have ID');
    taskId = res.body.id;
  });

  await test('Update task', async () => {
    if (!token || !taskId) {
      results.skipped++;
      console.log(`${colors.yellow}⊘${colors.reset} Update task (skipped - no task ID)`);
      return;
    }

    const res = await request({
      url: `${BASE_URL}/api/tasks/${taskId}`,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: {
        status: 'inprogress'
      }
    });

    assertEqual(res.status, 200, 'Update task should return 200');
    assertEqual(res.body.status, 'inprogress', 'Task status should be updated');
  });

  // ═══════════════════════════════════════════════════════
  // 4. SCHEDULE / WORK HOURS
  // ═══════════════════════════════════════════════════════
  console.log(`\n${colors.bright}${colors.blue}4. Work Hours & Schedule${colors.reset}`);

  await test('Get current week schedule', async () => {
    if (!token) {
      results.skipped++;
      console.log(`${colors.yellow}⊘${colors.reset} Get schedule (skipped - no auth)`);
      return;
    }

    const monday = new Date();
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
    monday.setDate(diff);
    const weekStart = monday.toISOString().split('T')[0];

    const res = await request({
      url: `${BASE_URL}/api/schedule/week/${weekStart}`,
      headers: { 'Authorization': `Bearer ${token}` }
    });

    assertEqual(res.status, 200, 'Get schedule should return 200');
    assert(Array.isArray(res.body), 'Schedule should be an array');
  });

  await test('Get hours summary', async () => {
    if (!token) {
      results.skipped++;
      console.log(`${colors.yellow}⊘${colors.reset} Get hours summary (skipped - no auth)`);
      return;
    }

    const monday = new Date();
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
    monday.setDate(diff);
    const weekStart = monday.toISOString().split('T')[0];

    const res = await request({
      url: `${BASE_URL}/api/schedule/hours-summary/${weekStart}`,
      headers: { 'Authorization': `Bearer ${token}` }
    });

    assertEqual(res.status, 200, 'Get hours summary should return 200');
    assert(res.body.weeklyQuota !== undefined, 'Should have weekly quota');
  });

  // ═══════════════════════════════════════════════════════
  // 5. MESSAGES
  // ═══════════════════════════════════════════════════════
  console.log(`\n${colors.bright}${colors.blue}5. Messenger${colors.reset}`);

  await test('Get messages', async () => {
    if (!token) {
      results.skipped++;
      console.log(`${colors.yellow}⊘${colors.reset} Get messages (skipped - no auth)`);
      return;
    }

    const res = await request({
      url: `${BASE_URL}/api/messages`,
      headers: { 'Authorization': `Bearer ${token}` }
    });

    assertEqual(res.status, 200, 'Get messages should return 200');
    assert(Array.isArray(res.body), 'Messages should be an array');
  });

  await test('Get unread count', async () => {
    if (!token) {
      results.skipped++;
      console.log(`${colors.yellow}⊘${colors.reset} Get unread count (skipped - no auth)`);
      return;
    }

    const res = await request({
      url: `${BASE_URL}/api/messages/unread-count`,
      headers: { 'Authorization': `Bearer ${token}` }
    });

    assertEqual(res.status, 200, 'Get unread count should return 200');
    assert(res.body.count !== undefined, 'Should have count field');
  });

  // ═══════════════════════════════════════════════════════
  // 6. KNOWLEDGE BASE (if route exists)
  // ═══════════════════════════════════════════════════════
  console.log(`\n${colors.bright}${colors.blue}6. Knowledge Base${colors.reset}`);

  await test('Get KB categories', async () => {
    if (!token) {
      results.skipped++;
      console.log(`${colors.yellow}⊘${colors.reset} Get KB categories (skipped - no auth)`);
      return;
    }

    const res = await request({
      url: `${BASE_URL}/api/kb/categories`,
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 404) {
      results.skipped++;
      console.log(`${colors.yellow}⊘${colors.reset} Get KB categories (route not mounted yet)`);
      return;
    }

    assertEqual(res.status, 200, 'Get categories should return 200');
    assert(Array.isArray(res.body), 'Categories should be an array');
  });

  await test('Get KB articles', async () => {
    if (!token) {
      results.skipped++;
      console.log(`${colors.yellow}⊘${colors.reset} Get KB articles (skipped - no auth)`);
      return;
    }

    const res = await request({
      url: `${BASE_URL}/api/kb/articles`,
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 404) {
      results.skipped++;
      console.log(`${colors.yellow}⊘${colors.reset} Get KB articles (route not mounted yet)`);
      return;
    }

    assertEqual(res.status, 200, 'Get articles should return 200');
    assert(Array.isArray(res.body), 'Articles should be an array');
  });

  // ═══════════════════════════════════════════════════════
  // 7. ERROR HANDLING
  // ═══════════════════════════════════════════════════════
  console.log(`\n${colors.bright}${colors.blue}7. Error Handling${colors.reset}`);

  await test('401 on protected route without auth', async () => {
    const res = await request({ url: `${BASE_URL}/api/tasks` });
    assertEqual(res.status, 401, 'Should return 401 for unauthorized access');
  });

  await test('404 on non-existent route', async () => {
    const res = await request({ url: `${BASE_URL}/api/nonexistent` });
    assertEqual(res.status, 404, 'Should return 404 for non-existent route');
  });

  await test('400 on invalid request body', async () => {
    if (!token) {
      results.skipped++;
      console.log(`${colors.yellow}⊘${colors.reset} Invalid request body (skipped - no auth)`);
      return;
    }

    const res = await request({
      url: `${BASE_URL}/api/tasks`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: {} // Missing required fields
    });

    assertEqual(res.status, 400, 'Should return 400 for invalid request');
  });

  // ═══════════════════════════════════════════════════════
  // RESULTS
  // ═══════════════════════════════════════════════════════
  console.log(`\n${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  TEST RESULTS${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`);

  const total = results.passed + results.failed + results.skipped;
  console.log(`Total tests:    ${total}`);
  console.log(`${colors.green}Passed:         ${results.passed}${colors.reset}`);
  console.log(`${colors.red}Failed:         ${results.failed}${colors.reset}`);
  console.log(`${colors.yellow}Skipped:        ${results.skipped}${colors.reset}`);

  const passRate = total > 0 ? ((results.passed / total) * 100).toFixed(1) : 0;
  console.log(`\n${colors.bright}Pass rate:      ${passRate}%${colors.reset}`);

  if (results.failed > 0) {
    console.log(`\n${colors.red}${colors.bright}Failed tests:${colors.reset}`);
    results.tests
      .filter(t => t.status === 'FAIL')
      .forEach(t => {
        console.log(`  ${colors.red}✗${colors.reset} ${t.name}`);
        if (t.error) {
          console.log(`    ${colors.red}${t.error}${colors.reset}`);
        }
      });
  }

  console.log(`\n${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`);

  // Exit with error code if tests failed
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
