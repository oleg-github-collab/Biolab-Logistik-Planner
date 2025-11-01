// MINIMAL TEST SERVER - NO DEPENDENCIES
const http = require('http');
const PORT = process.env.PORT || 8080;

console.log('='.repeat(80));
console.log('MINIMAL TEST SERVER STARTING');
console.log('PORT:', PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('='.repeat(80));

const server = http.createServer((req, res) => {
  console.log('Request:', req.method, req.url);

  if (req.url === '/ping' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('PONG - Server is alive!\n');
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Test server running OK\n');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('✅ TEST SERVER LISTENING ON PORT', PORT);
});

// Keep alive
setInterval(() => {
  console.log('Heartbeat - server still running');
}, 30000);
