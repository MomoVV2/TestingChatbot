// knowledgeManager.js - Advanced knowledge management system
const fs = require('fs');
const path = require('path');

// Base knowledge directory
const KNOWLEDGE_DIR = path.join(__dirname, 'knowledge');

// Cache for knowledge entries to improve response time
let knowledgeCache = {
  faqs: null,
  documents: null,
  lastUpdated: null
};

// Refresh interval in milliseconds (5 minutes)
const CACHE_REFRESH_INTERVAL = 5 * 60 * 1000;

/**
 * Initialize the knowledge directory structure
 */
function initKnowledgeDir() {
  const directories = ['faqs', 'documents', 'policies'];
  
  // Create main knowledge directory if it doesn't exist
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    console.log('Creating knowledge directory structure...');
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
    
    // Create subdirectories
    directories.forEach(dir => {
      fs.mkdirSync(path.join(KNOWLEDGE_DIR, dir), { recursive: true });
    });
    
    // Create sample FAQ file
    const sampleFaqPath = path.join(KNOWLEDGE_DIR, 'faqs', 'general-faqs.txt');
    const sampleFaqs = 
`# NordicBank General FAQs
# Format: Question | Keywords | Answer

How do I change my password? | password, change, reset, update, new password | To change your password, go to 'Settings' in the app menu, select 'Security', and then tap on 'Change Password'. You'll need to enter your current password first, then your new password twice.

How do I transfer money? | transfer, send, money, payment, transaction | To transfer money, tap on 'Transfers' in the bottom menu, select the account you want to transfer from, enter the recipient's details, and follow the prompts to complete the transfer.

What are the opening hours? | hours, open, opening, time, when, branch | Our branches are typically open Monday to Friday from 9:00 AM to 4:00 PM. Some locations may have extended hours or Saturday hours. You can check the exact opening hours for your local branch in the 'Locations' section of the app.

How do I report a lost card? | lost, card, stolen, report, missing | To report a lost or stolen card, please go to 'Cards' in the app menu, select the affected card, and tap on 'Report Lost/Stolen'. Alternatively, you can call our 24/7 customer service at +46 123 456 789.

How do I activate my new card? | activate, card, new, enable | To activate your new card, go to 'Cards' in the app menu, select your new card, and tap on 'Activate Card'. You'll need to enter the last 4 digits of your card number and follow the verification steps.

How do I view my account balance? | balance, account, money, view, check | Your account balance is displayed on the main dashboard when you log in to the app. You can also tap on any account to see detailed transaction history and current balance.

How do I set up recurring payments? | recurring, payment, automatic, schedule, regular | To set up recurring payments, go to 'Payments' in the app menu, then select 'Recurring Payments'. Tap on 'Create New' and follow the instructions to set up the payment details and schedule.

How do I update my contact information? | contact, information, update, change, phone, email, address | To update your contact information, go to 'Profile' in the app menu, then select 'Personal Information'. You can edit your phone number, email address, and mailing address there.

How do I apply for a loan? | loan, apply, credit, borrow, application | To apply for a loan, go to 'Products' in the app menu, select 'Loans', and then choose the type of loan you're interested in. Follow the application process and provide the required documentation.

How do I contact customer support? | contact, support, help, assistance, service | You can contact our customer support team through the 'Help' section in the app menu. You can choose to call us, send a secure message, or schedule a callback. Our phone support is available 24/7 at +46 123 456 789.`;

    fs.writeFileSync(sampleFaqPath, sampleFaqs);
    console.log('Created sample FAQ file at', sampleFaqPath);
  }
}

/**
 * Parse a FAQ text file
 * Format: Question | Keywords | Answer
 * Lines starting with # are comments
 * 
 * @param {string} filePath - Path to the FAQ file
 * @returns {Array} Array of FAQ objects
 */
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

/**
 * Load all FAQs from the knowledge directory
 * @param {boolean} forceRefresh - Force refresh the cache
 * @returns {Array} Array of FAQ objects
 */
