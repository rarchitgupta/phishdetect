"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar1 } from "@/components/navbar1";
import { useAnalyzeUrl } from "@/lib/hooks";

export default function AnalysisPage() {
  const searchParams = useSearchParams();
  const { data, loading, error, analyze } = useAnalyzeUrl();
  console.log("screenshot", data?.domain_info);

  const url = searchParams.get("url");

  // Trigger analysis on mount when URL is available
  useEffect(() => {
    if (url && !data && !loading && !error) {
      analyze(url);
    }
  }, [url, analyze, data, loading, error]);

  // Extract findings when data is available
  const secureFindings =
    data?.findings.filter((f) => f.type === "secure") ?? [];
  const insecureFindings =
    data?.findings.filter((f) => f.type === "insecure") ?? [];

  // Calculate phishing likeliness based on insecure vs secure findings
  const phishingScore =
    data && data.findings.length > 0
      ? Math.min(
          100,
          Math.round((insecureFindings.length / data.findings.length) * 100),
        )
      : 0;

  return (
    <div className="flex flex-col min-h-dvh mx-auto">
      <Navbar1
        logo={{
          url: "/",
          src: "https://www.shadcnblocks.com/shadcnblocks-icon.svg",
          alt: "PhishDetect",
          title: "PhishDetect",
        }}
        menu={[
          { title: "Home", url: "/" },
          { title: "About", url: "#" },
          { title: "Docs", url: "#" },
        ]}
        auth={{
          login: { title: "Login", url: "#" },
          signup: { title: "Sign up", url: "#" },
        }}
        className="mx-auto w-6xl"
      />
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="max-w-6xl w-full">
          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
              <h2 className="text-xl font-semibold text-gray-700">
                Analyzing URL...
              </h2>
              <p className="text-gray-500 mt-2">This may take a moment</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="p-6 bg-red-50 rounded-lg border border-red-200">
              <h2 className="text-lg font-semibold text-red-700 mb-2">
                Analysis Failed
              </h2>
              <p className="text-red-600">{error}</p>
              <button
                onClick={() => url && analyze(url)}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
              >
                Retry
              </button>
            </div>
          )}

          {/* Results State */}
          {data && !loading && !error && (
            <>
              {/* URL and Status */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Analysis Results</h1>
                <p className="text-gray-600 break-all">{data.pageState.url}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Threat Level:{" "}
                  <span className="font-semibold uppercase">
                    {data.threat_level}
                  </span>
                </p>
              </div>

              {/* Screenshot */}
              {data.screenshot && (
                <div className="mb-8 overflow-hidden rounded-lg border border-gray-200">
                  <img
                    src={`data:image/png;base64,${data.screenshot}`}
                    alt="Website screenshot"
                    className="w-full h-auto object-cover max-h-96"
                  />
                </div>
              )}

              {/* Score and Findings Layout */}
              <div className="grid grid-cols-1 gap-8">
                {/* Score */}
                <div>
                  {/* Phishing Score */}
                  <div className="flex flex-col items-center justify-center p-8 bg-linear-to-br from-yellow-50 to-orange-50 rounded-lg border border-orange-200">
                    <div className="text-center">
                      <p className="text-gray-600 text-sm font-medium mb-2">
                        PHISHING LIKELINESS SCORE
                      </p>
                      <div className="relative w-40 h-40 mx-auto mb-4">
                        <svg
                          className="w-full h-full transform -rotate-90"
                          viewBox="0 0 100 100"
                        >
                          {/* Background circle */}
                          <circle
                            cx="50"
                            cy="50"
                            r="45"
                            fill="none"
                            stroke="#e5e7eb"
                            strokeWidth="8"
                          />
                          {/* Progress circle */}
                          <circle
                            cx="50"
                            cy="50"
                            r="45"
                            fill="none"
                            stroke="#f59e0b"
                            strokeWidth="8"
                            strokeDasharray={`${(phishingScore / 100) * (2 * Math.PI * 45)} ${2 * Math.PI * 45}`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-4xl font-bold text-orange-600">
                            {phishingScore}
                          </span>
                          <span className="text-gray-500 text-sm">/ 100</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-4">
                        {phishingScore > 70
                          ? "High Risk"
                          : phishingScore > 40
                            ? "Medium Risk"
                            : "Low Risk"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Findings Sections */}
                <div className="space-y-4">
                  {/* Suspicious Findings */}
                  {insecureFindings.length > 0 && (
                    <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg font-semibold text-red-700">
                          ⚠ Suspicious Aspects
                        </span>
                        <span className="inline-block px-2 py-1 text-xs font-semibold bg-red-200 text-red-800 rounded">
                          {insecureFindings.length} Found
                        </span>
                      </div>
                      <div className="space-y-2">
                        {insecureFindings.map((finding, idx) => (
                          <div key={idx} className="text-sm">
                            <p className="font-medium text-red-900">
                              {finding.reason}
                            </p>
                            <p className="text-red-700 text-xs mt-0.5">
                              {finding.explanation}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Safe Findings */}
                  {secureFindings.length > 0 && (
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg font-semibold text-green-700">
                          ✓ Safe Aspects
                        </span>
                        <span className="inline-block px-2 py-1 text-xs font-semibold bg-green-200 text-green-800 rounded">
                          {secureFindings.length} Found
                        </span>
                      </div>
                      <div className="space-y-2">
                        {secureFindings.map((finding, idx) => (
                          <div key={idx} className="text-sm">
                            <p className="font-medium text-green-900">
                              {finding.reason}
                            </p>
                            <p className="text-green-700 text-xs mt-0.5">
                              {finding.explanation}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Domain Info Section - Full Width */}
              {data.domain_info?.ageDays !== undefined && (
                <div
                  className={`mt-8 p-6 rounded-lg border ${
                    data.domain_info.ageDays > 365
                      ? "bg-green-50 border-green-200"
                      : "bg-orange-50 border-orange-200"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg font-semibold">
                      {data.domain_info.ageDays > 365 ? "✓" : "⚠"}
                    </span>
                    <h3 className="text-lg font-semibold">
                      Domain Information
                    </h3>
                    <span
                      className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                        data.domain_info.ageDays > 365
                          ? "bg-green-200 text-green-800"
                          : "bg-orange-200 text-orange-800"
                      }`}
                    >
                      {data.domain_info.ageDays > 365 ? "Safe" : "Suspicious"}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Domain:</span>
                      <p className="text-gray-600">{data.domain_info.domain}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Age:</span>
                      <p className="text-gray-600">
                        {data.domain_info.ageDays} days
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">
                        Created:
                      </span>
                      <p className="text-gray-600">
                        {new Date(
                          data.domain_info.createdDate,
                        ).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">
                        IP Address:
                      </span>
                      <p className="text-gray-600 break-all">
                        {data.domain_info.ip}
                      </p>
                    </div>
                  </div>
                  {data.domain_info.ageDays <= 365 && (
                    <p
                      className={`text-xs mt-3 ${data.domain_info.ageDays > 365 ? "text-green-700" : "text-orange-700"}`}
                    >
                      {data.domain_info.ageDays <= 30
                        ? "⚠ Very recently registered - high risk indicator for phishing"
                        : "⚠ Recently registered - potential risk indicator"}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
