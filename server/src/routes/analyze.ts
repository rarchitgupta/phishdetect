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
  const gemini = new GeminiAnalyzer("AIzaSyB1jMa5jrAXyEwGs4vvYvgVkswTf05_qU8");

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

    console.log(`=== STARTING ANALYSIS ===`);
    console.log(`URL: ${body.url}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`========================`);

    // Initialize Puppeteer
    await puppeteer.initialize();
    console.log(`✓ Puppeteer initialized`);

    // Run the analysis loop
    const aiResults: AIResults = await runAnalysisLoop(body.url, puppeteer, gemini);

    console.log(`Analysis complete. Actions taken: ${aiResults.actions.length}`);

    // Get final page state for response
    const finalPageState = await puppeteer.analyzePage(body.url);

    console.log(`=== ANALYSIS SUMMARY ===`);
    console.log(`Final Threat Level: ${aiResults.finalThreatLevel}`);
    console.log(`Total Actions: ${aiResults.actions.length}`);
    console.log(`Summary: ${aiResults.summary}`);
    console.log(`====================`);

    return c.json({
      threat_level: aiResults.finalThreatLevel,
      findings: aiResults.actions.map(a => a.opinion),
      pageState: finalPageState,
      gemini_reasoning: aiResults.summary,
      status: "complete"
    });

  } catch (error) {
    console.error(`=== ANALYSIS ERROR ===`);
    console.error(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    console.error(`Stack: ${error instanceof Error ? error.stack : "No stack trace"}`);
    console.error(`===================`);
    return c.json({ 
      error: "Analysis failed", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, 500);
  } finally {
    await puppeteer.close();
    console.log(`✓ Puppeteer closed`);
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

  console.log(`=== STARTING ANALYSIS LOOP ===`);
  console.log(`Initial URL: ${currentUrl}`);
  console.log(`Max iterations: 10`);

  try {
    while (iterationCount < 11) { // Max 10 fills + 1 stop
      console.log(`\n--- Iteration ${iterationCount} ---`);
      console.log(`Current URL: ${currentUrl}`);
      
      // Create a single page for both analysis and form interaction
      page = await puppeteer.browser?.newPage();
      if (!page) {
        console.log(`✗ Failed to create new page`);
        break;
      }
      
      console.log(`✓ Created new page`);
      
      await page.goto(currentUrl);
      console.log(`✓ Navigated to ${currentUrl}`);
      
      // Add delay for dynamic content
      await new Promise(resolve => setTimeout(resolve, 2500));
      console.log(`✓ Waited 2.5s for dynamic content`);
      
      // Get page state using the same page
      const pageState = await puppeteer.extractPageState(page, currentUrl);
      console.log(`✓ Extracted page state`);
      console.log(`  - Forms found: ${pageState.forms.length}`);
      console.log(`  - Clickable elements: ${pageState.clickableElements.length}`);
      console.log(`  - Network requests: ${pageState.networkRequests.length}`);
      
      // Log form details
      pageState.forms.forEach((form, i) => {
        console.log(`  Form ${i}: ${form.fields.length} fields, sensitivity: ${form.sensitivity}`);
        form.fields.forEach(field => {
          console.log(`    - ${field.type} (${field.name}) - ${field.sensitivity}`);
        });
      });
      
      // Get screenshot from the same page
      const screenshot = await page.screenshot({ encoding: "base64" });
      pageState.screenshot = screenshot as string;
      console.log(`✓ Captured screenshot (${screenshot.length} chars)`);
      
      // Get AI decision
      console.log(`🤖 Requesting AI analysis...`);
      const action = await gemini.analyzePage(
        pageState,
        pageState.screenshot,
        currentUrl,
        iterationCount
      );
      
      aiResults.push(action);
      console.log(`🤖 AI Decision: ${action.action}`);
      console.log(`🤖 AI Opinion: ${action.opinion.substring(0, 200)}...`);
      
      if (action.action === "stop") {
        console.log(`🛑 AI chose to stop analysis`);
        await page.close();
        break;
      }
      
      // Execute fill and submit on the same page
      if (action.action === "fill_form_and_submit") {
        console.log(`📝 Executing form fill and submit...`);
        console.log(`  - Form index: ${action.formIndex}`);
        console.log(`  - Fake data:`, action.fakeData);
        
        try {
          await puppeteer.fillAndSubmitForm(page, action.formIndex || 0, action.fakeData || {});
          console.log(`✓ Form filled successfully`);
          
          await puppeteer.submitForm(page, action.formIndex || 0);
          console.log(`✓ Form submitted successfully`);
          
          // Get new URL after submission
          const newUrl = page.url();
          if (newUrl !== currentUrl) {
            console.log(`🔄 Navigation detected: ${currentUrl} → ${newUrl}`);
            currentUrl = newUrl;
          } else {
            console.log(`📄 No navigation detected, staying on same page`);
          }
        } catch (error) {
          console.error(`✗ Form submission failed:`, error);
          // If no forms found, add a stop action and break
          aiResults.push({
            action: "stop",
            opinion: `No forms found on this page. Error: ${error instanceof Error ? error.message : 'Unknown error'}. Stopping analysis as there are no forms to interact with.`
          });
          await page.close();
          break;
        }
        await page.close();
        console.log(`✓ Page closed`);
      }
      
      iterationCount++;
    }
  } finally {
    if (page) {
      await page.close();
      console.log(`✓ Final page cleanup completed`);
    }
  }
  
  console.log(`=== ANALYSIS LOOP COMPLETED ===`);
  console.log(`Total iterations: ${iterationCount}`);
  console.log(`Total AI actions: ${aiResults.length}`);
  
  return gemini.generateFinalReport(aiResults, url);
}

export default analyzeRouter;
