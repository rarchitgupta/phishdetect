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

  private async extractPageState(page: Page, url: string): Promise<PageState> {
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
    await page.evaluate(
      (index, data) => {
        const form = document.querySelectorAll("form")[index];
        if (!form) throw new Error(`Form ${index} not found`);

        Object.entries(data).forEach(([name, value]) => {
          const input = form.querySelector(
            `input[name="${name}"], textarea[name="${name}"]`,
          ) as HTMLInputElement;
          if (input) {
            input.value = value;
            input.dispatchEvent(new Event("change", { bubbles: true }));
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
