const https = require('https');
const http = require('http');

const proxyHost = '10.130.20.251';
const proxyPort = 2002;

console.log('Testing proxy connection...');
console.log(`Proxy: ${proxyHost}:${proxyPort}`);
console.log('HTTP_PROXY:', process.env.HTTP_PROXY);
console.log('HTTPS_PROXY:', process.env.HTTPS_PROXY);

// Test HTTP connection through proxy
const options = {
  host: proxyHost,
  port: proxyPort,
  method: 'CONNECT',
  path: 'supabase.co:443'
};

const req = http.request(options);

req.on('connect', (res, socket) => {
  if (res.statusCode === 200) {
    console.log('✅ Proxy connection successful!');
    socket.end();
    process.exit(0);
  } else {
    console.log('❌ Proxy returned status:', res.statusCode);
    process.exit(1);
  }
});

req.on('error', (err) => {
  console.error('❌ Proxy connection failed:', err.message);
  process.exit(1);
});

req.end();