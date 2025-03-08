// server.js - Updated with improved JSON FAQ support, advanced matching and direct navigation
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import fs from "fs";
import cors from "cors";
import os from "os";

// __dirname-Äquivalent für ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// IPv4 address for Ollama
const OLLAMA_HOST = "127.0.0.1";
const OLLAMA_PORT = 11434;
// Timeout für Ollama-Anfragen reduziert auf 5000ms
const OLLAMA_TIMEOUT = 5000;

// Knowledge base directory
const KNOWLEDGE_DIR = path.join(__dirname, "knowledge");
const FAQ_DIR = path.join(KNOWLEDGE_DIR, "faqs");

// FAQ-Kategorien und ihre URLs
const FAQ_URLS = {
  "kreditkarte": "https://www.hanseaticbank.de/hilfe-services/alle-faq/kreditkarte",
  "apple pay": "https://www.hanseaticbank.de/hilfe-services/alle-faq/apple-pay",
  "google pay": "https://www.hanseaticbank.de/hilfe-services/alle-faq/google-pay",
  "online banking": "https://www.hanseaticbank.de/hilfe-services/alle-faq/online-banking",
  "versicherung": "https://www.hanseaticbank.de/hilfe-services/alle-faq/versicherung",
  "kredit": "https://www.hanseaticbank.de/hilfe-services/alle-faq/kredit",
  "geldanlage": "https://www.hanseaticbank.de/hilfe-services/alle-faq/geldanlage",
  "vorteilswelt": "https://www.hanseaticbank.de/hilfe-services/alle-faq/vorteilswelt",
  "psd2": "https://www.hanseaticbank.de/hilfe-services/alle-faq",
  "online identifikation": "https://www.hanseaticbank.de/hilfe-services/alle-faq"
};

// Globaler Cache für FAQs und Antworten
const globalCache = {
  faqs: null,
  responses: new Map(),
  clearResponsesCache: function () {
    this.responses.clear();
    console.log("Response cache cleared");
  },
  clearAllCache: function () {
    this.faqs = null;
    this.responses.clear();
    console.log("All caches cleared");
  }
};

// Deutsche Stopwörter – Hilfreich für die Textanalyse
const GERMAN_STOPWORDS = [
  "der", "die", "das", "den", "dem", "des",
  "ein", "eine", "einer", "eines", "einem", "einen",
  "und", "oder", "aber", "wenn", "weil", "als", "wie",
  "zu", "in", "aus", "auf", "über", "unter", "für", "mit", "von", "bei",
  "ich", "du", "er", "sie", "es", "wir", "ihr", "sie",
  "mich", "dich", "sich", "uns", "euch",
  "ist", "bin", "bist", "sind", "seid", "sein", "war", "waren", "wird", "werden", "wurde", "wurden",
  "hat", "habe", "haben", "hatte", "hatten",
  "kann", "können", "könnte", "könnten",
  "dass", "daß", "ob", "weil", "obwohl", "damit", "sodass", "sodaß"
];

