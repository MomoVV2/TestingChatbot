// fixed-server.js - Using IPv4 explicitly for Ollama connection
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

// IPv4 address for Ollama
const OLLAMA_HOST = '127.0.0.1';
const OLLAMA_PORT = 11434;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  
  // Log all requests
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Test connection to Ollama at startup
function testOllamaConnection() {
  console.log(`Testing connection to Ollama at ${OLLAMA_HOST}:${OLLAMA_PORT}...`);
  
  const options = {
    hostname: OLLAMA_HOST, // IPv4 address explicitly
    port: OLLAMA_PORT,
    path: '/api/tags',
    method: 'GET'
  };
  
  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      if (res.statusCode === 200) {
        try {
          const parsed = JSON.parse(data);
          console.log('✅ Ollama connection successful!');
          console.log('Available models:', parsed.models.map(m => m.name).join(', '));
        } catch (e) {
          console.error('❌ Error parsing Ollama response:', e.message);
        }
      } else {
        console.error(`❌ Ollama returned status code ${res.statusCode}`);
      }
    });
  });
  
  req.on('error', (e) => {
    console.error(`❌ Failed to connect to Ollama: ${e.message}`);
    console.error(`Please make sure Ollama is running on http://${OLLAMA_HOST}:${OLLAMA_PORT}`);
  });
  
  req.end();
}

// Serve the main index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to chat directly with Ollama
app.post('/api/chat', (req, res) => {
  const { message, modelName } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  console.log(`Received message: "${message}"`);
  console.log(`Using model: ${modelName || 'llama3:8b'}`);
  
  // Create request data for Ollama
  const postData = JSON.stringify({
    model: modelName || 'llama3:8b',
    messages: [
      { role: 'user', content: message }
    ],
    stream: false
  });
  
  // Set up request options
  const options = {
    hostname: OLLAMA_HOST, // IPv4 address explicitly
    port: OLLAMA_PORT,
    path: '/api/chat',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  console.log(`Sending request to Ollama at ${OLLAMA_HOST}:${OLLAMA_PORT}...`);
  
  // Send the request to Ollama
  const ollamaReq = http.request(options, (ollamaRes) => {
    let responseData = '';
    
    ollamaRes.on('data', (chunk) => {
      responseData += chunk;
    });
    
    ollamaRes.on('end', () => {
      console.log('Response received from Ollama');
      
      if (ollamaRes.statusCode !== 200) {
        console.error(`Ollama returned status code ${ollamaRes.statusCode}`);
        return res.status(500).json({ error: 'Error from Ollama API', details: responseData });
      }
      
      try {
        const parsedResponse = JSON.parse(responseData);
        console.log('Successfully parsed Ollama response');
        res.json({ response: parsedResponse.message.content });
      } catch (error) {
        console.error('Error parsing Ollama response:', error);
        res.status(500).json({ error: 'Failed to parse Ollama response', details: error.message });
      }
    });
  });
  
  ollamaReq.on('error', (error) => {
    console.error('Error sending request to Ollama:', error);
    res.status(500).json({ error: 'Failed to connect to Ollama', details: error.message });
  });
  
  // Write post data and end request
  ollamaReq.write(postData);
  ollamaReq.end();
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
  
  // Test Ollama connection
  testOllamaConnection();
});