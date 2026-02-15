// gemini.ts
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { PageState } from "./puppeteer";

interface AIAction {
  action: "fill_form_and_submit" | "stop";
  opinion: string; // Summary of findings on current page state and why it feels like phishing or not
  formIndex?: number; // Which form to fill (if applicable)
  fakeData?: Record<string, string>; // Fake data to fill (if applicable)
}

interface AIResults {
  url: string;
  actions: AIAction[];
  finalThreatLevel: "safe" | "suspicious" | "critical";
  summary: string;
}

export class GeminiAnalyzer {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.initializeModel();
  }

  private initializeModel() {
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    });
  }

  async analyzePage(
    pageState: PageState,
    screenshot: string,
    currentUrl: string,
    iterationCount: number
  ): Promise<AIAction> {
    // Force stop after 10 iterations
    if (iterationCount >= 10) {
      return {
        action: "stop",
        opinion: "Maximum iteration limit reached (10). Final page shows potential infinite redirect loop or complex multi-step process, which is suspicious behavior."
      };
    }

    const prompt = this.buildAnalysisPrompt(pageState, screenshot, currentUrl, iterationCount);
    const result = await this.model.generateContent([
      prompt,
      {
        inlineData: {
          data: screenshot,
          mimeType: "image/png"
        }
      }
    ]);
    
    return this.parseAIResponse(await result.response.text());
  }

  private buildAnalysisPrompt(
    pageState: PageState,
    screenshot: string,
    currentUrl: string,
    iterationCount: number
  ): string {
    // Log HTML content for debugging
    console.log(`=== HTML Content for ${currentUrl} ===`);
    console.log(pageState.visibleText.substring(0, 1000));
    console.log(`=== End HTML Content ===`);

    return `
    You are a phishing detection AI. Analyze this webpage and provide detailed findings before deciding on action.

    Current URL: ${currentUrl}
    Iteration: ${iterationCount}/10
    Page Title: "${pageState.title}"
    
    Forms Analysis:
    ${pageState.forms.map((form, i) => `
    Form ${i}:
    - Fields: ${form.fields.length} (${form.fields.map(f => `${f.type} (${f.name})`).join(', ')})
    - Sensitivity: ${form.sensitivity}
    - Action: ${form.action || 'N/A'}
    - Method: ${form.method || 'GET'}
    `).join('\n')}
    
    Network Requests: ${pageState.networkRequests.length} total, ${pageState.networkRequests.filter(r => r.isSuspicious).length} suspicious
    Clickable Elements: ${pageState.clickableElements.length}
    Visible Text Sample: "${pageState.visibleText.substring(0, 200)}..."

    YOUR TASK:
    1. Analyze the page and provide detailed findings about what makes it seem like phishing or legitimate
    2. Based on your findings, choose the most compelling form that seems phishy or likely to lead to phishing
    3. Decide whether to fill and submit that form, or stop analysis

    In your "opinion", include:
    - What elements make this page suspicious (urgency, poor design, mismatched domains, etc.)
    - What elements make it seem legitimate (professional design, proper branding, etc.)
    - Which form you chose and why (most likely to be a phishing target)
    - Your reasoning for the action

    Respond with JSON:
    {
      "action": "fill_form_and_submit" | "stop",
      "opinion": "Detailed findings: [suspicious elements], [legitimate elements], [chosen form and reasoning], [action justification]",
      "formIndex": 0,  // Which form to fill (only if fill_form_and_submit)
      "fakeData": {    // Realistic fake data for the chosen form fields
        "email": "test.user@example.com",
        "password": "SecurePass123!"
      }
    }

    IMPORTANT: 
    - Always provide detailed findings in your opinion, even when stopping
    - Choose the most compelling form that seems phishy or leads to phishing
    - Provide realistic fake data matching the form fields
    - Do not stop analysis until you see a form asking for sensitive information.
    `;
  }

  private parseAIResponse(response: string): AIAction {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Ensure valid action
      if (!["fill_form_and_submit", "stop"].includes(parsed.action)) {
        throw new Error('Invalid action');
      }

      return {
        action: parsed.action,
        opinion: parsed.opinion || "No detailed findings provided",
        formIndex: parsed.formIndex || 0,
        fakeData: parsed.fakeData || {}
      };
    } catch (error) {
      console.error('Error parsing AI response:', error);
      return {
        action: "stop",
        opinion: "Error processing AI response. Final page analysis failed to parse, indicating potential malformed response which is suspicious."
      };
    }
  }

  generateFinalReport(aiResults: AIAction[], initialUrl: string): AIResults {
    const lastAction = aiResults[aiResults.length - 1];
    
    // Determine threat level based on AI opinions and actions
    let threatLevel: "safe" | "suspicious" | "critical" = "safe";
    
    // Analyze all opinions for phishing indicators
    const phishingIndicators = [
      "urgency", "immediate action", "account suspended", "verify now",
      "suspicious", "phishing", "fake", "scam", "malicious", "unusual",
      "mismatched", "poor design", "grammar errors", "threatening"
    ];
    
    const legitimateIndicators = [
      "professional", "legitimate", "secure", "verified", "official",
      "proper branding", "well-designed", "consistent", "trusted"
    ];
    
    let phishingScore = 0;
    let legitimateScore = 0;
    
    aiResults.forEach(action => {
      const opinion = action.opinion.toLowerCase();
      phishingIndicators.forEach(indicator => {
        if (opinion.includes(indicator)) phishingScore++;
      });
      legitimateIndicators.forEach(indicator => {
        if (opinion.includes(indicator)) legitimateScore++;
      });
    });
    
    // Determine threat level
    if (phishingScore > legitimateScore && aiResults.length > 3) {
      threatLevel = "suspicious";
    } else if (phishingScore > legitimateScore) {
      threatLevel = "secure";
    }

    return {
      url: initialUrl,
      actions: aiResults,
      finalThreatLevel: threatLevel,
      summary: `Analysis completed with ${aiResults.length} actions over ${aiResults.length - 1} iterations. Final assessment: ${threatLevel}. Phishing indicators: ${phishingScore}, Legitimate indicators: ${legitimateScore}.`
    };
  }
}