import puppeteer, { Browser, Page } from "puppeteer";

export interface FormField {
  type: string;
  name: string;
  id?: string;
  placeholder?: string;
  label?: string;
  required?: boolean;
  sensitivity: "harmless" | "sensitive";
}

export interface Form {
  id?: string;
  action?: string;
  method?: string;
  fields: FormField[];
  sensitivity: "harmless" | "sensitive";
}

export interface NetworkRequest {
  url: string;
  method: string;
  resourceType: string;
  headers: Record<string, string>;
  status?: number;
  domain: string;
  isSuspicious: boolean;
}

export interface CleanNetworkRequest {
  url: string;
  domain: string;
  isSuspicious: boolean;
}

export interface CleanClickable {
  type: "button" | "link";
  text: string;
  href?: string;
}

export interface PageState {
  url: string;
  title: string;
  visibleText: string;
  forms: Form[];
  clickableElements: CleanClickable[];
  networkRequests: CleanNetworkRequest[];
  cookies: Array<{ name: string; value: string }>;
  screenshot: string; // base64
}

const SENSITIVE_FIELD_PATTERNS = [
  "password",
  "ssn",
  "social",
  "credit",
  "card",
  "cvv",
  "cvc",
  "pin",
  "account",
  "routing",
  "bank",
  "confirmPassword",
  "confirm_password",
];

const SUSPICIOUS_KEYWORDS = [
  "phishing",
  "malware",
  "trojan",
  "virus",
  "bitcoin",
  "crypto",
  "ransomware",
];

