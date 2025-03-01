// optimized-server.js - Using the new knowledge management system
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const http = require('http');
const knowledge = require('./knowledgeManager');

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
    hostname: OLLAMA_HOST,
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

// Initialize knowledge system
knowledge.initKnowledgeDir();

// Serve the main index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to chat
app.post('/api/chat', async (req, res) => {
  const startTime = Date.now();
  const { message, modelName } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  console.log(`Received message: "${message}"`);
  console.log(`Using model: ${modelName || 'llama3:8b'}`);
  
  // STEP 1: Try to find a match in our knowledge base (very fast)
  const knowledgeMatch = knowledge.findBestMatch(message);
  
  // If we have a good match (confidence > 0.7), return immediately
  if (knowledgeMatch && knowledgeMatch.confidence > 0.7) {
    console.log(`Using knowledge base answer with confidence ${knowledgeMatch.confidence}`);
    console.log(`Response time: ${Date.now() - startTime}ms`);
    return res.json({ response: knowledgeMatch.answer });
  }
  
  // STEP 2: For medium confidence (0.3-0.7), use as context but verify with LLM
  if (knowledgeMatch && knowledgeMatch.confidence > 0.3) {
    console.log(`Using knowledge base context with confidence ${knowledgeMatch.confidence}`);
    
    // Use a simplified context prompt for speed
    return sendToOllama(
      req, 
      res, 
      message, 
      modelName, 
      `You are NordicBank's AI assistant. Be brief and direct.
      
The user's question is related to: "${knowledgeMatch.question}"
The appropriate answer is: "${knowledgeMatch.answer}"

Rephrase this answer if needed, but keep it clear and concise.`,
      startTime
    );
  }
  
  // STEP 3: For low confidence or no match, use the full knowledge context
  console.log('No good knowledge match, using full context');
  
  // Get all FAQs for context
  const faqs = knowledge.loadAllFaqs();
  
  // Create system prompt
  const systemPrompt = `You are NordicBank's AI assistant for in-app support. Your job is to help customers with their banking questions.

IMPORTANT GUIDELINES:
1. Keep answers VERY BRIEF and direct - no more than 3-4 sentences.
2. Focus only on NordicBank's app and services.
3. Use a friendly, helpful tone.
4. Only answer banking-related questions.
5. If asked about specific account details, say you don't have access to personal account information.
6. NEVER mention other services like Google, Apple, Facebook, etc.

KNOWLEDGE BASE:
${faqs.map(faq => `Q: ${faq.question}\nA: ${faq.answer}`).join('\n\n')}`;

  // Send to Ollama with full context
  return sendToOllama(req, res, message, modelName, systemPrompt, startTime);
});

/**
 * Helper function to send requests to Ollama
 */
function sendToOllama(req, res, message, modelName, systemPrompt, startTime) {
  // Create request data for Ollama
  const postData = JSON.stringify({
    model: modelName || 'llama3:8b',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ],
    stream: false
  });
  
  // Set up request options
  const options = {
    hostname: OLLAMA_HOST,
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
      console.log(`Total response time: ${Date.now() - startTime}ms`);
      
      if (ollamaRes.statusCode !== 200) {
        console.error(`Ollama returned status code ${ollamaRes.statusCode}`);
        return res.status(500).json({ error: 'Error from Ollama API', details: responseData });
      }
      
      try {
        const parsedResponse = JSON.parse(responseData);
        console.log('Successfully parsed Ollama response');
        
        // Get AI response
        let aiResponse = parsedResponse.message.content;
        
        // Truncate if too long (as a fallback)
        if (aiResponse.length > 500) {
          console.log('Response too long, truncating to 500 characters');
          aiResponse = aiResponse.substring(0, 500) + '...';
        }
        
        res.json({ response: aiResponse });
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
}

// Admin route to refresh knowledge base
app.post('/api/admin/refresh-knowledge', (req, res) => {
  try {
    const faqs = knowledge.loadAllFaqs(true);
    res.json({ 
      success: true, 
      message: `Successfully refreshed knowledge base. Loaded ${faqs.length} FAQs.` 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to refresh knowledge base', 
      error: error.message 
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
  
  // Test Ollama connection
  testOllamaConnection();
});