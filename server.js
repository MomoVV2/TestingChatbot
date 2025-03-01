// server.js - Complete implementation with direct navigation support
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const http = require('http');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// IPv4 address for Ollama
const OLLAMA_HOST = '127.0.0.1';
const OLLAMA_PORT = 11434;

// Knowledge base directory
const KNOWLEDGE_DIR = path.join(__dirname, 'knowledge');
const FAQ_DIR = path.join(KNOWLEDGE_DIR, 'faqs');

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

// Initialize knowledge directory
function initKnowledgeDir() {
  // Create main directories if they don't exist
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
    fs.mkdirSync(FAQ_DIR, { recursive: true });
    
    // Create sample FAQ file if it doesn't exist
    const sampleFaqFile = path.join(FAQ_DIR, 'nordicbank-faqs.txt');
    if (!fs.existsSync(sampleFaqFile)) {
      fs.writeFileSync(sampleFaqFile, createSampleFaqs());
      console.log(`Created sample FAQ file at ${sampleFaqFile}`);
    }
  }
}

// Create sample FAQs
function createSampleFaqs() {
  return `# NordicBank FAQs
# Format: Question | Keywords | Answer

How do I change my password? | password, change, reset, update | Go to Settings → Security → Change Password. Enter your current password, then your new password twice.

How do I transfer money? | transfer, send, money, payment | Tap Transfers in the bottom menu, select source account, enter recipient details, and follow the prompts.

What are the opening hours? | hours, open, time, when, branch | Branches open Monday-Friday, 9:00 AM to 4:00 PM. Check exact hours in the Locations section.

How do I report a lost card? | lost, card, stolen, report | Go to Cards → select card → Report Lost/Stolen. Or call customer service at +46 123 456 789.

How do I activate my new card? | activate, card, new | Go to Cards → select new card → Activate Card. Enter last 4 digits and follow verification steps.

How do I view my account balance? | balance, account, money, view | Your balance appears on the main dashboard. Tap any account to see transaction history.

How do I set up recurring payments? | recurring, payment, automatic | Go to Payments → Recurring Payments → Create New and follow setup instructions.

How do I update my contact information? | contact, update, change, phone, email | Go to Profile → Personal Information and edit your details.

How do I apply for a loan? | loan, apply, credit, borrow | Go to Products → Loans → select loan type and follow application process.

How do I contact customer support? | contact, support, help | Use the Help section to call, send a message, or schedule a callback. Phone: +46 123 456 789.

What security features does the app have? | security, protection, features | Features include Touch/Face ID login, card blocking, two-factor authentication, and an emergency block option.

Can I use Apple Pay/Google Pay? | apple, google, pay, wallet | Yes, easily add your NordicBank card to Apple Pay or Google Pay through the app.

How do I change my PIN? | pin, change, update, new | Go to Card Services → My PIN → enter new PIN twice and confirm with authentication.

Where can I see my transactions? | transactions, history, activity | View transactions on the main dashboard or tap an account to see detailed history.

What should I do if I forget my password? | password, forgot, reset, recover | Tap "Forgot Password" on the login screen and follow verification steps via email/SMS.

How do I change my reference account? | reference, account, change, update | Go to Settings → Accounts → Reference Account → Select new account and confirm.

Is the app secure? | secure, safety, protection | Yes, the app uses bank-grade encryption, biometric authentication, and transaction monitoring.

How do I get help with the app? | help, support, assistance, guide | Contact our support team via the Help section or visit the FAQ page for common questions.

Can I block my card temporarily? | block, temporary, freeze | Yes, go to Cards → select card → Temporary Block to freeze your card until you unblock it.

How do I update the app? | update, version, upgrade | Updates are available through your device's app store. We recommend enabling automatic updates.`;
}

// Parse a FAQ text file
function parseFaqFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const faqs = [];
    
    for (const line of lines) {
      // Skip comments and empty lines
      if (line.trim().startsWith('#') || line.trim() === '') {
        continue;
      }
      
      // Parse the line
      const parts = line.split('|').map(part => part.trim());
      
      if (parts.length >= 3) {
        const question = parts[0];
        const keywords = parts[1].split(',').map(keyword => keyword.trim());
        const answer = parts[2];
        
        faqs.push({ question, keywords, answer });
      }
    }
    
    return faqs;
  } catch (error) {
    console.error(`Error parsing FAQ file ${filePath}:`, error);
    return [];
  }
}

