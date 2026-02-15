// API response types based on backend response structure

export interface Finding {
  threat: "safe" | "suspicious";
  reason: string;
  explanation: string;
}

export interface Form {
  id: string;
  action: string;
  method: string;
  fields: Array<{
    type: string;
    name: string;
    id: string;
    placeholder: string;
    required: boolean;
    sensitivity: string;
  }>;
  sensitivity: string;
}

export interface ClickableElement {
  type: string;
  text: string;
  href?: string;
}

export interface NetworkRequest {
  url: string;
  domain: string;
  isSuspicious: boolean;
}

export interface PageState {
  url: string;
  title: string;
  visibleText: string;
  forms: Form[];
  clickableElements: ClickableElement[];
  networkRequests: NetworkRequest[];
  cookies?: Array<{ name: string; value: string }>;
  screenshot?: string;
}

export interface AnalyzeResponse {
  threat_level: "safe" | "suspicious";
  findings: Finding[];
  pageState: PageState;
  screenshot?: string;
  gemini_reasoning?: string;
  status?: string;
}

// Transformed type for UI components
export interface TransformedFinding {
  type: "secure" | "insecure";
  reason: string;
  explanation: string;
}

export interface TransformedAnalysisResult {
  threat_level: "safe" | "suspicious";
  findings: TransformedFinding[];
  pageState: PageState;
  screenshot?: string;
}
