// ollama-client.js - Handles interactions with Ollama API
const axios = require('axios');
const { loadFAQs } = require('./knowledge');

// Use IPv4 explicitly
const OLLAMA_BASE_URL = 'http://127.0.0.1:11434/api';
const DEBUG = true;

// Test Ollama connection at startup
console.log('Testing connection to Ollama API...');
axios.get(`${OLLAMA_BASE_URL}/tags`)
  .then(response => {
    console.log('✅ Successfully connected to Ollama API');
    console.log('Available models:', response.data.models.map(m => m.name).join(', '));
  })
  .catch(error => {
    console.error('❌ Failed to connect to Ollama API:', error.message);
    console.error('Please make sure Ollama is running on http://127.0.0.1:11434');
  });

/**
 * Generate a response using Ollama API
 * @param {string} userMessage - The user's message
 * @param {string} modelName - The Ollama model to use
 * @param {object|null} knowledgeMatch - Optional partial knowledge match
 * @returns {Promise<string>} The generated response
 */
async function generateResponse(userMessage, modelName, knowledgeMatch = null) {
  try {
    console.log(`Ollama: Generating response with model ${modelName}`);
    
    // Load all FAQs to use as context
    const faqs = loadFAQs();
    
    // Convert FAQs to a formatted string for context
    const faqContext = faqs.map(faq => 
      `Q: ${faq.question}\nA: ${faq.answer}`
    ).join('\n\n');
    
    // Build the system prompt
    let systemPrompt = `You are NordicBank's AI assistant for in-app support. Your job is to help customers with their banking questions.
    
You should be helpful, concise, and accurate. If you don't know an answer for certain, ask clarifying questions.

If users ask in incomplete sentences (like "how change password" instead of "how do I change my password"), understand the intent and respond as if they asked the complete question.

Here is the knowledge base you should reference for answers:

${faqContext}

If the question is not covered in your knowledge base, generate a helpful response based on general banking knowledge, but clarify that the user might want to contact customer support for specific account details or actions.`;

    // If we have a partial knowledge match, add it to the prompt
    if (knowledgeMatch && knowledgeMatch.confidence > 0.4) {
      systemPrompt += `\n\nThe user's question seems related to: "${knowledgeMatch.question}" which has the answer: "${knowledgeMatch.answer}". Use this as a reference if applicable.`;
    }

    // Create payload for Ollama API
    const payload = {
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      stream: false
    };

    console.log(`Sending request to Ollama at ${OLLAMA_BASE_URL}/chat`);
    if (DEBUG) {
      console.log('Request payload:', JSON.stringify(payload, null, 2));
    }
    
    // Make request to Ollama API
    console.log('Starting Ollama API request...');
    const response = await axios.post(`${OLLAMA_BASE_URL}/chat`, payload);
    
    console.log('Ollama response received');
    if (DEBUG) {
      console.log('Response status:', response.status);
      console.log('Response data preview:', JSON.stringify(response.data).substring(0, 200) + '...');
    }
    
    // Return the text response
    return response.data.message.content;
  } catch (error) {
    console.error('Error calling Ollama API:', error.message);
    
    // Log more detailed error information
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Ollama error response data:', error.response.data);
      console.error('Ollama error response status:', error.response.status);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from Ollama. Is Ollama running?');
    }
    
    return "I'm sorry, I'm having trouble connecting to my AI services. Please make sure Ollama is running and try again.";
  }
}

module.exports = {
  generateResponse
};