// Load all FAQs
function loadAllFaqs() {
  // Initialize knowledge directory if needed
  initKnowledgeDir();
  
  // Load FAQs from all text files in the FAQ directory
  let allFaqs = [];
  
  try {
    const faqFiles = fs.readdirSync(FAQ_DIR).filter(file => file.endsWith('.txt'));
    
    for (const file of faqFiles) {
      const filePath = path.join(FAQ_DIR, file);
      const faqs = parseFaqFile(filePath);
      allFaqs = allFaqs.concat(faqs);
      console.log(`Loaded ${faqs.length} FAQs from ${file}`);
    }
  } catch (error) {
    console.error('Error loading FAQs:', error);
  }
  
  return allFaqs;
}

// Function to detect direct navigation requests
function isDirectNavigationRequest(message) {
  const lowerMessage = message.toLowerCase();
  
  // PIN change patterns
  if (/\b(change|update|set|reset)\s+pin\b/i.test(lowerMessage) ||
      /\bpin\s+(change|reset)\b/i.test(lowerMessage) ||
      lowerMessage === "pin" || 
      lowerMessage === "change pin" || 
      lowerMessage === "pin ändern" ||
      lowerMessage.includes("change pin?") ||
      lowerMessage.includes("pin?")) {
    return "pin";
  }
  
  // Reference account patterns
  if (/\b(change|update)\s+(reference|ref)\s+account\b/i.test(lowerMessage) ||
      /\breference\s+account\b/i.test(lowerMessage) ||
      lowerMessage === "reference account" ||
      lowerMessage === "ref account" ||
      lowerMessage.includes("reference account?") ||
      lowerMessage.includes("change reference account?")) {
    return "reference";
  }
  
  // Email change patterns
  if (/\b(change|update)\s+email\b/i.test(lowerMessage) ||
      lowerMessage === "email" ||
      lowerMessage === "change email" ||
      lowerMessage.includes("email?") ||
      lowerMessage.includes("change email?")) {
    return "email";
  }
  
  // Fund transfer patterns
  if (/\btransfer\s+(money|funds)\b/i.test(lowerMessage) ||
      /\b(money|funds)\s+transfer\b/i.test(lowerMessage) ||
      lowerMessage === "transfer" ||
      lowerMessage === "fund transfer" ||
      lowerMessage === "send money" ||
      lowerMessage.includes("transfer?")) {
    return "transfer";
  }
  
  // Benefits patterns
  if (/\bbenefits\b/i.test(lowerMessage) ||
      lowerMessage === "benefits" ||
      lowerMessage === "advantages" ||
      lowerMessage === "perks" ||
      lowerMessage.includes("benefits?")) {
    return "benefits";
  }
  
  // Contact support patterns
  if (/\b(contact|call|speak to)\s+support\b/i.test(lowerMessage) ||
      lowerMessage === "support" ||
      lowerMessage === "help" ||
      lowerMessage === "contact" ||
      lowerMessage.includes("support?") ||
      lowerMessage.includes("contact?")) {
    return "support";
  }
  
  // FAQ patterns
  if (/\b(show|go to|view|see|check)\s+faq\b/i.test(lowerMessage) ||
      lowerMessage === "faq" ||
      lowerMessage === "faqs" ||
      lowerMessage.includes("faq?")) {
    return "faq";
  }
  
  // Not a direct navigation request
  return null;
}

// Define direct navigation responses
const directResponses = {
  "pin": "I can help you change your PIN.",
  "reference": "I can help you change your reference account.",
  "email": "I can help you update your email address.",
  "transfer": "I can help you transfer funds.",
  "benefits": "I can show you your account benefits.",
  "support": "I'll connect you with customer support.",
  "faq": "Here are our frequently asked questions."
};