// Funktion zur Erkennung konversationeller Anfragen
function isConversationalQuery(message) {
  const conversationalPatterns = [
    /^(hallo|hi|hey|guten (morgen|tag|abend)|servus|moin)(\s.*)?$/i,
    /^wie geht('?s| es dir)(\s.*)?$/i,
    /^was (kannst|machst|tust) du(\s.*)?$/i,
    /^wer bist du(\s.*)?$/i,
    /^(danke|vielen dank|thx|thanks)(\s.*)?$/i,
    /^(hilfe|help)$/i,
  ];
  return conversationalPatterns.some(pattern => pattern.test(message.trim().toLowerCase()));
}

// Vorgegebene konversationelle Antworten
const conversationalResponses = {
  greeting:
    "Hallo! Wie kann ich Ihnen mit der Hanseatic Bank Mobile App helfen?",
  howAreYou:
    "Mir geht es gut, danke der Nachfrage! Wie kann ich Ihnen mit der Hanseatic Bank Mobile App helfen?",
  whatCanYouDo:
    "Ich bin der virtuelle Assistent der Hanseatic Bank und kann Ihnen bei Fragen zur Mobile App, Kreditkarten, Online-Banking und anderen Bankdienstleistungen helfen. Was möchten Sie wissen?",
  whoAreYou:
    "Ich bin der virtuelle Assistent der Hanseatic Bank. Ich helfe Ihnen gerne bei Fragen rund um unsere Produkte und Services. Wie kann ich Ihnen heute helfen?",
  thanks: "Gerne! Kann ich Ihnen noch mit etwas anderem helfen?",
  help:
    "Ich helfe Ihnen gerne mit Informationen zu Ihrer Kreditkarte, Online-Banking, der Mobile App und vielen weiteren Themen. Was möchten Sie genauer wissen?",
  unknown:
    "Ich bin der Hanseatic Bank Assistent und helfe bei Fragen zur Banking-App und Kreditkarten. Wie kann ich Ihnen heute helfen?"
};

// Funktion, um konversationelle Antworten zu erzeugen
function getConversationalResponse(message) {
  const lowerMessage = message.trim().toLowerCase();
  if (/^(hallo|hi|hey|guten (morgen|tag|abend)|servus|moin)/i.test(lowerMessage)) {
    return conversationalResponses.greeting;
  }
  if (/wie geht('?s| es dir)/i.test(lowerMessage)) {
    return conversationalResponses.howAreYou;
  }
  if (/was (kannst|machst|tust) du/i.test(lowerMessage)) {
    return conversationalResponses.whatCanYouDo;
  }
  if (/wer bist du/i.test(lowerMessage)) {
    return conversationalResponses.whoAreYou;
  }
  if (/(danke|vielen dank|thx|thanks)/i.test(lowerMessage)) {
    return conversationalResponses.thanks;
  }
  if (/^(hilfe|help)$/i.test(lowerMessage)) {
    return conversationalResponses.help;
  }
  return conversationalResponses.unknown;
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(cors());

// Logging aller eingehenden Anfragen
app.use((req, res, next) => {
  const clientIp =
    req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  console.log(
    `${new Date().toISOString()} - ${req.method} ${req.url} - Client IP: ${clientIp}`
  );
  if (req.method === "POST" && req.body) {
    console.log(
      "Body Preview:",
      JSON.stringify(req.body).substring(0, 200) + "..."
    );
  }
  next();
});

// Initialisiere Wissensverzeichnis
function initKnowledgeDir() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
    fs.mkdirSync(FAQ_DIR, { recursive: true });
    const sampleTextFaqFile = path.join(FAQ_DIR, "hanseatic-bank-faqs-german.txt");
    const sampleJsonFaqFile = path.join(FAQ_DIR, "hanseaticbank_faq.json");
    if (!fs.existsSync(sampleTextFaqFile)) {
      fs.writeFileSync(sampleTextFaqFile, createSampleGermanFaqs());
      console.log(`Created sample German FAQ text file at ${sampleTextFaqFile}`);
    }
    if (!fs.existsSync(sampleJsonFaqFile)) {
      fs.writeFileSync(
        sampleJsonFaqFile,
        JSON.stringify(createSampleGermanJsonFaqs(), null, 2)
      );
      console.log(`Created sample German FAQ JSON file at ${sampleJsonFaqFile}`);
    }
  }
}

// Beispiel-FAQs im TXT-Format
function createSampleGermanFaqs() {
  return `# Hanseatic Bank Mobile App FAQs
# Format: Frage | Schlüsselwörter | Antwort

Was ist die Hanseatic Bank Mobile App? | app, mobile, hanseatic, über, überblick | Kostenlose Begleit-App zur Verwaltung Ihrer Hanseatic Bank Kreditkarte auf Android (8.0+) und iOS (16.0+) Geräten.

Welche Systemanforderungen hat die App? | anforderungen, system, kompatibilität, android, ios, version | Android 8.0+ oder iOS 16.0+. Nicht für Tablets optimiert.

Welche Funktionen bietet die App? | funktionen, features, möglichkeiten | Transaktionen einsehen, Benachrichtigungen erhalten, Zahlungen verwalten, Kartensicherheit kontrollieren, Einstellungen anpassen und Apple Pay/Google Pay nutzen.

Wie ändere ich meine PIN? | pin, ändern, aktualisieren, neu, zurücksetzen | Gehen Sie zu "Karten- und Kontoservice" → "Meine Wunsch-PIN". Geben Sie die neue PIN zweimal ein und bestätigen Sie mit Zwei-Faktor-Authentifizierung.

Was soll ich tun, wenn ich mein Passwort vergessen habe? | passwort, vergessen, zurücksetzen, login | Tippen Sie auf "Passwort vergessen" auf der Login-Seite und folgen Sie den Verifizierungsschritten per E-Mail/SMS, um Ihr Passwort zurückzusetzen.`;
}

// Beispiel-FAQs im JSON-Format
function createSampleGermanJsonFaqs() {
  return {
    "App Hanseatic Bank Mobile": {
      "Was ist die Hanseatic Bank Mobile App?":
        "Kostenlose Begleit-App zur Verwaltung Ihrer Hanseatic Bank Kreditkarte auf Android (8.0+) und iOS (16.0+) Geräten.",
      "Welche Systemanforderungen hat die App?":
        "Android 8.0+ oder iOS 16.0+. Nicht für Tablets optimiert."
    },
    "Kreditkarte": {
      "Wie ändere ich meine PIN?":
        "Gehen Sie zu \"Karten- und Kontoservice\" → \"Meine Wunsch-PIN\". Geben Sie die neue PIN zweimal ein und bestätigen Sie mit Zwei-Faktor-Authentifizierung."
    },
    "Online Banking": {
      "Was soll ich tun, wenn ich mein Passwort vergessen habe?":
        "Tippen Sie auf \"Passwort vergessen\" auf der Login-Seite und folgen Sie den Verifizierungsschritten per E-Mail/SMS, um Ihr Passwort zurückzusetzen."
    }
  };
}

// Parse eine FAQ-Textdatei
function parseFaqFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const faqs = [];
    for (const line of lines) {
      if (line.trim().startsWith("#") || line.trim() === "") {
        continue;
      }
      const parts = line.split("|").map((part) => part.trim());
      if (parts.length >= 3) {
        const question = parts[0];
        const keywords = parts[1].split(",").map((keyword) => keyword.trim());
        const answer = parts[2];
        faqs.push({
          question,
          keywords,
          answer,
          source: path.basename(filePath),
          category: path.basename(filePath, path.extname(filePath)).replace(/^.*-/, "")
        });
      }
    }
    return faqs;
  } catch (error) {
    console.error(`Error parsing FAQ text file ${filePath}:`, error);
    return [];
  }
}

