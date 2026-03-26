import { AIEnrichmentResponse, AnalyzeResponse } from "@/lib/types";

export async function analyzeSymbol(symbol: string): Promise<AnalyzeResponse> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ symbol }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "分析失敗");
  }

  return payload as AnalyzeResponse;
}

export async function requestAIAnalysis(
  stock: AnalyzeResponse,
): Promise<AIEnrichmentResponse> {
  const response = await fetch("/api/analyze/ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ stock }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "AI 分析失敗");
  }

  return payload as AIEnrichmentResponse;
}
