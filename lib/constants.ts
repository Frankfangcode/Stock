import { AnalyzeResponse, Dominant, Market, Phase } from "@/lib/types";

export const DEFAULT_WATCHLIST = ["OKLO", "CRWD", "NVDA", "AAPL", "2330", "0050"];
export const WATCHLIST_STORAGE_KEY = "investment-grid-watchlist";
export const MARKET_ORDER: Market[] = ["US", "TW"];

export const MARKET_META: Record<
  Market,
  { label: string; shortLabel: string; currency: "USD" | "TWD"; hint: string }
> = {
  US: {
    label: "美股",
    shortLabel: "US",
    currency: "USD",
    hint: "美股代號可直接輸入，例如 NVDA、AAPL。",
  },
  TW: {
    label: "台股",
    shortLabel: "TW",
    currency: "TWD",
    hint: "台股輸入 2330、0050 即可，系統會自動解析上市或上櫃代號。",
  },
};

export const PHASE_META: Record<
  Phase,
  { label: string; letter: string; description: string }
> = {
  evaluate: {
    label: "評估",
    letter: "A",
    description: "先看體質與指標是否站得住，再決定是否進入買點觀察。",
  },
  buy: {
    label: "買進",
    letter: "B",
    description: "條件接近或符合安全買點，可以進一步規劃部位。",
  },
  hold: {
    label: "持有",
    letter: "C",
    description: "趨勢尚未破壞，持續追蹤體質與技術指標。",
  },
  sell: {
    label: "賣出",
    letter: "D",
    description: "偏向高檔或訊號轉弱，應評估減碼或出場。",
  },
};

export const DOMINANT_META: Record<
  Dominant,
  { label: string; column: string; color: string }
> = {
  value: {
    label: "價值",
    column: "1",
    color: "var(--value)",
  },
  growth: {
    label: "成長",
    column: "2",
    color: "var(--growth)",
  },
  speculative: {
    label: "投機",
    column: "3",
    color: "var(--speculative)",
  },
};

export const GRID_GUIDANCE: Record<string, string> = {
  "A-1": "財報分析：ROE、EPS、毛利率、產業結構穩定性",
  "A-2": "40%法則：營收成長率 + 營業利益率 > 40%",
  "A-3": "籌碼面與消息面：法人動向、題材發酵程度",
  "B-1": "股價低於內在價值，PE 低於歷史平均",
  "B-2": "成長趨勢確立，突破關鍵均線",
  "B-3": "消息面發酵前，籌碼明顯集中",
  "C-1": "體質穩健，穩定領息，長期看好",
  "C-2": "成長力維持 40%+ 法則，持續觀察",
  "C-3": "監控籌碼是否撤退，消息面是否轉向",
  "D-1": "體質轉壞，產業結構性衰退",
  "D-2": "成長趨緩，題材結束，法說不如預期",
  "D-3": "消息兌現完畢，籌碼散去，量能萎縮",
};

export const GRID_ORDER = [
  "A-1",
  "A-2",
  "A-3",
  "B-1",
  "B-2",
  "B-3",
  "C-1",
  "C-2",
  "C-3",
  "D-1",
  "D-2",
  "D-3",
];

export function gridMetaFromAnalysis(stock: AnalyzeResponse) {
  const phaseMeta = PHASE_META[stock.phase];
  const dominantMeta = DOMINANT_META[stock.dominant];

  return {
    key: `${phaseMeta.letter}-${dominantMeta.column}`,
    phaseLabel: phaseMeta.label,
    dominantLabel: dominantMeta.label,
    color: dominantMeta.color,
  };
}

export function inferMarketFromSymbol(symbol: string): Market {
  const normalized = symbol.trim().toUpperCase();
  if (/^\d{4,6}$/.test(normalized) || normalized.endsWith(".TW") || normalized.endsWith(".TWO")) {
    return "TW";
  }

  return "US";
}

export function normalizeWatchlistSymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  if (normalized.endsWith(".TW") || normalized.endsWith(".TWO")) {
    return normalized.replace(/\.(TW|TWO)$/, "");
  }
  return normalized;
}

export function formatCurrency(
  value: number | null,
  currency: "USD" | "TWD" = "USD",
  digits = 2,
) {
  if (value === null || Number.isNaN(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(value: number | null, digits = 2) {
  if (value === null || Number.isNaN(value)) {
    return "N/A";
  }

  return `${value.toFixed(digits)}%`;
}

export function formatCompactNumber(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("zh-TW", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}