// Parse eine FAQ-JSON-Datei
function parseJsonFaqFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    console.log(`Dateiinhalt (erste 200 Zeichen): ${content.substring(0, 200)}...`);
    let cleanedContent = content.replace(/^c{/, "{");
    if (
      cleanedContent.trim().startsWith('"id":') ||
      cleanedContent.trim().startsWith('"category_id":') ||
      cleanedContent.trim().startsWith(",")
    ) {
      console.log("JSON-Fragment erkannt, ergänze Wrapper-Struktur");
      cleanedContent = `{"faqs": [${
        cleanedContent.trim().startsWith(",") ? cleanedContent.trim().substring(1) : cleanedContent
      }]}`;
      console.log(`Bereinigter JSON-Anfang: ${cleanedContent.substring(0, 100)}...`);
    }
    let data;
    try {
      data = JSON.parse(cleanedContent);
      console.log("JSON erfolgreich geparst");
    } catch (e) {
      console.error(`JSON-Parse-Fehler: ${e.message}`);
      console.log(
        `Problematischer JSON-Bereich: ${
          e.message.includes("position")
            ? cleanedContent.substring(parseInt(e.message.match(/position (\d+)/)[1]) - 30, parseInt(e.message.match(/position (\d+)/)[1]) + 30)
            : "unbekannt"
        }`
      );
      return [];
    }
    console.log(`JSON-Struktur: ${Object.keys(data).join(", ")}`);
    const faqs = [];
    if (data.meta && data.categories && data.faqs) {
      console.log(`Verarbeite verbesserte JSON-Struktur mit ${data.faqs.length} FAQs`);
      const categoryMap = {};
      data.categories.forEach((cat) => {
        categoryMap[cat.id] = cat.name;
      });
      for (const faq of data.faqs) {
        console.log(`Verarbeite FAQ: ID=${faq.id}, Frage="${faq.question?.substring(0, 30)}...", Kategorie=${faq.category_id}`);
        if (!faq.question || !faq.answer) {
          console.warn(`Überspringe FAQ ${faq.id || "ohne ID"}: Frage oder Antwort fehlt`);
          continue;
        }
        const categoryName =
          categoryMap[faq.category_id] ||
          (faq.category_id ? faq.category_id.replace(/^category_/, "") : "Unbekannt");
        faqs.push({
          question: faq.question,
          answer: faq.answer,
          keywords: faq.keywords || [],
          category: categoryName,
          tags: faq.tags || [],
          source: path.basename(filePath)
        });
      }
    }
    else if (Array.isArray(data)) {
      console.log(`Verarbeite Array von FAQ-Objekten mit ${data.length} Elementen`);
      for (const faq of data) {
        console.log(`Prüfe Objekt: ${Object.keys(faq).join(", ")}`);
        if (faq.question && faq.answer) {
          console.log(`Gefunden: Frage="${faq.question.substring(0, 30)}..."`);
          const categoryName = faq.category_id ? faq.category_id.replace(/^category_/, "") : "Unbekannt";
          faqs.push({
            question: faq.question,
            answer: faq.answer,
            keywords: faq.keywords || [],
            category: categoryName,
            tags: faq.tags || [],
            source: path.basename(filePath)
          });
        }
        else {
          console.warn(`Überspringe Objekt: Frage oder Antwort fehlt`);
        }
      }
    }
    else if (data.faqs && Array.isArray(data.faqs)) {
      console.log(`Verarbeite JSON-Objekt mit faqs-Array (${data.faqs.length} Elemente)`);
      for (const faq of data.faqs) {
        console.log(`Prüfe FAQ: ${Object.keys(faq).join(", ")}`);
        if (faq.question && faq.answer) {
          console.log(`Gültige FAQ gefunden: Frage="${faq.question.substring(0, 30)}..."`);
          const categoryName = faq.category_id ? faq.category_id.replace(/^category_/, "") : "Unbekannt";
          faqs.push({
            question: faq.question,
            answer: faq.answer,
            keywords: faq.keywords || [],
            category: categoryName,
            tags: faq.tags || [],
            source: path.basename(filePath)
          });
        }
        else {
          console.warn(`Überspringe FAQ: Frage=${!!faq.question}, Antwort=${!!faq.answer}`);
        }
      }
    }
    else {
      console.log(`Verarbeite traditionelle JSON-Struktur`);
      function extractQuestionsAndAnswers(obj, currentCategory = "Allgemein") {
        if (typeof obj !== "object" || obj === null) return;
        for (const key in obj) {
          const value = obj[key];
          if (typeof value === "string") {
            console.log(`Frage-Antwort-Paar gefunden: Frage="${key.substring(0, 30)}..."`);
            const extractedKeywords = extractKeywords(`${key} ${value}`);
            faqs.push({
              question: key,
              answer: value,
              keywords: extractedKeywords,
              category: currentCategory,
              source: path.basename(filePath)
            });
          }
          else if (typeof value === "object" && value !== null) {
            if (Object.keys(value).some((k) => typeof value[k] === "string")) {
              console.log(`Kategorie gefunden: ${key} mit ${Object.keys(value).length} Einträgen`);
              extractQuestionsAndAnswers(value, key);
            }
            else {
              console.log(`Verschachteltes Objekt gefunden in Kategorie ${currentCategory}`);
              extractQuestionsAndAnswers(value, currentCategory);
            }
          }
        }
      }
      extractQuestionsAndAnswers(data);
    }
    console.log(`Insgesamt ${faqs.length} FAQs extrahiert aus ${filePath}`);
    return faqs;
  }
  catch (error) {
    console.error(`Error parsing FAQ JSON file ${filePath}:`, error);
    console.error(`Error details: ${error.message}`);
    console.error(`Error stack: ${error.stack}`);
    if (error instanceof SyntaxError) {
      console.error(`JSON syntax error. Prüfe das Format deiner JSON-Datei: ${filePath}`);
    }
    return [];
  }
}

