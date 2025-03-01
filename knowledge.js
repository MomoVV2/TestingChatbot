// knowledge.js - Manages the knowledge base (FAQs)
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
          answer: "To change your password, go to 'Settings' in the app menu, select 'Security', and then tap on 'Change Password'. You'll need to enter your current password first, then your new password twice."
        },
        {
          question: "How do I transfer money?",
          answer: "To transfer money, tap on 'Transfers' in the bottom menu, select the account you want to transfer from, enter the recipient's details, and follow the prompts to complete the transfer."
        },
        {
          question: "What are the opening hours?",
          answer: "Our branches are typically open Monday to Friday from 9:00 AM to 4:00 PM. Some locations may have extended hours or Saturday hours. You can check the exact opening hours for your local branch in the 'Locations' section of the app."
        },
        {
          question: "How do I report a lost card?",
          answer: "To report a lost or stolen card, please go to 'Cards' in the app menu, select the affected card, and tap on 'Report Lost/Stolen'. Alternatively, you can call our 24/7 customer service at +46 123 456 789."
        },
        {
          question: "How do I activate my new card?",
          answer: "To activate your new card, go to 'Cards' in the app menu, select your new card, and tap on 'Activate Card'. You'll need to enter the last 4 digits of your card number and follow the verification steps."
        },
        {
          question: "How do I view my account balance?",
          answer: "Your account balance is displayed on the main dashboard when you log in to the app. You can also tap on any account to see detailed transaction history and current balance."
        },
        {
          question: "How do I set up recurring payments?",
          answer: "To set up recurring payments, go to 'Payments' in the app menu, then select 'Recurring Payments'. Tap on 'Create New' and follow the instructions to set up the payment details and schedule."
        },
        {
          question: "How do I update my contact information?",
          answer: "To update your contact information, go to 'Profile' in the app menu, then select 'Personal Information'. You can edit your phone number, email address, and mailing address there."
        },
        {
          question: "How do I apply for a loan?",
          answer: "To apply for a loan, go to 'Products' in the app menu, select 'Loans', and then choose the type of loan you're interested in. Follow the application process and provide the required documentation."
        },
        {
          question: "How do I contact customer support?",
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
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Error loading knowledge base:', error);
    return [];
  }
}

/**
 * Add a new FAQ to the knowledge base
 * @param {string} question - The question
 * @param {string} answer - The answer
 * @returns {boolean} Success status
 */
function addFAQ(question, answer) {
  try {
    const faqs = loadFAQs();
    
    // Add new FAQ
    faqs.push({ question, answer });
    
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
    const faqs = loadFAQs();
    
    // Normalize user question (lowercase, remove punctuation)
    const normalizedQuestion = userQuestion.toLowerCase().replace(/[^\w\s]/g, '');
    
    let bestMatch = null;
    let highestScore = 0;
    
    // Simple keyword matching algorithm
    for (const faq of faqs) {
      const normalizedFAQ = faq.question.toLowerCase().replace(/[^\w\s]/g, '');
      
      // Extract keywords (words with 3+ characters)
      const keywords = normalizedFAQ.split(' ').filter(word => word.length >= 3);
      
      // Count matches
      let matchCount = 0;
      for (const keyword of keywords) {
        if (normalizedQuestion.includes(keyword)) {
          matchCount++;
        }
      }
      
      // Calculate score (0-1 range)
      const score = keywords.length > 0 ? matchCount / keywords.length : 0;
      
      // Update best match if score is higher
      if (score > highestScore) {
        highestScore = score;
        bestMatch = {
          question: faq.question,
          answer: faq.answer,
          confidence: score
        };
      }
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