# NordicBank AI Assistant

A lightweight AI assistant for NordicBank's in-app support, powered by Ollama.

## Features

- Chat interface for customer support
- Knowledge base of frequently asked questions
- Integration with Ollama for AI-powered responses
- Fallback to AI when knowledge base doesn't have an answer
- Contextual understanding of user queries

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or later)
- [Ollama](https://ollama.ai/) installed and running locally

## Setup Instructions

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/nordicbank-ai-assistant.git
cd nordicbank-ai-assistant
```

2. **Install dependencies**

```bash
npm install
```

3. **Make sure Ollama is running**

Ollama should be running locally on port 11434 (default port).

4. **Pull the models you want to use**

```bash
ollama pull llama3:8b
ollama pull phi3:mini
ollama pull gemma:7b
ollama pull mistral:7b
```

5. **Start the server**

```bash
npm start
```

6. **Open the application**

Open your browser and navigate to:
```
http://localhost:3000
```

## Project Structure

- `server.js` - Main Express server
- `ollama-client.js` - Handles communication with Ollama API
- `knowledge.js` - Manages the FAQ knowledge base
- `public/index.html` - Frontend HTML
- `public/script.js` - Frontend JavaScript
- `data/faqs.json` - JSON file storing FAQs (created automatically on first run)

## Customizing the Knowledge Base

The knowledge base is automatically created with some default banking FAQs. You can modify the `data/faqs.json` file to add your own questions and answers.

### FAQ Format

```json
[
  {
    "question": "How do I change my password?",
    "answer": "To change your password, go to 'Settings' in the app menu..."
  },
  {
    "question": "Another question",
    "answer": "Another answer"
  }
]
```

## Enhancing Your AI Assistant

### Improving the Knowledge Base

- Add more domain-specific questions and answers
- Add variations of the same question to improve matching
- Include technical terms and industry jargon

### Customizing the System Prompt

You can modify the system prompt in `ollama-client.js` to better guide the AI's responses.

### Training a Custom Model

For production use, consider fine-tuning a model specifically for banking customer service.

## License

MIT