function loadAllFaqs(forceRefresh = false) {
  // Check if cache is valid
  const now = Date.now();
  if (
    !forceRefresh && 
    knowledgeCache.faqs && 
    knowledgeCache.lastUpdated && 
    (now - knowledgeCache.lastUpdated < CACHE_REFRESH_INTERVAL)
  ) {
    // Return cached FAQs if cache is still valid
    return knowledgeCache.faqs;
  }
  
  // Initialize knowledge directory if needed
  initKnowledgeDir();
  
  // Load FAQs from all txt files in the faqs directory
  const faqsDir = path.join(KNOWLEDGE_DIR, 'faqs');
  const faqFiles = fs.readdirSync(faqsDir).filter(file => file.endsWith('.txt'));
  
  let allFaqs = [];
  
  for (const file of faqFiles) {
    const filePath = path.join(faqsDir, file);
    const faqs = parseFaqFile(filePath);
    allFaqs = allFaqs.concat(faqs);
    console.log(`Loaded ${faqs.length} FAQs from ${file}`);
  }
  
  // Update cache
  knowledgeCache.faqs = allFaqs;
  knowledgeCache.lastUpdated = now;
  
  return allFaqs;
}

/**
 * Find the best match for a user question in the knowledge base
 * Uses a multi-stage approach for speed and accuracy
 * 
 * @param {string} userQuestion - The user's question
 * @returns {object|null} The best match or null if no good match found
 */
function findBestMatch(userQuestion) {
  try {
    console.log(`Finding best match for: "${userQuestion}"`);
    const faqs = loadAllFaqs();
    
    // Normalize user question (lowercase, remove punctuation)
    const normalizedQuestion = userQuestion.toLowerCase().replace(/[^\w\s]/g, '');
    const userWords = normalizedQuestion.split(/\s+/).filter(word => word.length > 2);
    
    console.log(`User words: ${userWords.join(', ')}`);
    
    // STAGE 1: Look for exact matches (extremely fast)
    // This is for questions that are frequently asked in exactly the same way
    for (const faq of faqs) {
      const normalizedFAQ = faq.question.toLowerCase().replace(/[^\w\s]/g, '');
      if (normalizedQuestion === normalizedFAQ) {
        console.log(`Exact match found: "${faq.question}"`);
        return {
          question: faq.question,
          answer: faq.answer,
          confidence: 3.0 // Very high confidence for exact matches
        };
      }
    }
    
    // STAGE 2: Pattern matching for common phrases (fast)
    // For example, "change password" is a common pattern
    const patterns = [
      { words: ['change', 'password'], topic: 'password change' },
      { words: ['transfer', 'money'], topic: 'money transfer' },
      { words: ['lost', 'card'], topic: 'lost card' },
      { words: ['opening', 'hours'], topic: 'branch hours' }
    ];
    
    for (const pattern of patterns) {
      if (pattern.words.every(word => normalizedQuestion.includes(word))) {
        // Try to find FAQ with this pattern
        for (const faq of faqs) {
          // Check if both the pattern topic and the FAQ question have the pattern words
          if (pattern.words.every(word => faq.question.toLowerCase().includes(word))) {
            console.log(`Pattern match found: "${faq.question}" using pattern "${pattern.topic}"`);
            return {
              question: faq.question,
              answer: faq.answer,
              confidence: 2.0 // High confidence for pattern matches
            };
          }
        }
      }
    }
    
    // STAGE 3: Keyword matching (moderately fast)
    let bestMatch = null;
    let highestScore = 0;
    
    for (const faq of faqs) {
      // Calculate score based on keywords
      let keywordMatches = 0;
      const keywords = faq.keywords || [];
      
      for (const keyword of keywords) {
        if (normalizedQuestion.includes(keyword.toLowerCase())) {
          keywordMatches++;
        }
      }
      
      // Calculate score
      const keywordScore = keywords.length > 0 ? (keywordMatches / keywords.length) : 0;
      
      // Add word matching score
      let wordMatches = 0;
      for (const word of userWords) {
        if (keywords.some(keyword => keyword.toLowerCase() === word)) {
          wordMatches++;
        }
      }
      
      const wordScore = userWords.length > 0 ? (wordMatches / userWords.length) : 0;
      
      // Final score is weighted combination
      const finalScore = (keywordScore * 0.6) + (wordScore * 0.4);
      
      // Update best match if score is higher
      if (finalScore > highestScore) {
        highestScore = finalScore;
        bestMatch = {
          question: faq.question,
          answer: faq.answer,
          confidence: finalScore
        };
      }
    }
    
    // Only return if we have a reasonable confidence
    if (bestMatch && bestMatch.confidence > 0.3) {
      console.log(`Keyword match found: "${bestMatch.question}" with confidence ${bestMatch.confidence.toFixed(2)}`);
      return bestMatch;
    }
    
    console.log('No good match found');
    return null;
  } catch (error) {
    console.error('Error finding match:', error);
    return null;
  }
}

// For now, this is our public API
module.exports = {
  initKnowledgeDir,
  loadAllFaqs,
  findBestMatch,
  KNOWLEDGE_DIR
};