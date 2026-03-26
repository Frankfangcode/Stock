import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { AnalyzeResponse, NewsItem, SentimentSummary } from "@/lib/types";

const analysisSchema = z.object({
  sentiment: z.object({
    sentiment: z.enum(["positive", "neutral", "negative"]),
    score: z.number().int().min(0).max(100),
    summary: z.string(),
  }),
  insights: z.object({
    coordinate_summary: z.string(),
    constitution_summary: z.string(),
    technical_observation: z.string(),
    news_observation: z.string(),
    action_suggestion: z.string(),
    disclaimer: z.string(),
  }),
});

const fallbackSentiment: SentimentSummary = {
  sentiment: "unavailable",
  score: null,
  summary: "尚未產生新聞情緒分析。",
};

function buildPrompt(stock: AnalyzeResponse, recentNews: NewsItem[]) {
  const headlines =
    recentNews.length > 0
      ? recentNews
          .map(
            (item, index) =>
              `${index + 1}. ${item.title} | ${item.source ?? "Unknown"} | ${item.published_at ?? "N/A"}`,
          )
          .join("\n")
      : "沒有取得近期新聞。";

  return `
請以繁體中文分析以下股票資料，回傳符合 JSON schema 的內容。

股票：${stock.display_symbol} (${stock.name})
市場：${stock.market}
Yahoo 代號：${stock.yahoo_symbol}
價格：${stock.price ?? "N/A"} ${stock.currency}
漲跌：${stock.change ?? "N/A"}%

基本面：
- PE: ${stock.fundamentals.pe ?? "N/A"}
- EPS: ${stock.fundamentals.eps ?? "N/A"}
- ROE: ${stock.fundamentals.roe ?? "N/A"}%
- 營收成長: ${stock.fundamentals.revenue_growth ?? "N/A"}%
- 營業利益率: ${stock.fundamentals.operating_margin ?? "N/A"}%
- 40% 法則: ${stock.rule40 ?? "N/A"}%

技術面：
- RSI: ${stock.technical.rsi ?? "N/A"}
- 布林上軌: ${stock.technical.bollinger?.upper ?? "N/A"}
- 布林中軌: ${stock.technical.bollinger?.middle ?? "N/A"}
- 布林下軌: ${stock.technical.bollinger?.lower ?? "N/A"}
- MA20: ${stock.technical.ma20 ?? "N/A"}
- MA50: ${stock.technical.ma50 ?? "N/A"}
- MA60: ${stock.technical.ma60 ?? "N/A"}

體質與宮格：
- 價值: ${stock.composition.value}%
- 成長: ${stock.composition.growth}%
- 投機: ${stock.composition.speculative}%
- 主導體質: ${stock.dominant}
- 宮格: ${stock.grid_coordinate} / ${stock.grid_label}
- 宮格說明: ${stock.grid_guidance}

買點訊號：
- 股價低於目標價: ${stock.buy_signals.below_target}
- RSI < 20: ${stock.buy_signals.rsi_below_20}
- 觸及布林下軌: ${stock.buy_signals.below_bollinger}
- 分數: ${stock.buy_signals.score}/3
- 警示等級: ${stock.buy_signals.alert_level}

近期新聞：
${headlines}

請注意：
- coordinate_summary 要直接說明為何落在目前這一格。
- constitution_summary 聚焦 5:3:2 體質。
- technical_observation 聚焦 RSI、布林、均線與買點條件。
- news_observation 若沒有新聞，明確說明資料不足。
- action_suggestion 只給一句話。
- disclaimer 固定表達僅供參考、不構成投資建議。
- sentiment.score 為 0 到 100，數字越高越正向。
`.trim();
}

export async function generateOpenAIAnalysis(
  stock: AnalyzeResponse,
  recentNews: NewsItem[],
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ai_model: null,
      sentiment: fallbackSentiment,
      insights: null,
    };
  }

  const client = new OpenAI({ apiKey });
  const candidates = process.env.OPENAI_MODEL
    ? [process.env.OPENAI_MODEL]
    : ["gpt-5-mini", "gpt-4o-mini"];

  let lastError: unknown = null;

  for (const model of candidates) {
    try {
      const response = await client.responses.parse({
        model,
        input: [
          {
            role: "system",
            content:
              "你是投資十二宮格系統的分析助手。只根據提供的資料輸出繁體中文 JSON，不要加入額外文字。",
          },
          {
            role: "user",
            content: buildPrompt(stock, recentNews),
          },
        ],
        text: {
          format: zodTextFormat(analysisSchema, "investment_grid_analysis"),
        },
      });

      if (!response.output_parsed) {
        throw new Error("OpenAI 沒有回傳可解析的分析結果");
      }

      return {
        ai_model: model,
        sentiment: response.output_parsed.sentiment,
        insights: response.output_parsed.insights,
      };
    } catch (error) {
      lastError = error;
    }
  }

  console.error("OpenAI analysis failed", lastError);
  return {
    ai_model: null,
    sentiment: recentNews.length
      ? {
          sentiment: "unavailable" as const,
          score: null,
          summary: "已取得新聞，但 OpenAI 情緒分析暫時不可用。",
        }
      : fallbackSentiment,
    insights: null,
  };
}
