# PhishDetect

PhishDetect is an AI-powered phishing detection system that uses agentic AI in a continuous feedback loop to autonomously analyze suspicious links. Our intelligent agent controls a sandboxed browser environment, making real-time decisions based on website content, network requests, and potential impersonation attempts to identify threats.

## Prerequisites

- Bun
- A Google Gemini API key

## Setup

### 1. Clone and Install Dependencies

**Frontend (Next.js):**

```bash
bun install
```

**Backend (Node.js server):**

```bash
cd server
bun install
```

### 2. Configure Environment

Create a `.env` file in the `server/` directory:

```
GEMINI_API_KEY=your_gemini_api_key_here
```

Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

## Running the Project

**Start the backend server:**

```bash
cd server
bun run dev
```

The server runs on `http://localhost:8000`.

**In a new terminal, start the frontend:**

```bash
bun run dev
```

Open `http://localhost:3000` in your browser.

## How It Works

1. Submit a suspicious URL through the web interface
2. PhishDetect spins up a sandboxed browser using Puppeteer
3. Gemini AI analyzes the site in real-time, detecting:
   - Form fields requesting sensitive information
   - Suspicious network requests
   - Content spoofing and impersonation
4. Returns a threat analysis and classification