// Extrahiere Schlüsselwörter aus Text
function extractKeywords(text) {
  if (!text || typeof text !== "string") return [];
  const normalizedText = text.toLowerCase()
    .replace(/[^\wäöüßÄÖÜ\s\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = normalizedText.split(/\s+/);
  const filteredWords = words
    .filter(word => word.length > 3)
    .filter(word => !GERMAN_STOPWORDS.includes(word))
    .slice(0, 20);
  return filteredWords;
}

// Lade alle FAQs mit Caching-Unterstützung
function loadAllFaqs(forceReload = false) {
  if (globalCache.faqs && !forceReload) {
    return globalCache.faqs;
  }
  initKnowledgeDir();
  let allFaqs = [];
  try {
    const faqFiles = fs.readdirSync(FAQ_DIR);
    for (const file of faqFiles) {
      const filePath = path.join(FAQ_DIR, file);
      let faqs = [];
      if (file.endsWith(".txt")) {
        faqs = parseFaqFile(filePath);
      } else if (file.endsWith(".json")) {
        faqs = parseJsonFaqFile(filePath);
      }
      allFaqs = allFaqs.concat(faqs);
      console.log(`Loaded ${faqs.length} FAQs from ${file}`);
    }
    globalCache.faqs = allFaqs;
  }
  catch (error) {
    console.error("Error loading FAQs:", error);
  }
  return allFaqs;
}

// Funktion zur Erkennung direkter Navigationsanfragen (inklusive "nummer ändern")
function isDirectNavigationRequest(message) {
  const lowerMessage = message.trim().toLowerCase();

  // Neu: Varianten von "ändern" (z.B. "ändere", "ändert") mit "nummer"
  if (lowerMessage.includes("nummer") &&
      /(ändern|änder|ändere|wechseln|update|set|reset)/.test(lowerMessage)) {
    return "number";
  }
  
  // PIN change patterns
  if (
    /\b(ändern|änderung|wechseln|wechsel|setzen|zurücksetzen|change|update|set|reset)\s+pin\b/i.test(lowerMessage) ||
    /\bpin\s+(ändern|wechseln|zurücksetzen|change|reset)\b/i.test(lowerMessage) ||
    lowerMessage === "pin" ||
    lowerMessage === "pin ändern" ||
    lowerMessage === "change pin" ||
    lowerMessage.includes("pin?")
  ) {
    return "pin";
  }
  
  // Reference account patterns
  if (
    /\b(ändern|wechseln|aktualisieren|change|update)\s+(referenz|ref)\s+(konto|account)\b/i.test(lowerMessage) ||
    /\breferenz\s*konto\b/i.test(lowerMessage) ||
    /\breferenzkonto\b/i.test(lowerMessage) ||
    lowerMessage === "reference account" ||
    lowerMessage === "referenz konto" ||
    lowerMessage.includes("referenzkonto?") ||
    lowerMessage.includes("reference account?")
  ) {
    return "reference";
  }
  
  // Email change patterns
  if (
    /\b(ändern|wechseln|aktualisieren|change|update)\s+e?-?mail\b/i.test(lowerMessage) ||
    lowerMessage === "email" ||
    lowerMessage === "e-mail" ||
    lowerMessage === "e-mail ändern" ||
    lowerMessage.includes("email?")
  ) {
    return "email";
  }
  
  // Fund transfer patterns
  if (
    /\b(überweisen|überweisung|senden|schicken|transfer)\s+(geld|betrag|summe|money|funds)\b/i.test(lowerMessage) ||
    /\b(geld|money|funds)\s+(überweisen|senden|transfer)\b/i.test(lowerMessage) ||
    lowerMessage === "überweisung" ||
    lowerMessage === "transfer" ||
    lowerMessage === "geld senden" ||
    lowerMessage === "send money" ||
    lowerMessage.includes("überweisen?") ||
    lowerMessage.includes("transfer?")
  ) {
    return "transfer";
  }
  
  // Benefits patterns
  if (
    /\b(vorteile|benefits)\b/i.test(lowerMessage) ||
    lowerMessage === "vorteile" ||
    lowerMessage === "benefits" ||
    lowerMessage === "advantages" ||
    lowerMessage === "perks" ||
    lowerMessage.includes("vorteile?") ||
    lowerMessage.includes("benefits?")
  ) {
    return "benefits";
  }
  
  // Contact support patterns
  if (
    /\b(kontakt|kontaktieren|anrufen|sprechen mit|contact|call|speak to)\s+(support|hilfe|kundendienst)\b/i.test(lowerMessage) ||
    lowerMessage === "support" ||
    lowerMessage === "hilfe" ||
    lowerMessage === "help" ||
    lowerMessage === "kundenservice" ||
    lowerMessage === "contact" ||
    lowerMessage.includes("kontakt?") ||
    lowerMessage.includes("support?") ||
    lowerMessage.includes("contact?")
  ) {
    return "support";
  }
  
  // FAQ patterns
  if (
    /\b(zeigen|anzeigen|sehen|ansehen|prüfen|show|go to|view|see|check)\s+faq\b/i.test(lowerMessage) ||
    lowerMessage === "faq" ||
    lowerMessage === "faqs" ||
    lowerMessage === "häufig gestellte fragen" ||
    lowerMessage.includes("faq?")
  ) {
    return "faq";
  }
  
  return null;
}

// Direkt definierte Antworten – inkl. "number"
const directResponses = {
  "pin": "Ich kann Ihnen helfen, Ihre PIN zu ändern.",
  "reference": "Ich kann Ihnen helfen, Ihr Referenzkonto zu ändern.",
  "email": "Ich kann Ihnen helfen, Ihre E-Mail-Adresse zu aktualisieren.",
  "transfer": "Ich kann Ihnen helfen, Geld zu überweisen.",
  "benefits": "Ich kann Ihnen die Vorteile Ihres Kontos zeigen.",
  "support": "Ich verbinde Sie mit unserem Kundenservice.",
  "faq": "Hier sind unsere häufig gestellten Fragen.",
  "number":
    "Ich kann Ihnen helfen, Ihre Nummer zu ändern. Bitte klicken Sie auf den 'Nummer ändern'-Button."
};

// Advanced matching for FAQ lookup with ranked results
function findBestMatch(userQuestion) {
  try {
    console.log(`Finding best match for: "${userQuestion}"`);
    const faqs = loadAllFaqs();
    const isShortQuery = userQuestion.trim().split(/\s+/).length <= 2;
    const normalizedQuestion = userQuestion.toLowerCase()
      .replace(/[^\wäöüßÄÖÜ\-\s]/g, '')
      .trim();
    console.log(`Normalisierte Frage: "${normalizedQuestion}"`);
    const userWords = normalizedQuestion
      .split(/[\s\-]+/)
      .filter(word => word.length > 1);
    console.log(`Extrahierte Wörter: [${userWords.join(", ")}]`);

    const importantTerms = [
      "urlaubsplus", "reisebonus", "reisewelt", "vorteilswelt",
      "rabatt", "holidays", "buchung", "account", "idnow", "webid",
      "visa", "secure", "goldcard", "genialcard", "apple", "google",
      "pin", "sicherreise", "sichermobil", "sichertasche",
      "geld", "überweisung", "kreditkarte", "banking", "konto", "online"
    ];

    const productNames = [
      "idnow", "webid", "goldcard", "genialcard", "visa", "apple pay",
      "google pay", "sicherreise", "sichermobil", "sichertasche", "sicherportemonnaie"
    ];

    if (isShortQuery) {
      const hasImportantTerms = userWords.some(
        word => importantTerms.includes(word) ||
                importantTerms.some(term => term.includes(word))
      );
      if (!hasImportantTerms) {
        console.log("Kurze Anfrage ohne wichtige Begriffe - wahrscheinlich konversationell");
        return null;
      }
    }
    const containsProductName = productNames.some(product =>
      normalizedQuestion.includes(product)
    );

    let matches = [];
    for (const faq of faqs) {
      const faqQuestion = faq.question || "";
      const faqNormalized = faqQuestion.toLowerCase()
        .replace(/[^\wäöüßÄÖÜ\s]/g, '')
        .trim();
      const faqKeywords = faq.keywords || [];
      let score = 0;
      let matchReasons = [];

      if (normalizedQuestion === faqNormalized) {
        score += 1.0;
        matchReasons.push("exakte_frage");
      } else if (faqNormalized.includes(normalizedQuestion)) {
        const lengthRatio = normalizedQuestion.length / faqNormalized.length;
        score += 0.7 * lengthRatio;
        matchReasons.push("frage_enthält_anfrage");
      } else if (normalizedQuestion.includes(faqNormalized)) {
        const lengthRatio = faqNormalized.length / normalizedQuestion.length;
        score += 0.5 * lengthRatio;
        matchReasons.push("anfrage_enthält_frage");
      }

      let keywordBoost = 0;
      let keywordHits = 0;
      let specialKeywordHits = 0;
      for (const keyword of faqKeywords) {
        const normalizedKeyword = keyword.toLowerCase().trim();
        const isSpecialKeyword = productNames.some(product =>
          normalizedKeyword.includes(product)
        );
        if (normalizedQuestion === normalizedKeyword) {
          keywordBoost += isSpecialKeyword ? 1.2 : 0.9;
          keywordHits++;
          if (isSpecialKeyword) specialKeywordHits++;
          matchReasons.push(`keyword_exakt_${normalizedKeyword}`);
        } else if (normalizedQuestion.includes(normalizedKeyword)) {
          const boost = (isSpecialKeyword ? 1.0 : 0.7) * (normalizedKeyword.length / normalizedQuestion.length);
          keywordBoost += boost;
          keywordHits++;
          if (isSpecialKeyword) specialKeywordHits++;
          matchReasons.push(`keyword_enthalten_${normalizedKeyword}`);
        } else if (normalizedKeyword.includes(normalizedQuestion)) {
          const boost = (isSpecialKeyword ? 0.8 : 0.5) * (normalizedQuestion.length / normalizedKeyword.length);
          keywordBoost += boost;
          keywordHits++;
          if (isSpecialKeyword) specialKeywordHits++;
          matchReasons.push(`keyword_enthält_anfrage_${normalizedKeyword}`);
        }
      }
      if (faqKeywords.length > 0) {
        const keywordMultiplier = isShortQuery ? 0.7 : 1.0;
        score += keywordBoost * (keywordMultiplier / Math.sqrt(faqKeywords.length));
      }
      if (specialKeywordHits > 0) {
        score += 0.3 * specialKeywordHits;
        matchReasons.push(`spezial_keywords_${specialKeywordHits}`);
      }
      const faqWords = faqNormalized.split(/\s+/).filter(w => w.length > 2);
      let wordMatches = 0;
      let specialWordMatches = 0;
      for (const word of userWords) {
        if (word.length > 2 && faqWords.includes(word)) {
          wordMatches++;
          if (productNames.some(product =>
            product.includes(word) || word.includes(product)
          )) {
            specialWordMatches++;
          }
        }
      }
      if (userWords.length > 0 && wordMatches > 0) {
        const wordMatchMultiplier = isShortQuery ? 0.1 : 0.2;
        const wordMatchScore = wordMatchMultiplier * (wordMatches / userWords.length);
        const specialTermScore = specialWordMatches > 0 ? 0.4 * specialWordMatches : 0;
        score += wordMatchScore + specialTermScore;
        matchReasons.push(`wort_matches_${wordMatches}`);
        if (specialWordMatches > 0) {
          matchReasons.push(`spezial_wort_matches_${specialWordMatches}`);
        }
      }
      if (containsProductName && faqQuestion.toLowerCase().includes(normalizedQuestion)) {
        score += 0.6;
        matchReasons.push("produktname_im_titel");
      }
      for (const term of importantTerms) {
        if (normalizedQuestion.includes(term) &&
            (faqNormalized.includes(term) || faqKeywords.some(k => k.toLowerCase().includes(term)))) {
          const termBoost = productNames.includes(term) ? 0.8 : 0.5;
          score += termBoost;
          matchReasons.push(`wichtiger_begriff_${term}`);
          break;
        }
      }
      if (faq.category && (
          faq.category.toLowerCase().includes(normalizedQuestion) ||
          normalizedQuestion.includes(faq.category.toLowerCase())
      )) {
        score += 0.4;
        matchReasons.push("kategorie_direkt_enthalten");
      }
      const userCategories = extractCategories(userQuestion);
      if (userCategories.length > 0 && faq.category &&
          userCategories.includes(faq.category.toLowerCase())) {
        score += 0.3;
        matchReasons.push(`kategorie_match_${faq.category}`);
      }
      const normalizedAnswer = (faq.answer || "").toLowerCase();
      for (const term of importantTerms) {
        if (normalizedQuestion.includes(term) && normalizedAnswer.includes(term)) {
          const termBoost = productNames.includes(term) ? 0.3 : 0.2;
          score += termBoost;
          matchReasons.push(`antwort_enthält_${term}`);
          break;
        }
      }
      let missingKeywordCount = 0;
      for (const keyword of faqKeywords) {
        const normalizedKeyword = keyword.toLowerCase().trim();
        if (!normalizedQuestion.includes(normalizedKeyword)) {
          missingKeywordCount++;
        }
      }
      const penaltyFactor = 0.05;
      score -= missingKeywordCount * penaltyFactor;
      if (missingKeywordCount > 0) {
        matchReasons.push(`penalty_missing_${missingKeywordCount}`);
      }
      // GEÄNDERT: Schwelle für den Einsatz des FAQ-Matches auf 0.3 gesenkt
      const finalThreshold = isShortQuery ? 0.4 : 0.3;
      console.log(
        `Match für "${faqQuestion.substring(0, 40)}..." mit Score: ${score.toFixed(2)}. Gründe: ${matchReasons.join(", ")}`
      );
      if (score > finalThreshold) {
        matches.push({
          question: faqQuestion,
          answer: faq.answer,
          category: faq.category,
          confidence: score,
          matchReasons,
          answerLength: (faq.answer || "").length
        });
      }
    }
    matches.sort((a, b) => b.confidence - a.confidence);
    if (matches.length > 0) {
      const bestMatch = matches[0];
      console.log(`Best match found: "${bestMatch.question}" with confidence ${bestMatch.confidence.toFixed(2)}`);
      console.log(`Match reasons: ${bestMatch.matchReasons.join(", ")}`);
      return bestMatch;
    }
    console.log("No good match found");
    return null;
  } catch (error) {
    console.error("Error finding match:", error);
    return null;
  }
}

// Extrahiere potenzielle Kategorien aus der Nutzerfrage
function extractCategories(userQuestion) {
  const normalizedQuestion = userQuestion.toLowerCase();
  const knownCategories = [
    "app", "mobile", "kreditkarte", "pin", "passwort", "login", 
    "banking", "online", "überweisung", "verfügungsrahmen", "limit",
    "urlaubsplus", "reisewelt", "vorteilswelt", "reisebonus", "holidays",
    "geldanlage", "tagesgeld", "sparbrief", "kredit", "versicherung",
    "apple pay", "google pay", "idnow", "webid"
  ];
  return knownCategories.filter(category =>
    normalizedQuestion.includes(category.toLowerCase())
  );
}

// Erstelle Systemprompt (Deutsch) mit relevanten FAQs
function createSystemPrompt(faqs, knowledgeMatch) {
  let relevantFaqs = faqs;
  if (knowledgeMatch && knowledgeMatch.category) {
    const categoryFaqs = faqs.filter(faq => faq.category === knowledgeMatch.category);
    const otherFaqs = faqs.filter(faq => faq.category !== knowledgeMatch.category).slice(0, 5);
    relevantFaqs = [...categoryFaqs, ...otherFaqs];
  }
  relevantFaqs = relevantFaqs.slice(0, 15);
  return `Sie sind der KI-Assistent der Hanseatic Bank für In-App-Support. Ihre Aufgabe ist es, Kunden bei Fragen zu ihrer Banking-App zu helfen.

ÄUSSERST WICHTIGE RICHTLINIEN:
1. Halten Sie Antworten ULTRA-KURZ. Maximal 1-2 Sätze. Möglichst nie mehr als 200 Zeichen.
2. Kommen Sie direkt auf den Punkt. Keine Begrüßungen, keine Einleitungen, keine "Ich hoffe, das hilft" Floskeln.
3. Konzentrieren Sie sich ausschließlich auf die Hanseatic Bank App und ihre Dienste.
4. Verwenden Sie einen freundlichen, professionellen Ton.
5. Beantworten Sie nur bankbezogene Fragen.
6. Wenn nach spezifischen Kontodaten gefragt wird, erklären Sie, dass Sie keinen Zugriff auf persönliche Kontoinformationen haben.
7. Erwähnen Sie NIEMALS andere Dienste außer Apple Pay und Google Pay.
8. Antworten Sie AUSSCHLIESSLICH IN DEUTSCHER SPRACHE.
9. Niemals persönlich spezifische Informationen geben (z. B. "Ihre Nummer lautet...").

${knowledgeMatch ? `BENUTZERFRAGE TRIFFT AUF: "${knowledgeMatch.question}" mit Konfidenz ${knowledgeMatch.confidence.toFixed(2)}. Basieren Sie Ihre Antwort darauf. Kategorie: ${knowledgeMatch.category || "Allgemein"}` : ""}

WISSENSDATENBANK (RELEVANTE AUSWAHL):
${relevantFaqs.map(faq => `F: ${faq.question}\nA: ${faq.answer}\nKategorie: ${faq.category || "Allgemein"}`).join("\n\n")}`;
}

// API Endpoint: Cache leeren
app.get("/api/admin/clear-cache", (req, res) => {
  try {
    globalCache.clearResponsesCache();
    res.json({
      status: "success",
      message: "Response cache has been cleared"
    });
  }
  catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to clear cache",
      error: error.message
    });
  }
});

