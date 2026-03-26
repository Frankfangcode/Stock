export type Phase = "evaluate" | "buy" | "hold" | "sell";
export type Dominant = "value" | "growth" | "speculative";
export type Market = "US" | "TW";
export type SentimentLabel =
  | "positive"
  | "neutral"
  | "negative"
  | "unavailable";

export type Composition = {
  value: number;
  growth: number;
  speculative: number;
};

export type NewsItem = {
  title: string;
  link: string;
  source: string | null;
  published_at: string | null;
};

export type TopHolder = {
  holder: string;
  shares: number | null;
  value: number | null;
  pct_out: number | null;
};

export type SentimentSummary = {
  sentiment: SentimentLabel;
  score: number | null;
  summary: string;
};

export type AIInsights = {
  coordinate_summary: string;
  constitution_summary: string;
  technical_observation: string;
  news_observation: string;
  action_suggestion: string;
  disclaimer: string;
};

export type AIEnrichmentResponse = {
  recent_news: NewsItem[];
  sentiment: SentimentSummary;
  insights: AIInsights | null;
  ai_model: string | null;
};

export type AnalyzeResponse = {
  input_symbol: string;
  display_symbol: string;
  symbol: string;
  yahoo_symbol: string;
  market: Market;
  currency: "USD" | "TWD";
  name: string;
  sector: string | null;
  price: number | null;
  change: number | null;
  fundamentals: {
    pe: number | null;
    forward_pe: number | null;
    eps: number | null;
    roe: number | null;
    revenue_growth: number | null;
    operating_margin: number | null;
    gross_margin: number | null;
    analyst_target_price: number | null;
    market_cap: number | null;
    fifty_two_week_high: number | null;
    fifty_two_week_low: number | null;
    fifty_day_ma: number | null;
    two_hundred_day_ma: number | null;
    beta: number | null;
  };
  technical: {
    rsi: number | null;
    bollinger: {
      upper: number;
      middle: number;
      lower: number;
    } | null;
    ma5: number | null;
    ma20: number | null;
    ma50: number | null;
    ma60: number | null;
    current_price: number | null;
    prev_close: number | null;
  };
  composition: Composition;
  dominant: Dominant;
  phase: Phase;
  grid_coordinate: string;
  grid_label: string;
  grid_guidance: string;
  rule40: number | null;
  top_holders: TopHolder[];
  recent_news: NewsItem[];
  sentiment: SentimentSummary;
  insights: AIInsights | null;
  ai_model: string | null;
  buy_signals: {
    below_target: boolean;
    rsi_below_20: boolean;
    below_bollinger: boolean;
    score: number;
    alert_level: string;
  };
  updated_at: string;
};
