// A very simple test without dependencies - using IPv4 explicitly
const http = require('http');

// Simple HTTP request without using axios - using 127.0.0.1 instead of localhost
const options = {
  hostname: '127.0.0.1', // Use IPv4 address explicitly
  port: 11434,
  path: '/api/tags',
  method: 'GET'
};

console.log('Sending simple HTTP request to Ollama (IPv4)...');

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response received!');
    console.log(data.substring(0, 100) + '...');
    console.log('\nTest successful! Ollama API is accessible from Node.js');
  });
});

req.on('error', (e) => {
  console.error(`ERROR: ${e.message}`);
  console.log('This indicates a network issue connecting to Ollama');
});

req.end();