// API Endpoint: Ping
app.get("/api/ping", (req, res) => {
  res.json({
    status: "success",
    message: "Server ist erreichbar!",
    timestamp: new Date().toISOString(),
    serverInfo: {
      platform: process.platform,
      nodeVersion: process.version,
      uptime: process.uptime()
    }
  });
});

// API Endpoint: Test-Chat (ohne Ollama)
app.post("/api/test-chat", (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }
  console.log(`Test-Chat-Endpunkt empfing Nachricht: "${message}"`);
  const response = {
    response: `Echo: ${message} (Dies ist eine Test-Antwort ohne Ollama)`,
    timestamp: new Date().toISOString()
  };
  res.json(response);
});

// Teste Verbindung zu Ollama beim Start
function testOllamaConnection() {
  console.log(`Testing connection to Ollama at ${OLLAMA_HOST}:${OLLAMA_PORT}...`);
  const options = {
    hostname: OLLAMA_HOST,
    port: OLLAMA_PORT,
    path: "/api/tags",
    method: "GET"
  };
  const req = http.request(options, (res) => {
    let data = "";
    res.on("data", (chunk) => {
      data += chunk;
    });
    res.on("end", () => {
      if (res.statusCode === 200) {
        try {
          const parsed = JSON.parse(data);
          console.log("✅ Ollama connection successful!");
          console.log("Available models:", parsed.models ? parsed.models.map(m => m.name).join(", ") : "Unknown");
        }
        catch (e) {
          console.error("❌ Error parsing Ollama response:", e.message);
        }
      }
      else {
        console.error(`❌ Ollama returned status code ${res.statusCode}`);
      }
    });
  });
  req.on("error", (e) => {
    console.error(`❌ Failed to connect to Ollama: ${e.message}`);
    console.error(`Please make sure Ollama is running on http://${OLLAMA_HOST}:${OLLAMA_PORT}`);
  });
  req.end();
}

