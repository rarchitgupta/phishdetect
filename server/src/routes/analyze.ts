// /Users/aryansharma/Desktop/hackncstate/phishdetect/server/src/routes/analyze.ts
import { Hono } from "hono";
import { PuppeteerController, PageState } from "../services/puppeteer";
import { GeminiAnalyzer, AIResults } from "../services/gemini";
import { LookupService } from "../services/lookup";

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
  const gemini = new GeminiAnalyzer(process.env.GEMINI_API_KEY!);
  const lookup = new LookupService();

  try {
    const body = (await c.req.json()) as AnalyzeRequest;

    if (!body.url) {
      return c.json({ error: "URL is required" }, 400);
    }

    const domain = new URL(body.url).hostname;

    const domainInfo = await lookup.getDomainRegistrationInfo(domain);

    console.log("=== DOMAIN INFO ===");
    console.log(domainInfo);
    console.log("===================");


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
    const aiResults: AIResults = await runAnalysisLoop(
      body.url,
      puppeteer,
      gemini,
    );

    console.log(
      `Analysis complete. Actions taken: ${aiResults.actions.length}`,
    );

    // Get final page state for response
    const finalPageState = await puppeteer.analyzePage(body.url);

    return c.json({
      threat_level: aiResults.finalThreatLevel,
      findings: aiResults.actions.map((a) => a.opinion),
      pageState: finalPageState,
      gemini_reasoning: aiResults.summary,
      status: "complete",
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return c.json(
      {
        error: "Analysis failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  } finally {
    await puppeteer.close();
  }
});

async function runAnalysisLoop(
  url: string,
  puppeteer: PuppeteerController,
  gemini: GeminiAnalyzer,
): Promise<AIResults> {
  const aiResults: any[] = [];
  let iterationCount = 0;
  let page: any = null;
  let submittedSensitiveForm = false;

  try {
    // Create page once at the beginning
    page = await puppeteer.browser?.newPage();
    if (!page) throw new Error("Failed to create page");

    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    
    // Wait for page to fully render
    await new Promise((resolve) => setTimeout(resolve, 2000));

    while (iterationCount < 11) {
      // Max 10 fills + 1 stop
      // Analyze current page state (without creating new page)
      const pageState = await puppeteer.analyzePage(url, page);

      // Force stop if we already submitted a sensitive form last iteration
      if (submittedSensitiveForm) {
        // Run one final analysis so the AI can see the post-credential page
        const finalAction = await gemini.analyzePage(
          pageState,
          pageState.screenshot,
          page.url(),
          iterationCount,
        );
        // Override action to stop, but keep the AI's opinion
        aiResults.push({
          ...finalAction,
          action: "stop",
          opinion:
            finalAction.opinion +
            " [Auto-stopped after sensitive credential submission]",
        });
        break;
      }

      // Get AI decision
      const action = await gemini.analyzePage(
        pageState,
        pageState.screenshot,
        page.url(),
        iterationCount,
      );

      aiResults.push(action);
      console.log(`Iteration ${iterationCount}: ${action.action}`);

      if (action.action === "stop") {
        break;
      }

      // Execute fill and submit on the SAME page
      if (action.action === "fill_form_and_submit") {
        const targetForm = pageState.forms[action.formIndex || 0];
        const isSensitive = targetForm?.sensitivity === "sensitive";

        // Fill the form on current page
        await puppeteer.fillAndSubmitForm(
          page,
          action.formIndex || 0,
          action.fakeData || {},
        );

        // Submit the form
        await puppeteer.submitForm(page, action.formIndex || 0);

        // Wait for page response to render before next analysis
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Mark if we just submitted sensitive data
        if (isSensitive) {
          submittedSensitiveForm = true;
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
