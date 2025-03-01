// knowledge.js - Improved matching algorithm for FAQs
const fs = require('fs');
const path = require('path');

// Path to the knowledge base file
const KNOWLEDGE_FILE = path.join(__dirname, 'data', 'faqs.json');

/**
 * Load FAQs from the knowledge base file
 * @returns {Array} Array of FAQ objects
 */
function loadFAQs() {
  try {
    // Check if the file exists
    if (!fs.existsSync(KNOWLEDGE_FILE)) {
      // Create default FAQs if file doesn't exist
      const defaultFAQs = [
        {
          question: "How do I change my password?",
          keywords: ["password", "change", "reset", "update", "new password"],
          answer: "To change your password, go to 'Settings' in the app menu, select 'Security', and then tap on 'Change Password'. You'll need to enter your current password first, then your new password twice."
        },
        {
          question: "How do I transfer money?",
          keywords: ["transfer", "send", "money", "payment", "transaction"],
          answer: "To transfer money, tap on 'Transfers' in the bottom menu, select the account you want to transfer from, enter the recipient's details, and follow the prompts to complete the transfer."
        },
        {
          question: "What are the opening hours?",
          keywords: ["hours", "open", "opening", "time", "when", "branch"],
          answer: "Our branches are typically open Monday to Friday from 9:00 AM to 4:00 PM. Some locations may have extended hours or Saturday hours. You can check the exact opening hours for your local branch in the 'Locations' section of the app."
        },
        {
          question: "How do I report a lost card?",
          keywords: ["lost", "card", "stolen", "report", "missing"],
          answer: "To report a lost or stolen card, please go to 'Cards' in the app menu, select the affected card, and tap on 'Report Lost/Stolen'. Alternatively, you can call our 24/7 customer service at +46 123 456 789."
        },
        {
          question: "How do I activate my new card?",
          keywords: ["activate", "card", "new", "enable"],
          answer: "To activate your new card, go to 'Cards' in the app menu, select your new card, and tap on 'Activate Card'. You'll need to enter the last 4 digits of your card number and follow the verification steps."
        },
        {
          question: "How do I view my account balance?",
          keywords: ["balance", "account", "money", "view", "check"],
          answer: "Your account balance is displayed on the main dashboard when you log in to the app. You can also tap on any account to see detailed transaction history and current balance."
        },
        {
          question: "How do I set up recurring payments?",
          keywords: ["recurring", "payment", "automatic", "schedule", "regular"],
          answer: "To set up recurring payments, go to 'Payments' in the app menu, then select 'Recurring Payments'. Tap on 'Create New' and follow the instructions to set up the payment details and schedule."
        },
        {
          question: "How do I update my contact information?",
          keywords: ["contact", "information", "update", "change", "phone", "email", "address"],
          answer: "To update your contact information, go to 'Profile' in the app menu, then select 'Personal Information'. You can edit your phone number, email address, and mailing address there."
        },
        {
          question: "How do I apply for a loan?",
          keywords: ["loan", "apply", "credit", "borrow", "application"],
          answer: "To apply for a loan, go to 'Products' in the app menu, select 'Loans', and then choose the type of loan you're interested in. Follow the application process and provide the required documentation."
        },
        {
          question: "How do I contact customer support?",
          keywords: ["contact", "support", "help", "assistance", "service"],
          answer: "You can contact our customer support team through the 'Help' section in the app menu. You can choose to call us, send a secure message, or schedule a callback. Our phone support is available 24/7 at +46 123 456 789."
        }
      ];
      
      // Create directories if they don't exist
      if (!fs.existsSync(path.dirname(KNOWLEDGE_FILE))) {
        fs.mkdirSync(path.dirname(KNOWLEDGE_FILE), { recursive: true });
      }
      
      // Write default FAQs to file
      fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(defaultFAQs, null, 2));
      return defaultFAQs;
    }
    
    // Read and parse the file
    const fileContent = fs.readFileSync(KNOWLEDGE_FILE, 'utf-8');
    const faqs = JSON.parse(fileContent);
    
    // Add keywords if they don't exist (for backward compatibility)
    faqs.forEach(faq => {
      if (!faq.keywords) {
        const words = faq.question.toLowerCase().split(/\s+/);
        faq.keywords = words.filter(word => word.length > 3);
      }
    });
    
    return faqs;
  } catch (error) {
    console.error('Error loading knowledge base:', error);
    return [];
  }
}