// Find the best match for a user question
function findBestMatch(userQuestion) {
  try {
    console.log(`Finding best match for: "${userQuestion}"`);
    const faqs = loadAllFaqs();
    
    // Normalize user question
    const normalizedQuestion = userQuestion.toLowerCase().replace(/[^\w\s]/g, '');
    const userWords = normalizedQuestion.split(/\s+/).filter(word => word.length > 2);
    
    // STAGE 1: Exact match
    for (const faq of faqs) {
      const normalizedFAQ = faq.question.toLowerCase().replace(/[^\w\s]/g, '');
      if (normalizedQuestion === normalizedFAQ) {
        console.log(`Exact match found: "${faq.question}"`);
        return {
          question: faq.question,
          answer: faq.answer,
          confidence: 3.0
        };
      }
    }
    
    // STAGE 2: Keyword match
    let bestMatch = null;
    let highestScore = 0;
    
    for (const faq of faqs) {
      // Calculate keyword score
      let keywordMatches = 0;
      const keywords = faq.keywords || [];
      
      for (const keyword of keywords) {
        if (normalizedQuestion.includes(keyword.toLowerCase())) {
          keywordMatches++;
        }
      }
      
      const keywordScore = keywords.length > 0 ? (keywordMatches / keywords.length) : 0;
      
      // Calculate word match score
      let wordMatches = 0;
      for (const word of userWords) {
        if (keywords.some(keyword => keyword.toLowerCase() === word)) {
          wordMatches++;
        }
      }
      
      const wordScore = userWords.length > 0 ? (wordMatches / userWords.length) : 0;
      
      // Final score
      const finalScore = (keywordScore * 0.6) + (wordScore * 0.4);
      
      // Update best match
      if (finalScore > highestScore) {
        highestScore = finalScore;
        bestMatch = {
          question: faq.question,
          answer: faq.answer,
          confidence: finalScore
        };
      }
    }
    
    // Return match if confidence is reasonable
    if (bestMatch && bestMatch.confidence > 0.3) {
      console.log(`Match found: "${bestMatch.question}" with confidence ${bestMatch.confidence.toFixed(2)}`);
      return bestMatch;
    }
    
    console.log('No good match found');
    return null;
  } catch (error) {
    console.error('Error finding match:', error);
    return null;
  }
}

// Create system prompt with focus on brevity
function createSystemPrompt(faqs, knowledgeMatch) {
  return `You are NordicBank's AI assistant for in-app support. Your job is to help customers with their banking questions.

EXTREMELY IMPORTANT GUIDELINES:
1. Keep answers ULTRA-BRIEF. Maximum 1-2 sentences. Never more than 200 characters if possible.
2. Be direct and get straight to the point. No welcomes, no intros, no "I hope this helps" type of phrases.
3. Focus only on NordicBank's app and services.
4. Use a friendly, professional tone.
5. Only answer banking-related questions.
6. If asked about specific account details, say you don't have access to personal account information.
7. NEVER mention other services except Apple Pay and Google Pay.
8. Respond in the same language as the user's question (German or English).

${knowledgeMatch ? `USER QUESTION MATCHED: "${knowledgeMatch.question}" with confidence ${knowledgeMatch.confidence}. Base your answer on this.` : ''}

KNOWLEDGE BASE:
${faqs.map(faq => `Q: ${faq.question}\nA: ${faq.answer}`).join('\n\n')}`;
}

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

// Initialize knowledge directory
initKnowledgeDir();

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
  
  // Check if this is a direct navigation request
  const directNavType = isDirectNavigationRequest(message);
  
  if (directNavType) {
    // For direct navigation, return a simple acknowledgment instead of instructions
    console.log(`Direct navigation request detected: ${directNavType}`);
    return res.json({ 
      response: directResponses[directNavType],
      directNavigation: directNavType // Include this so client knows it's a navigation request
    });
  }
  
  // For non-navigation requests, continue with normal processing
  // Find match in knowledge base
  const knowledgeMatch = findBestMatch(message);
  
  // Return direct match if confidence is high
  if (knowledgeMatch && knowledgeMatch.confidence > 0.7) {
    console.log(`Using knowledge base answer with confidence ${knowledgeMatch.confidence}`);
    console.log(`Response time: ${Date.now() - startTime}ms`);
    return res.json({ response: knowledgeMatch.answer });
  }
  
  // Get all FAQs for context
  const faqs = loadAllFaqs();
  
  // Create system prompt with strong brevity guidance
  const systemPrompt = createSystemPrompt(faqs, knowledgeMatch);
  
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
        if (aiResponse.length > 300) {
          console.log('Response too long, truncating to 300 characters');
          aiResponse = aiResponse.substring(0, 300) + '...';
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
});

// Admin route to refresh knowledge base
app.post('/api/admin/refresh-knowledge', (req, res) => {
  try {
    const faqs = loadAllFaqs(true);
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