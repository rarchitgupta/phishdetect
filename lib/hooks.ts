"use client";

import { useState, useCallback } from "react";
import {
  AnalyzeResponse,
  TransformedAnalysisResult,
  TransformedFinding,
} from "./types";

interface UseAnalyzeUrlReturn {
  data: TransformedAnalysisResult | null;
  loading: boolean;
  error: string | null;
  analyze: (url: string) => Promise<void>;
}

const transformFinding = (
  finding: AnalyzeResponse["findings"][0],
): TransformedFinding => {
  // Map threat level to type
  const type = finding.threat === "safe" ? "secure" : "insecure";
  return {
    type,
    reason: finding.reason,
    explanation: finding.explanation,
  };
};

const transformResponse = (
  response: AnalyzeResponse,
): TransformedAnalysisResult => {
  return {
    threat_level: response.threat_level,
    findings: response.findings.map(transformFinding),
    pageState: response.pageState,
    screenshot: response.screenshot || response.pageState.screenshot,
  };
};

export function useAnalyzeUrl(): UseAnalyzeUrlReturn {
  const [data, setData] = useState<TransformedAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (url: string) => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/analyze`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url }),
        },
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const result: AnalyzeResponse = await response.json();
      const transformed = transformResponse(result);
      setData(transformed);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unknown error occurred";
      setError(errorMessage);
      console.error("Analysis error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, analyze };
}