export class PuppeteerController {
  private browser: Browser | null = null;
  private mainDomain: string = "";
  private networkRequests: NetworkRequest[] = [];

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-extensions",
      ],
      timeout: 30000,
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  private isSensitiveField(field: {
    type?: string;
    name?: string;
    placeholder?: string;
  }): boolean {
    const fieldStr =
      `${field.type} ${field.name} ${field.placeholder}`.toLowerCase();
    return SENSITIVE_FIELD_PATTERNS.some((pattern) =>
      fieldStr.includes(pattern),
    );
  }

  private classifyFormSensitivity(
    fields: FormField[],
  ): "harmless" | "sensitive" {
    return fields.some((f) => f.sensitivity === "sensitive")
      ? "sensitive"
      : "harmless";
  }

  async analyzePage(url: string): Promise<PageState> {
    if (!this.browser) {
      throw new Error("Browser not initialized. Call initialize() first.");
    }

    this.networkRequests = [];
    this.mainDomain = new URL(url).hostname;

    const page = await this.browser.newPage();

    try {
      // Set up network monitoring
      await page.on("request", (request) => {
        const requestUrl = request.url();
        const domain = new URL(requestUrl).hostname;
        const isSuspicious = this.isSuspiciousDomain(domain);

        this.networkRequests.push({
          url: requestUrl,
          method: request.method(),
          resourceType: request.resourceType(),
          headers: request.headers(),
          domain,
          isSuspicious,
        });
      });

      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 });

      // Navigate to URL with timeout
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

      // Add 2.5 second delay before checking for forms
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Extract page state
      const pageState = await this.extractPageState(page, url);

      // Add trimmed network requests to page state
      pageState.networkRequests = this.networkRequests.map((req) => ({
        url: req.url,
        domain: req.domain,
        isSuspicious: req.isSuspicious,
      })) as CleanNetworkRequest[];

      // Take screenshot
      const screenshot = await page.screenshot({ encoding: "base64" });
      pageState.screenshot = screenshot as string;

      return pageState;
    } finally {
      await page.close();
    }
  }

  private isSuspiciousDomain(domain: string): boolean {
    // Check if domain is different from main domain (third-party)
    if (domain !== this.mainDomain && !domain.includes(this.mainDomain)) {
      // Known tracking/ad domains
      const knownTrackers = [
        "google-analytics",
        "doubleclick",
        "facebook",
        "twitter",
      ];
      return knownTrackers.some((tracker) => domain.includes(tracker));
    }
    return false;
  }

  async extractPageState(page: Page, url: string): Promise<PageState> {
    // Debug: Log all input elements and potential form containers
    const debugInfo = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, button, [role="button"]')).map(el => ({
        tagName: el.tagName,
        type: (el as HTMLInputElement).type || 'N/A',
        name: (el as HTMLInputElement).name || 'N/A',
        id: el.id || 'N/A',
        placeholder: (el as HTMLInputElement).placeholder || 'N/A',
        textContent: el.textContent?.substring(0, 50) || 'N/A',
        className: el.className || 'N/A'
      }));
      
      const forms = Array.from(document.querySelectorAll('form')).map(form => ({
        id: form.id,
        action: form.action,
        method: form.method,
        innerHTML: form.innerHTML.substring(0, 200)
      }));

      return { inputs, forms };
    });

    console.log(`=== DEBUG INFO for ${url} ===`);
    console.log('Input elements found:', debugInfo.inputs.length);
    console.log('Forms found:', debugInfo.forms.length);
    console.log('Input elements:', JSON.stringify(debugInfo.inputs, null, 2));
    console.log('Forms:', JSON.stringify(debugInfo.forms, null, 2));
    console.log(`=== END DEBUG INFO ===`);

    const pageData = await page.evaluate(() => {
      const forms: Form[] = [];

      // Extract all forms
      document.querySelectorAll("form").forEach((form) => {
        const fields: FormField[] = [];

        form.querySelectorAll("input, select, textarea").forEach((field) => {
          const input = field as
            | HTMLInputElement
            | HTMLSelectElement
            | HTMLTextAreaElement;

          const fieldData: FormField = {
            type:
              input.tagName.toLowerCase() === "input"
                ? (input as HTMLInputElement).type
                : input.tagName.toLowerCase(),
            name: input.name || "",
            id: input.id,
            placeholder: (input as HTMLInputElement).placeholder,
            required: input.required,
            sensitivity: "harmless", // Will be set after
          };

          // Determine sensitivity
          const fieldStr =
            `${fieldData.type} ${fieldData.name} ${fieldData.placeholder}`.toLowerCase();
          const sensitivePatterns = [
            "password",
            "ssn",
            "social",
            "credit",
            "card",
            "cvv",
            "cvc",
            "pin",
            "account",
            "routing",
            "bank",
          ];
          fieldData.sensitivity = sensitivePatterns.some((p) =>
            fieldStr.includes(p),
          )
            ? "sensitive"
            : "harmless";

          fields.push(fieldData);
        });

        forms.push({
          id: form.id,
          action: form.action,
          method: form.method,
          fields,
          sensitivity: fields.some((f) => f.sensitivity === "sensitive")
            ? "sensitive"
            : "harmless",
        });
      });

      // Extract clickable elements
      const clickables = Array.from(
        document.querySelectorAll('button, a, [role="button"]'),
      )
        .map((el) => ({
          type:
            el.tagName.toLowerCase() === "a"
              ? ("link" as const)
              : ("button" as const),
          text: el.textContent?.substring(0, 100).trim() || "",
          href: (el as HTMLAnchorElement).href,
        }))
        .filter(
          (el) =>
            el.text.length > 0 &&
            !el.text.includes("{") &&
            !el.text.includes("}"),
        );

      // Extract visible text
      const visibleText = document.body.innerText.substring(0, 2000);

      return {
        title: document.title,
        visibleText,
        forms,
        clickableElements: clickables,
      };
    });

    return {
      url,
      title: pageData.title,
      visibleText: pageData.visibleText,
      forms: pageData.forms,
      clickableElements: pageData.clickableElements,
      networkRequests: [], // Set later
      cookies: await page.cookies(),
      screenshot: "", // Set later
    };
  }

  async fillAndSubmitForm(
    page: Page,
    formIndex: number,
    fakeData: Record<string, string>,
  ): Promise<void> {
    // Debug: Check how many forms exist
    const formCount = await page.evaluate(() => {
      return document.querySelectorAll("form").length;
    });
    console.log(`DEBUG: Found ${formCount} forms on page, trying to fill form ${formIndex}`);

    await page.evaluate(
      (index, data) => {
        const form = document.querySelectorAll("form")[index];
        if (!form) throw new Error(`Form ${index} not found`);

        console.log(`DEBUG: Form found, filling with data:`, data);
        console.log(`DEBUG: Form inputs:`, Array.from(form.querySelectorAll('input, textarea')).map(input => ({
          tagName: input.tagName,
          type: (input as HTMLInputElement).type,
          name: (input as HTMLInputElement).name,
          id: (input as HTMLInputElement).id,
          placeholder: (input as HTMLInputElement).placeholder
        })));

        Object.entries(data).forEach(([name, value]) => {
          // Try to find input by name first
          let input = form.querySelector(
            `input[name="${name}"], textarea[name="${name}"]`,
          ) as HTMLInputElement;
          
          // If not found by name, try by placeholder
          if (!input) {
            input = form.querySelector(
              `input[placeholder*="${name}"], textarea[placeholder*="${name}"]`,
            ) as HTMLInputElement;
          }
          
          // If still not found, try by type (email, password, etc.)
          if (!input) {
            input = form.querySelector(
              `input[type="${name}"], textarea[type="${name}"]`,
            ) as HTMLInputElement;
          }
          
          // If still not found, try the first input of matching type
          if (!input && (name === 'email' || name === 'password')) {
            input = form.querySelector(
              `input[type="${name}"]`,
            ) as HTMLInputElement;
          }
          
          // If still not found, try the first text input for email
          if (!input && name === 'email') {
            input = form.querySelector(
              'input[type="text"]',
            ) as HTMLInputElement;
          }

          if (input) {
            console.log(`DEBUG: Filling input:`, input.tagName, input.type, input.name, input.placeholder);
            input.value = value;
            input.dispatchEvent(new Event("change", { bubbles: true }));
            input.dispatchEvent(new Event("input", { bubbles: true }));
          } else {
            console.log(`DEBUG: Could not find input for field: ${name}`);
          }
        });
      },
      formIndex,
      fakeData,
    );
  }

  async submitForm(page: Page, formIndex: number): Promise<void> {
    await page.evaluate((index) => {
      const form = document.querySelectorAll("form")[index];
      if (!form) throw new Error(`Form ${index} not found`);
      form.submit();
    }, formIndex);

    // Wait for navigation
    await page
      .waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 })
      .catch(() => {
        // Timeout is ok, page might not navigate
      });
  }
}
