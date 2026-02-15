export const mockAnalysisResult = {
  threat_level: "critical" as const,
  findings: [
    {
      claim: "Domain Mismatch",
      evidence:
        "URL is recoveryticket-11345.com, but page displays Coinbase branding and title",
      type: "insecure" as const,
    },
    {
      claim: "Multi-step Credential Harvest",
      evidence:
        "Form progression from email to password indicates credential harvesting flow",
      type: "insecure" as const,
    },
    {
      claim: "Professional Design",
      evidence:
        "Page uses polished UI and official Coinbase branding (used deceptively)",
      type: "secure" as const,
    },
    {
      claim: "GET Method for Sensitive Data",
      evidence:
        "Form uses GET method instead of POST for credential submission",
      type: "insecure" as const,
    },
    {
      claim: "Suspicious Domain Registration",
      evidence:
        "Domain 'recoveryticket-11345.com' appears generic with numbered suffix",
      type: "insecure" as const,
    },
  ],
  pageState: {
    url: "https://recoveryticket-11345.com/",
    title: "Sign in | Coinbase",
    visibleText: "Sign in to Coinbase. Email. Continue.",
    forms: [
      {
        id: "",
        action: "https://recoveryticket-11345.com/",
        method: "get",
        fields: [
          {
            type: "text",
            name: "",
            id: "",
            placeholder: "Your email address",
            required: false,
            sensitivity: "harmless",
          },
        ],
        sensitivity: "harmless",
      },
    ],
    clickableElements: [
      {
        type: "button" as const,
        text: "Continue",
        href: "",
      },
    ],
    networkRequests: [
      {
        url: "https://recoveryticket-11345.com/",
        domain: "recoveryticket-11345.com",
        isSuspicious: true,
      },
      {
        url: "https://recoveryticket-11345.com/_next/static/media/797e433ab948586e-s.p.dbea232f.woff2",
        domain: "recoveryticket-11345.com",
        isSuspicious: false,
      },
      {
        url: "https://recoveryticket-11345.com/_next/static/media/caa3a2e1cccd8315-s.p.853070df.woff2",
        domain: "recoveryticket-11345.com",
        isSuspicious: false,
      },
      {
        url: "https://recoveryticket-11345.com/_next/static/chunks/8a80e7184ad3a13f.css",
        domain: "recoveryticket-11345.com",
        isSuspicious: false,
      },
      {
        url: "https://recoveryticket-11345.com/_next/static/chunks/4168f297cf00d810.css",
        domain: "recoveryticket-11345.com",
        isSuspicious: false,
      },
    ],
    cookies: [],
    screenshot: "",
  },
  gemini_reasoning:
    "The analysis detected a sophisticated phishing attempt targeting Coinbase users. The domain mismatch (recoveryticket-11345.com vs coinbase.com) is the primary indicator, combined with the multi-step credential harvest flow (email → password). This pattern is consistent with known phishing tactics.",
  status: "complete",
};

export type Finding = {
  claim: string;
  evidence: string;
  type: "secure" | "insecure";
};

export type AnalysisResult = typeof mockAnalysisResult;
