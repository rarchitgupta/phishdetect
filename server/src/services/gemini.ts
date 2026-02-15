// gemini.ts
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
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
    iterationCount: number,
  ): Promise<AIAction> {
    // Force stop after 10 iterations
    if (iterationCount >= 10) {
      return {
        action: "stop",
        opinion:
          "Maximum iteration limit reached (10). Final page shows potential infinite redirect loop or complex multi-step process, which is suspicious behavior.",
      };
    }

    const prompt = this.buildAnalysisPrompt(
      pageState,
      screenshot,
      currentUrl,
      iterationCount,
    );
    const result = await this.model.generateContent([
      prompt,
      {
        inlineData: {
          data: screenshot,
          mimeType: "image/png",
        },
      },
    ]);

    return this.parseAIResponse(await result.response.text());
  }

  private buildAnalysisPrompt(
    pageState: PageState,
    screenshot: string,
    currentUrl: string,
    iterationCount: number,
  ): string {
    return `
    You are a phishing detection AI. Analyze this webpage and provide detailed findings before deciding on action.

    Current URL: ${currentUrl}
    Iteration: ${iterationCount}/10
    Page Title: "${pageState.title}"
    
    Forms Analysis:
    ${pageState.forms
      .map(
        (form, i) => `
    Form ${i}:
    - Fields: ${form.fields.length} (${form.fields.map((f) => `${f.type} (${f.name})`).join(", ")})
    - Sensitivity: ${form.sensitivity}
    - Action: ${form.action || "N/A"}
    - Method: ${form.method || "GET"}
    `,
      )
      .join("\n")}
    
    Network Requests: ${pageState.networkRequests.length} total, ${pageState.networkRequests.filter((r) => r.isSuspicious).length} suspicious
    Clickable Elements: ${pageState.clickableElements.length}
    Visible Text Sample: "${pageState.visibleText.substring(0, 200)}..."

    YOUR TASK:
    1. Analyze the page and provide detailed findings about what makes it seem like phishing or legitimate
    2. Based on your findings, choose the most compelling form that seems phishy or likely to lead to phishing
    3. Decide whether to fill and submit that form, or stop analysis

    CRITICAL RULES FOR STOPPING:
    - If you see a PASSWORD field, 2FA/MFA field, security code field, SSN, credit card, CVV, bank account, or any other SENSITIVE CREDENTIAL or PAYMENT field, you MUST fill it with fake data and submit to probe deeper — then STOP on the NEXT iteration.
    - Email and username fields are NOT sensitive — always fill and submit these to advance the flow.
    - Once you have enough evidence to determine the page is phishing or legitimate, STOP.
    - Only STOP when there are no more forms to fill, or after you have already submitted sensitive credentials (password, payment info) and seen the next page.

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
    - Email/username fields are harmless — always fill and submit them
    - Password, 2FA, SSN, credit card, bank details are sensitive — fill and submit them too, but STOP on the next iteration after seeing the result
    `;
  }

  private parseAIResponse(response: string): AIAction {
    try {
      // Try to find JSON object more carefully
      let jsonMatch = null;
      let jsonStr = "";

      // First try: look for content between first { and last }
      const firstBrace = response.indexOf("{");
      const lastBrace = response.lastIndexOf("}");

      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = response.substring(firstBrace, lastBrace + 1);

        // Try to parse it
        try {
          const parsed = JSON.parse(jsonStr);
          jsonMatch = parsed;
        } catch (e) {
          // If that fails, try to find a complete JSON object

          // Try regex for action pattern - look for "action": "value"
          const actionMatch = response.match(
            /"action"\s*:\s*"(fill_form_and_submit|stop)"/,
          );
          if (!actionMatch) {
            throw new Error("No valid action found in response");
          }
        }
      }

      if (!jsonMatch) {
        jsonMatch = JSON.parse(jsonStr);
      }

      // Ensure valid action
      if (!["fill_form_and_submit", "stop"].includes(jsonMatch.action)) {
        throw new Error("Invalid action");
      }

      return {
        action: jsonMatch.action,
        opinion: jsonMatch.opinion || "No detailed findings provided",
        formIndex: jsonMatch.formIndex || 0,
        fakeData: jsonMatch.fakeData || {},
      };
    } catch (error) {
      console.error("Error parsing AI response:", error);
      return {
        action: "stop",
        opinion:
          "Error processing AI response. Final page analysis failed to parse, indicating potential malformed response which is suspicious.",
      };
    }
  }

  generateFinalReport(aiResults: AIAction[], initialUrl: string): AIResults {
    const lastAction = aiResults[aiResults.length - 1];

    // Determine threat level based on AI opinions and actions
    let threatLevel: "safe" | "suspicious" | "critical" = "safe";

    // Analyze all opinions for phishing indicators
    const phishingIndicators = [
      "urgency",
      "immediate action",
      "account suspended",
      "verify now",
      "suspicious",
      "phishing",
      "fake",
      "scam",
      "malicious",
      "unusual",
      "mismatched",
      "poor design",
      "grammar errors",
      "threatening",
    ];

    const legitimateIndicators = [
      "professional",
      "legitimate",
      "secure",
      "verified",
      "official",
      "proper branding",
      "well-designed",
      "consistent",
      "trusted",
    ];

    let phishingScore = 0;
    let legitimateScore = 0;

    aiResults.forEach((action) => {
      const opinion = action.opinion.toLowerCase();
      phishingIndicators.forEach((indicator) => {
        if (opinion.includes(indicator)) phishingScore++;
      });
      legitimateIndicators.forEach((indicator) => {
        if (opinion.includes(indicator)) legitimateScore++;
      });
    });

    // Determine threat level
    if (phishingScore > legitimateScore && aiResults.length > 3) {
      threatLevel = "critical";
    } else if (phishingScore > legitimateScore) {
      threatLevel = "suspicious";
    }

    return {
      url: initialUrl,
      actions: aiResults,
      finalThreatLevel: threatLevel,
      summary: `Analysis completed with ${aiResults.length} actions over ${aiResults.length - 1} iterations. Final assessment: ${threatLevel}. Phishing indicators: ${phishingScore}, Legitimate indicators: ${legitimateScore}.`,
    };
  }
}
