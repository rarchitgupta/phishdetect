import { Hono } from "hono";
import { PuppeteerController, PageState } from "../services/puppeteer";

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
  const controller = new PuppeteerController();

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
    await controller.initialize();

    // Navigate and extract page state
    const pageState = await controller.analyzePage(body.url);

    console.log(`Analysis complete. Forms found: ${pageState.forms.length}`);

    // Pass cleaned data to Gemini for analysis (no pre-classification)
    const response: AnalyzeResponse = {
      threat_level: "safe", // placeholder, Gemini will determine actual threat
      findings: [],
      pageState,
      gemini_reasoning: "Awaiting Gemini analysis...",
      status: "pending",
    };

    return c.json(response);
  } catch (error) {
    console.error("Error analyzing link:", error);
    return c.json(
      {
        error: `Analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      500,
    );
  } finally {
    await controller.close();
  }
});

export default analyzeRouter;
