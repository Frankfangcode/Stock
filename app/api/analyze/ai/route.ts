import { NextRequest, NextResponse } from "next/server";
import { fetchRecentNews } from "@/lib/news";
import { generateOpenAIAnalysis } from "@/lib/openai-analysis";
import { AIEnrichmentResponse, AnalyzeResponse } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as { stock?: AnalyzeResponse };
    const stock = payload.stock;

    if (!stock) {
      return NextResponse.json({ error: "缺少股票分析資料" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "尚未設定 OPENAI_API_KEY，無法執行 AI 分析" },
        { status: 400 },
      );
    }

    const recentNews = await fetchRecentNews({
      symbol: stock.display_symbol,
      name: stock.name,
      market: stock.market,
    }).catch((error) => {
      console.error("news fetch failed", error);
      return [];
    });

    const aiAnalysis = await generateOpenAIAnalysis(
      {
        ...stock,
        recent_news: recentNews,
      },
      recentNews,
    );

    const result: AIEnrichmentResponse = {
      recent_news: recentNews,
      sentiment: aiAnalysis.sentiment,
      insights: aiAnalysis.insights,
      ai_model: aiAnalysis.ai_model,
    };

    return NextResponse.json(result);
  } catch (caught) {
    return NextResponse.json(
      {
        error:
          caught instanceof Error ? caught.message : "AI 分析時發生未預期錯誤",
      },
      { status: 500 },
    );
  }
}
