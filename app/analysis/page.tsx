"use client";

import { Navbar1 } from "@/components/navbar1";
import { mockAnalysisResult } from "@/lib/mock-data";

export default function AnalysisPage() {
  const secureFindings = mockAnalysisResult.findings.filter(
    (f) => f.type === "secure",
  );
  const insecureFindings = mockAnalysisResult.findings.filter(
    (f) => f.type === "insecure",
  );

  // Calculate phishing likeliness based on insecure vs secure findings
  const phishingScore = Math.min(
    100,
    Math.round(
      (insecureFindings.length / mockAnalysisResult.findings.length) * 100,
    ),
  );

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
          {/* URL and Status */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Analysis Results</h1>
            <p className="text-gray-600 break-all">
              {mockAnalysisResult.pageState.url}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Threat Level:{" "}
              <span className="font-semibold uppercase">
                {mockAnalysisResult.threat_level}
              </span>
            </p>
          </div>

          {/* Score and Findings Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Phishing Score */}
            <div className="flex flex-col items-center justify-center p-8 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg border border-orange-200">
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

            {/* Findings Sections */}
            <div className="space-y-4 overflow-y-auto max-h-96">
              {/* Secure Findings */}
              {secureFindings.length > 0 && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg font-semibold text-green-700">
                      ✓ Secure Aspects
                    </span>
                    <span className="inline-block px-2 py-1 text-xs font-semibold bg-green-200 text-green-800 rounded">
                      {secureFindings.length} Found
                    </span>
                  </div>
                  <div className="space-y-2">
                    {secureFindings.map((finding, idx) => (
                      <div key={idx} className="text-sm">
                        <p className="font-medium text-green-900">
                          {finding.claim}
                        </p>
                        <p className="text-green-700 text-xs mt-0.5">
                          {finding.evidence}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Insecure Findings */}
              {insecureFindings.length > 0 && (
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg font-semibold text-red-700">
                      ⚠ Insecure Aspects
                    </span>
                    <span className="inline-block px-2 py-1 text-xs font-semibold bg-red-200 text-red-800 rounded">
                      {insecureFindings.length} Found
                    </span>
                  </div>
                  <div className="space-y-2">
                    {insecureFindings.map((finding, idx) => (
                      <div key={idx} className="text-sm">
                        <p className="font-medium text-red-900">
                          {finding.claim}
                        </p>
                        <p className="text-red-700 text-xs mt-0.5">
                          {finding.evidence}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
