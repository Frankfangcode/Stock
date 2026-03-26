import { spawn } from "node:child_process";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { fetchRecentNews } from "@/lib/news";
import { AnalyzeResponse } from "@/lib/types";

export const runtime = "nodejs";

function runAnalyzer(symbol: string) {
  const pythonBin = process.env.PYTHON_BIN ?? "python3";
  const scriptPath = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "python",
    "analyze_stock.py",
  );

  return new Promise<string>((resolve, reject) => {
    const child = spawn(pythonBin, [scriptPath, symbol], {
      cwd: process.cwd(),
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || "Python 分析器執行失敗"));
        return;
      }

      resolve(stdout.trim());
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as { symbol?: string };
    const symbol = payload.symbol?.trim().toUpperCase();

    if (!symbol) {
      return NextResponse.json(
        { error: "請提供股票代號" },
        { status: 400 },
      );
    }

    const output = await runAnalyzer(symbol);
    const baseResult = JSON.parse(output) as AnalyzeResponse;
    const recentNews = await fetchRecentNews({
      symbol: baseResult.display_symbol,
      name: baseResult.name,
      market: baseResult.market,
    }).catch((error) => {
      console.error("news fetch failed", error);
      return [];
    });

    const result: AnalyzeResponse = {
      ...baseResult,
      recent_news: recentNews,
    };

    return NextResponse.json(result);
  } catch (caught) {
    return NextResponse.json(
      {
        error:
          caught instanceof Error ? caught.message : "分析時發生未預期錯誤",
      },
      { status: 500 },
    );
  }
}
