#!/usr/bin/env node
/**
 * Simple healthcheck script for Railway
 */

const http = require('http');

const PORT = process.env.PORT || 5000;
const options = {
  host: 'localhost',
  port: PORT,
  path: '/health',
  timeout: 2000
};

const request = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

request.on('error', (err) => {
  console.log('ERROR:', err.message);
  process.exit(1);
});

request.end();
