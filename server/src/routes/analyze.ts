// /Users/aryansharma/Desktop/hackncstate/phishdetect/server/src/routes/analyze.ts
import { Hono } from "hono";
import { PuppeteerController, PageState } from "../services/puppeteer";
import { GeminiAnalyzer, AIResults } from "../services/gemini";

const analyzeRouter = new Hono();

interface AnalyzeRequest {
  url: string;
}

interface AnalyzeResponse {
  threat_level: "safe" | "suspicious" | "critical";
  findings: string[];
  pageState: PageState;
  gemini_reasoning: string;
  status: string;
}

analyzeRouter.post("/", async (c) => {
  const puppeteer = new PuppeteerController();
  // const gemini = new GeminiAnalyzer(process.env.GEMINI_API_KEY!);
  const gemini = new GeminiAnalyzer("AIzaSyAXNe3gAxlJIWLCNFjlan6xntpysVHvOjU");

  try {
    const body = (await c.req.json()) as AnalyzeRequest;

    if (!body.url) {
      return c.json({ error: "URL is required" }, 400);
    }

    // Validate URL format
    try {
      new URL(body.url);
    } catch {
      return c.json({ error: "Invalid URL format" }, 400);
    }

    console.log(`Analyzing URL: ${body.url}`);

    // Initialize Puppeteer
    await puppeteer.initialize();

    // Run the analysis loop
    const aiResults: AIResults = await runAnalysisLoop(body.url, puppeteer, gemini);

    console.log(`Analysis complete. Actions taken: ${aiResults.actions.length}`);

    // Get final page state for response
    const finalPageState = await puppeteer.analyzePage(body.url);

    return c.json({
      threat_level: aiResults.finalThreatLevel,
      findings: aiResults.actions.map(a => a.opinion),
      pageState: finalPageState,
      gemini_reasoning: aiResults.summary,
      status: "complete"
    });

  } catch (error) {
    console.error("Analysis error:", error);
    return c.json({ 
      error: "Analysis failed", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, 500);
  } finally {
    await puppeteer.close();
  }
});

async function runAnalysisLoop(
  url: string, 
  puppeteer: PuppeteerController, 
  gemini: GeminiAnalyzer
): Promise<AIResults> {
  const aiResults: any[] = [];
  let currentUrl = url;
  let iterationCount = 0;
  let page: any = null;

  try {
    while (iterationCount < 11) { // Max 10 fills + 1 stop
      // Get page state
      const pageState = await puppeteer.analyzePage(currentUrl);
      
      // Get AI decision
      const action = await gemini.analyzePage(
        pageState,
        pageState.screenshot,
        currentUrl,
        iterationCount
      );
      
      aiResults.push(action);
      console.log(`Iteration ${iterationCount}: ${action.action}`);
      
      if (action.action === "stop") {
        break;
      }
      
      // Execute fill and submit
      if (action.action === "fill_form_and_submit") {
        page = await puppeteer.browser?.newPage();
        if (page) {
          await page.goto(currentUrl);
          await puppeteer.fillAndSubmitForm(page, action.formIndex || 0, action.fakeData || {});
          await puppeteer.submitForm(page, action.formIndex || 0);
          
          // Get new URL after submission
          currentUrl = page.url();
          console.log(`Navigated to: ${currentUrl}`);
          await page.close();
        }
      }
      
      iterationCount++;
    }
  } finally {
    if (page) {
      await page.close();
    }
  }
  
  return gemini.generateFinalReport(aiResults, url);
}

export default analyzeRouter;