/**
 * Add a new FAQ to the knowledge base
 * @param {string} question - The question
 * @param {string} answer - The answer
 * @param {Array} keywords - Optional keywords for better matching
 * @returns {boolean} Success status
 */
function addFAQ(question, answer, keywords = []) {
  try {
    const faqs = loadFAQs();
    
    // Generate keywords if not provided
    if (keywords.length === 0) {
      keywords = question.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3);
    }
    
    // Add new FAQ
    faqs.push({ question, answer, keywords });
    
    // Write back to file
    fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(faqs, null, 2));
    return true;
  } catch (error) {
    console.error('Error adding FAQ:', error);
    return false;
  }
}

/**
 * Find the best match for a user question in the knowledge base
 * @param {string} userQuestion - The user's question
 * @returns {object|null} The best match or null if no good match found
 */
function findBestMatch(userQuestion) {
  try {
    console.log(`Finding best match for: "${userQuestion}"`);
    const faqs = loadFAQs();
    
    // Normalize user question (lowercase, remove punctuation)
    const normalizedQuestion = userQuestion.toLowerCase().replace(/[^\w\s]/g, '');
    const userWords = normalizedQuestion.split(/\s+/).filter(word => word.length > 2);
    
    console.log(`User words: ${userWords.join(', ')}`);
    
    let bestMatch = null;
    let highestScore = 0;
    
    // Improved matching algorithm
    for (const faq of faqs) {
      // Calculate different types of matches
      
      // 1. Direct keyword matches
      let keywordMatches = 0;
      const keywords = faq.keywords || [];
      
      for (const keyword of keywords) {
        if (normalizedQuestion.includes(keyword.toLowerCase())) {
          keywordMatches++;
        }
      }
      
      // 2. Word matches
      let wordMatches = 0;
      for (const word of userWords) {
        if (keywords.some(keyword => keyword.toLowerCase() === word)) {
          wordMatches++;
        }
      }
      
      // 3. Question similarity
      const normalizedFAQ = faq.question.toLowerCase().replace(/[^\w\s]/g, '');
      
      // Calculate simple similarity score based on word overlap
      const faqWords = normalizedFAQ.split(/\s+/).filter(word => word.length > 2);
      let questionSimilarity = 0;
      
      for (const word of userWords) {
        if (faqWords.includes(word)) {
          questionSimilarity++;
        }
      }
      
      // Special case: check for specific patterns like "change password"
      let patternBonus = 0;
      if ((normalizedQuestion.includes('change') && normalizedQuestion.includes('password')) && 
          (normalizedFAQ.includes('change') && normalizedFAQ.includes('password'))) {
        patternBonus = 2;
        console.log(`Pattern bonus applied for "${faq.question}"`);
      }
      
      // Calculate final score (weighted combination)
      // Word matches are most important, followed by keyword matches
      const keywordWeight = 1.0;
      const wordWeight = 1.5;
      const similarityWeight = 0.5;
      const patternWeight = 2.0;
      
      const keywordScore = keywords.length > 0 ? (keywordMatches / keywords.length) * keywordWeight : 0;
      const wordScore = userWords.length > 0 ? (wordMatches / userWords.length) * wordWeight : 0;
      const similarityScore = faqWords.length > 0 ? (questionSimilarity / faqWords.length) * similarityWeight : 0;
      const patternScore = patternBonus * patternWeight;
      
      const totalScore = keywordScore + wordScore + similarityScore + patternScore;
      
      console.log(`FAQ: "${faq.question}" - Score: ${totalScore.toFixed(2)} (keyword: ${keywordScore.toFixed(2)}, word: ${wordScore.toFixed(2)}, similarity: ${similarityScore.toFixed(2)}, pattern: ${patternScore.toFixed(2)})`);
      
      // Update best match if score is higher
      if (totalScore > highestScore) {
        highestScore = totalScore;
        bestMatch = {
          question: faq.question,
          answer: faq.answer,
          confidence: totalScore
        };
      }
    }
    
    // Log the best match
    if (bestMatch) {
      console.log(`Best match: "${bestMatch.question}" with confidence ${bestMatch.confidence.toFixed(2)}`);
    } else {
      console.log(`No good match found`);
    }
    
    return bestMatch;
  } catch (error) {
    console.error('Error finding match:', error);
    return null;
  }
}

module.exports = {
  loadFAQs,
  addFAQ,
  findBestMatch
};