// Initialisiere Wissensdatenbank
initKnowledgeDir();

// Hauptseite ausliefern
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// API Endpoint: Chat
app.post("/api/chat", async (req, res) => {
  const startTime = Date.now();
  const { message, modelName } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }
  console.log(`Received message: "${message}"`);
  console.log(`Using model: ${modelName || "llama3:8b"}`);

  // Prüfe, ob es sich um eine direkte Navigationsanfrage handelt
  const directNavType = isDirectNavigationRequest(message);
  if (directNavType) {
    console.log(`Direct navigation request detected: ${directNavType}`);
    return res.json({
      status: "success",
      response: directNavType === "number"
        ? "Ich kann Ihnen helfen, Ihre Nummer zu ändern. Bitte klicken Sie auf den 'Nummer ändern'-Button."
        : directResponses[directNavType],
      directNavigation: directNavType
    });
  }

  // Prüfe, ob es sich um eine konversationelle Anfrage handelt
  if (isConversationalQuery(message)) {
    console.log(`Conversational query detected: "${message}"`);
    const response = getConversationalResponse(message);
    const cacheKey = message.trim().toLowerCase();
    globalCache.responses.set(cacheKey, response);
    return res.json({
      status: "success",
      response: response
    });
  }

  // Prüfe den Cache
  const cacheKey = message.trim().toLowerCase();
  if (globalCache.responses.has(cacheKey)) {
    const cachedResponse = globalCache.responses.get(cacheKey);
    console.log(`Using cached response for: "${message}"`);
    console.log(`Response time (cached): ${Date.now() - startTime}ms`);
    return res.json({
      status: "success",
      response: cachedResponse,
      fromCache: true
    });
  }

  // Versuche, einen passenden FAQ-Eintrag zu finden
  const knowledgeMatch = findBestMatch(message);
  // GEÄNDERT: Schwellenwert für mittelgute Matches von 0.4 auf 0.3 gesenkt
  if (knowledgeMatch && knowledgeMatch.confidence > 0.75) {
    console.log(`Using knowledge base answer with high confidence ${knowledgeMatch.confidence.toFixed(2)}`);
    console.log(`Response time: ${Date.now() - startTime}ms`);
    globalCache.responses.set(cacheKey, knowledgeMatch.answer);
    return res.json({
      status: "success",
      response: knowledgeMatch.answer
    });
  }
  if (knowledgeMatch && knowledgeMatch.confidence > 0.3) {
    console.log(`Using knowledge base answer with acceptable confidence ${knowledgeMatch.confidence.toFixed(2)}`);
    globalCache.responses.set(cacheKey, knowledgeMatch.answer);
    return res.json({
      status: "success",
      response: knowledgeMatch.answer
    });
  }

  // Schnelle Antwort für nicht-bankbezogene Fragen
  if (
    message.toLowerCase().includes("wetter") ||
    message.toLowerCase().includes("wer bist du") ||
    message.toLowerCase().includes("wie heißt du")
  ) {
    console.log("Non-banking question detected, sending quick response");
    let quickResponse = "Ich bin der Hanseatic Bank Assistent und helfe bei Fragen zur Banking-App und Kreditkarten.";
    if (message.toLowerCase().includes("wetter")) {
      quickResponse = "Ich kann leider keine Wetterinformationen bereitstellen. Kann ich Ihnen mit Bankthemen helfen?";
    }
    globalCache.responses.set(cacheKey, quickResponse);
    return res.json({
      status: "success",
      response: quickResponse
    });
  }

  // Falls kein ausreichender FAQ-Match gefunden wurde: Baue Systemprompt mit Kontext
  const faqs = loadAllFaqs();
  const systemPrompt = createSystemPrompt(faqs, knowledgeMatch);
  const postData = JSON.stringify({
    model: modelName || "llama3:8b",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message }
    ],
    stream: false
  });

  const options = {
    hostname: OLLAMA_HOST,
    port: OLLAMA_PORT,
    path: "/api/chat",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData)
    }
  };

  console.log(`Sending request to Ollama at ${OLLAMA_HOST}:${OLLAMA_PORT}...`);

  try {
    const defaultResponse = "Ich helfe Ihnen gerne mit Fragen zur Hanseatic Bank App und Ihren Diensten.";
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Ollama request timed out after ${OLLAMA_TIMEOUT}ms`));
      }, OLLAMA_TIMEOUT);
    });
    const requestPromise = new Promise((resolve, reject) => {
      const ollamaReq = http.request(options, (ollamaRes) => {
        let responseData = "";
        ollamaRes.on("data", (chunk) => {
          responseData += chunk;
        });
        ollamaRes.on("end", () => {
          if (ollamaRes.statusCode !== 200) {
            return reject(new Error(`Ollama returned status code ${ollamaRes.statusCode}`));
          }
          try {
            const parsedResponse = JSON.parse(responseData);
            resolve(parsedResponse.message.content);
          }
          catch (error) {
            reject(new Error(`Failed to parse Ollama response: ${error.message}`));
          }
        });
      });
      ollamaReq.on("error", (error) => {
        reject(new Error(`Error sending request to Ollama: ${error.message}`));
      });
      ollamaReq.write(postData);
      ollamaReq.end();
    });
    let aiResponse;
    try {
      aiResponse = await Promise.race([requestPromise, timeoutPromise]);
      console.log("Successfully received Ollama response in time");
      if (aiResponse.length > 300) {
        console.log("Response too long, truncating to 300 characters");
        aiResponse = aiResponse.substring(0, 300);
      }
      globalCache.responses.set(cacheKey, aiResponse);
    }
    catch (error) {
      console.error("Error or timeout in Ollama request:", error.message);
      aiResponse = defaultResponse;
      globalCache.responses.set(cacheKey, defaultResponse);
    }
    console.log(`Total response time: ${Date.now() - startTime}ms`);
    return res.json({
      status: "success",
      response: aiResponse
    });
  }
  catch (error) {
    console.error("Exception in Ollama request handler:", error);
    const genericResponse = "Ich stehe Ihnen für Fragen rund um die Hanseatic Bank App zur Verfügung.";
    globalCache.responses.set(cacheKey, genericResponse);
    return res.json({
      status: "success",
      response: genericResponse
    });
  }
});

// Admin-Route: Wissensdatenbank aktualisieren
app.post("/api/admin/refresh-knowledge", (req, res) => {
  try {
    globalCache.clearAllCache();
    const faqs = loadAllFaqs(true);
    res.json({
      success: true,
      message: `Successfully refreshed knowledge base. Loaded ${faqs.length} FAQs.`
    });
  }
  catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to refresh knowledge base",
      error: error.message
    });
  }
});

// API Endpoint: Server-Info für Debugging
app.get("/api/server-info", (req, res) => {
  const networkInterfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(networkInterfaces)) {
    for (const net of networkInterfaces[name]) {
      if (!net.internal && net.family === "IPv4") {
        addresses.push({
          interface: name,
          address: net.address
        });
      }
    }
  }
  const cachedResponsesCount = globalCache.responses.size;
  const faqCount = globalCache.faqs ? globalCache.faqs.length : 0;
  res.json({
    server: {
      platform: process.platform,
      nodeVersion: process.version,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    },
    cache: {
      responses: cachedResponsesCount,
      faqs: faqCount
    },
    network: {
      interfaces: addresses
    },
    ollama: {
      host: OLLAMA_HOST,
      port: OLLAMA_PORT,
      timeout: OLLAMA_TIMEOUT
    }
  });
});

// Server starten auf allen Interfaces (z.B. für mobile Geräte)
app.listen(PORT, "0.0.0.0", () => {
  console.log(`====== Hanseatic Bank Chat Server ======`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Local access: http://localhost:${PORT}`);
  const networkInterfaces = os.networkInterfaces();
  console.log("\nIP-Adressen für den Zugriff:");
  for (const name of Object.keys(networkInterfaces)) {
    for (const net of networkInterfaces[name]) {
      if (!net.internal && net.family === "IPv4") {
        console.log(`- ${name}: http://${net.address}:${PORT}`);
      }
    }
  }
  console.log("\nTest-Endpunkte für Verbindungsprobleme:");
  console.log(`- Ping-Test: http://localhost:${PORT}/api/ping`);
  console.log(`- Server-Info: http://localhost:${PORT}/api/server-info`);
  console.log(`- Test-Chat (ohne Ollama): POST http://localhost:${PORT}/api/test-chat`);
  console.log(`- Cache leeren: http://localhost:${PORT}/api/admin/clear-cache`);
  testOllamaConnection();
  console.log("\n========================================");
});
