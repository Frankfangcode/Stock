"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SearchBar } from "@/components/search-bar";
import {
  DEFAULT_WATCHLIST,
  DOMINANT_META,
  GRID_GUIDANCE,
  GRID_ORDER,
  MARKET_META,
  MARKET_ORDER,
  PHASE_META,
  WATCHLIST_STORAGE_KEY,
  formatCurrency,
  formatPercent,
  inferMarketFromSymbol,
  normalizeWatchlistSymbol,
} from "@/lib/constants";
import { analyzeSymbol } from "@/lib/api";
import { AnalyzeResponse, Market } from "@/lib/types";

type LoadState = "idle" | "loading" | "ready" | "error";

export function DashboardClient() {
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_WATCHLIST);
  const [analyses, setAnalyses] = useState<Record<string, AnalyzeResponse>>({});
  const [states, setStates] = useState<Record<string, LoadState>>({});
  const [error, setError] = useState<string | null>(null);
  const [activeGridByMarket, setActiveGridByMarket] = useState<Record<Market, string>>({
    US: "A-1",
    TW: "A-1",
  });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const stored = globalThis.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as string[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalized = parsed
          .map((item) => normalizeWatchlistSymbol(item))
          .filter(Boolean);
        if (normalized.length > 0) {
          setWatchlist(Array.from(new Set(normalized)));
        }
      }
    } catch {
      globalThis.localStorage.removeItem(WATCHLIST_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    globalThis.localStorage.setItem(
      WATCHLIST_STORAGE_KEY,
      JSON.stringify(watchlist),
    );
  }, [watchlist]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateStocks() {
      const missing = watchlist.filter(
        (symbol) => !analyses[symbol] && states[symbol] !== "loading",
      );
      if (missing.length === 0) {
        return;
      }

      await Promise.all(
        missing.map(async (symbol) => {
          setStates((current) => ({ ...current, [symbol]: "loading" }));
          try {
            const result = await analyzeSymbol(symbol);
            if (!cancelled) {
              commitAnalysis(symbol, result);
            }
          } catch (caught) {
            if (!cancelled) {
              setStates((current) => ({ ...current, [symbol]: "error" }));
              setError(
                caught instanceof Error ? caught.message : "無法分析股票資料",
              );
            }
          }
        }),
      );
    }

    void hydrateStocks();

    return () => {
      cancelled = true;
    };
  }, [watchlist, analyses, states]);

  function commitAnalysis(inputSymbol: string, result: AnalyzeResponse) {
    const normalizedInput = normalizeWatchlistSymbol(inputSymbol);
    const watchSymbol = result.display_symbol;

    setWatchlist((current) => {
      const replaced = current.map((item) =>
        item === normalizedInput ? watchSymbol : item,
      );
      return Array.from(new Set(replaced));
    });

    setAnalyses((current) => {
      const next = { ...current, [watchSymbol]: result };
      if (watchSymbol !== normalizedInput) {
        delete next[normalizedInput];
      }
      return next;
    });

    setStates((current) => {
      const next = { ...current, [watchSymbol]: "ready" as LoadState };
      if (watchSymbol !== normalizedInput) {
        delete next[normalizedInput];
      }
      return next;
    });

    setActiveGridByMarket((current) => ({
      ...current,
      [result.market]: result.grid_coordinate,
    }));
  }

  const watchlistByMarket = useMemo(() => {
    const grouped: Record<Market, string[]> = { US: [], TW: [] };
    watchlist.forEach((symbol) => {
      const market = analyses[symbol]?.market ?? inferMarketFromSymbol(symbol);
      grouped[market].push(symbol);
    });
    return grouped;
  }, [analyses, watchlist]);

  const gridMapsByMarket = useMemo(() => {
    const grouped: Record<Market, Record<string, AnalyzeResponse[]>> = {
      US: {},
      TW: {},
    };
    watchlist.forEach((symbol) => {
      const stock = analyses[symbol];
      if (!stock) {
        return;
      }

      if (!grouped[stock.market][stock.grid_coordinate]) {
        grouped[stock.market][stock.grid_coordinate] = [];
      }
      grouped[stock.market][stock.grid_coordinate].push(stock);
    });
    return grouped;
  }, [analyses, watchlist]);

  const stocksByMarket = useMemo(() => {
    const grouped: Record<Market, AnalyzeResponse[]> = { US: [], TW: [] };
    watchlist.forEach((symbol) => {
      const stock = analyses[symbol];
      if (stock) {
        grouped[stock.market].push(stock);
      }
    });
    return grouped;
  }, [analyses, watchlist]);

  async function handleAddSymbol(symbol: string) {
    const normalizedInput = normalizeWatchlistSymbol(symbol);
    setAdding(true);
    setError(null);

    try {
      if (watchlist.includes(normalizedInput)) {
        setStates((current) => ({ ...current, [normalizedInput]: "loading" }));
      } else {
        setWatchlist((current) => [normalizedInput, ...current]);
      }

      const result = await analyzeSymbol(symbol);
      commitAnalysis(normalizedInput, result);
    } catch (caught) {
      setStates((current) => ({ ...current, [normalizedInput]: "error" }));
      setError(caught instanceof Error ? caught.message : "無法分析股票資料");
    } finally {
      setAdding(false);
    }
  }

  function handleRemoveSymbol(symbol: string) {
    setWatchlist((current) => current.filter((item) => item !== symbol));
    setAnalyses((current) => {
      const next = { ...current };
      delete next[symbol];
      return next;
    });
    setStates((current) => {
      const next = { ...current };
      delete next[symbol];
      return next;
    });
  }

  return (
    <div className="pageShell">
      <section className="heroCard">
        <div>
          <p className="eyebrow">Investment Grid System</p>
          <h1>投資十二宮格 P0 儀表板</h1>
          <p className="heroCopy">
            以 Yahoo Finance 基本面與技術面資料，將股票定位到 4×3
            宮格，避免只靠情緒做決策。
          </p>
          <p className="heroSubCopy">
            支援美股與台股，輸入 2330、0050 這類台股代號時會自動解析 Yahoo
            Finance 的市場後綴。
          </p>
        </div>
        <SearchBar onSubmit={handleAddSymbol} pending={adding} />
        {error ? <p className="errorText">{error}</p> : null}
      </section>

      {MARKET_ORDER.map((market) => {
        const marketMeta = MARKET_META[market];
        const marketWatchlist = watchlistByMarket[market];
        const activeGrid = activeGridByMarket[market];
        const highlightedGuidance = GRID_GUIDANCE[activeGrid];
        const gridMap = gridMapsByMarket[market];
        const summaryStocks = stocksByMarket[market];

        return (
          <section className="marketSection" key={market}>
            <section className="surfaceCard">
              <div className="sectionHeader">
                <div>
                  <p className="eyebrow">{marketMeta.shortLabel}</p>
                  <h2>{marketMeta.label}觀察清單</h2>
                </div>
                <p className="sectionHint">{marketMeta.hint}</p>
              </div>
              <div className="watchlistRow">
                {marketWatchlist.length > 0 ? (
                  marketWatchlist.map((symbol) => {
                    const stock = analyses[symbol];
                    const state = states[symbol] ?? "idle";

                    return (
                      <div className="watchPill" key={`${market}-${symbol}`}>
                        <Link className="watchLink" href={`/stock/${symbol}`}>
                          <strong>{stock?.display_symbol ?? symbol}</strong>
                          <span>
                            {stock?.price !== null && stock?.price !== undefined
                              ? formatCurrency(stock.price, stock.currency)
                              : "讀取中"}
                          </span>
                          <span className="mutedText">
                            {stock ? `${stock.grid_coordinate} · ${stock.grid_label}` : "定位中"}
                          </span>
                          <span
                            className={`delta ${
                              stock?.change !== null &&
                              stock?.change !== undefined &&
                              stock.change >= 0
                                ? "positive"
                                : "negative"
                            }`}
                          >
                            {stock?.change !== null && stock?.change !== undefined
                              ? formatPercent(stock.change)
                              : state === "error"
                                ? "失敗"
                                : "分析中"}
                          </span>
                        </Link>
                        <button
                          aria-label={`移除 ${symbol}`}
                          className="removeButton"
                          onClick={() => handleRemoveSymbol(symbol)}
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <p className="mutedText">目前尚未加入{marketMeta.label}股票。</p>
                )}
              </div>
            </section>

            <section className="dashboardGrid">
              <div className="surfaceCard">
                <div className="sectionHeader">
                  <div>
                    <p className="eyebrow">{marketMeta.label} Grid</p>
                    <h2>{marketMeta.label}十二宮格定位</h2>
                  </div>
                  <p className="sectionHint">點格子查看該市場的操作重點。</p>
                </div>
                <div className="gridBoard">
                  {GRID_ORDER.map((cell) => {
                    const stocks = gridMap[cell] ?? [];
                    const isActive = activeGrid === cell;
                    const dominantKey = (
                      Object.keys(DOMINANT_META) as Array<keyof typeof DOMINANT_META>
                    ).find((key) => cell.endsWith(DOMINANT_META[key].column));
                    const phaseKey = (
                      Object.keys(PHASE_META) as Array<keyof typeof PHASE_META>
                    ).find((key) => cell.startsWith(PHASE_META[key].letter));

                    return (
                      <button
                        className={`gridCell ${isActive ? "active" : ""}`}
                        key={`${market}-${cell}`}
                        onClick={() =>
                          setActiveGridByMarket((current) => ({
                            ...current,
                            [market]: cell,
                          }))
                        }
                        type="button"
                      >
                        <div className="cellHeader">
                          <span>{cell}</span>
                          <span
                            className="dot"
                            style={{
                              background:
                                dominantKey !== undefined
                                  ? DOMINANT_META[dominantKey].color
                                  : "white",
                            }}
                          />
                        </div>
                        <div className="cellTitle">
                          <strong>{phaseKey ? PHASE_META[phaseKey].label : ""}</strong>
                          <span>
                            {dominantKey ? DOMINANT_META[dominantKey].label : ""}
                          </span>
                        </div>
                        <div className="cellSymbols">
                          {stocks.length > 0 ? (
                            stocks.map((stock) => (
                              <Link
                                className="symbolChip"
                                href={`/stock/${stock.display_symbol}`}
                                key={`${market}-${stock.display_symbol}`}
                              >
                                {stock.display_symbol}
                              </Link>
                            ))
                          ) : (
                            <span className="mutedText">目前無股票</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="surfaceCard asideStack">
                <div className="sectionHeader">
                  <div>
                    <p className="eyebrow">Focus Cell</p>
                    <h2>{activeGrid}</h2>
                  </div>
                </div>
                <p className="guidanceText">{highlightedGuidance}</p>
                <div className="signalLegend">
                  <div>
                    <span className="legendSwatch value" />
                    <span>價值</span>
                  </div>
                  <div>
                    <span className="legendSwatch growth" />
                    <span>成長</span>
                  </div>
                  <div>
                    <span className="legendSwatch speculative" />
                    <span>投機</span>
                  </div>
                </div>
                <div className="miniList">
                  {summaryStocks.length > 0 ? (
                    summaryStocks.slice(0, 4).map((stock) => (
                      <div className="miniRow" key={`${market}-${stock.display_symbol}`}>
                        <div>
                          <strong>{stock.display_symbol}</strong>
                          <p>{stock.grid_label}</p>
                        </div>
                        <span>{stock.buy_signals.alert_level}</span>
                      </div>
                    ))
                  ) : (
                    <p className="mutedText">這個市場目前還沒有分析結果。</p>
                  )}
                </div>
              </div>
            </section>
          </section>
        );
      })}
    </div>
  );
}
