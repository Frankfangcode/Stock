"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  DOMINANT_META,
  GRID_ORDER,
  MARKET_META,
  PHASE_META,
  formatCompactNumber,
  formatCurrency,
  formatPercent,
} from "@/lib/constants";
import { analyzeSymbol, requestAIAnalysis } from "@/lib/api";
import { AnalyzeResponse } from "@/lib/types";

type StockDetailClientProps = {
  symbol: string;
};

function PositionGrid({ stock }: { stock: AnalyzeResponse }) {
  return (
    <div className="gridBoard compactGrid">
      {GRID_ORDER.map((cell) => {
        const dominantKey = (
          Object.keys(DOMINANT_META) as Array<keyof typeof DOMINANT_META>
        ).find((key) => cell.endsWith(DOMINANT_META[key].column));
        const phaseKey = (
          Object.keys(PHASE_META) as Array<keyof typeof PHASE_META>
        ).find((key) => cell.startsWith(PHASE_META[key].letter));

        return (
          <div
            className={`gridCell ${stock.grid_coordinate === cell ? "active" : ""}`}
            key={cell}
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
              <span>{dominantKey ? DOMINANT_META[dominantKey].label : ""}</span>
            </div>
            {stock.grid_coordinate === cell ? (
              <div className="cellSymbols">
                <span className="symbolChip">{stock.display_symbol}</span>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function StockDetailClient({ symbol }: StockDetailClientProps) {
  const [stock, setStock] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(true);
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStock() {
      setPending(true);
      setError(null);

      try {
        const result = await analyzeSymbol(symbol);
        if (!cancelled) {
          setStock(result);
          setAiError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "讀取失敗");
        }
      } finally {
        if (!cancelled) {
          setPending(false);
        }
      }
    }

    void loadStock();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (pending) {
    return (
      <div className="pageShell detailShell">
        <div className="surfaceCard">分析 {symbol} 中...</div>
      </div>
    );
  }

  async function handleGenerateAI() {
    if (!stock) {
      return;
    }

    setAiPending(true);
    setAiError(null);

    try {
      const enrichment = await requestAIAnalysis(stock);
      setStock((current) =>
        current
          ? {
              ...current,
              recent_news: enrichment.recent_news,
              sentiment: enrichment.sentiment,
              insights: enrichment.insights,
              ai_model: enrichment.ai_model,
            }
          : current,
      );
    } catch (caught) {
      setAiError(caught instanceof Error ? caught.message : "AI 分析失敗");
    } finally {
      setAiPending(false);
    }
  }

  if (error || !stock) {
    return (
      <div className="pageShell detailShell">
        <div className="surfaceCard">
          <p className="errorText">{error ?? "查無資料"}</p>
          <Link className="textLink" href="/">
            返回首頁
          </Link>
        </div>
      </div>
    );
  }

  const compositionSegments = [
    { label: "價值", value: stock.composition.value, className: "value" },
    { label: "成長", value: stock.composition.growth, className: "growth" },
    {
      label: "投機",
      value: stock.composition.speculative,
      className: "speculative",
    },
  ];

  const metrics = [
    ["PE", stock.fundamentals.pe === null ? "N/A" : stock.fundamentals.pe.toFixed(2)],
    ["EPS", stock.fundamentals.eps === null ? "N/A" : stock.fundamentals.eps.toFixed(2)],
    ["ROE", formatPercent(stock.fundamentals.roe)],
    ["營收成長", formatPercent(stock.fundamentals.revenue_growth)],
    ["營業利益率", formatPercent(stock.fundamentals.operating_margin)],
    ["40% 法則", formatPercent(stock.rule40)],
    ["RSI(14)", stock.technical.rsi === null ? "N/A" : stock.technical.rsi.toFixed(2)],
    ["Beta", stock.fundamentals.beta === null ? "N/A" : stock.fundamentals.beta.toFixed(2)],
  ];

  const buySignalRows = [
    {
      label: "① 股價 ≤ 目標價",
      passed: stock.buy_signals.below_target,
      value: `${formatCurrency(stock.price, stock.currency)} vs ${formatCurrency(
        stock.fundamentals.analyst_target_price,
        stock.currency,
      )}`,
    },
    {
      label: "② RSI < 20",
      passed: stock.buy_signals.rsi_below_20,
      value: stock.technical.rsi === null ? "N/A" : stock.technical.rsi.toFixed(2),
    },
    {
      label: "③ 觸及布林下軌",
      passed: stock.buy_signals.below_bollinger,
      value: stock.technical.bollinger
        ? `${formatCurrency(stock.price, stock.currency)} / ${formatCurrency(
            stock.technical.bollinger.lower,
            stock.currency,
          )}`
        : "N/A",
    },
  ];

  return (
    <div className="pageShell detailShell">
      <Link className="textLink" href="/">
        ← 返回首頁
      </Link>

      <section className="heroCard detailHero">
        <div>
          <p className="eyebrow">Stock Analysis</p>
          <h1>
            {stock.display_symbol} <span className="inlineName">{stock.name}</span>
          </h1>
          <p className="heroCopy">
            {MARKET_META[stock.market].label} · {stock.sector ?? "Sector N/A"} ·{" "}
            {stock.yahoo_symbol}
          </p>
        </div>
        <div className="heroStats">
          <div className="headlineValue">
            {formatCurrency(stock.price, stock.currency)}
          </div>
          <div
            className={`delta large ${
              stock.change !== null && stock.change >= 0 ? "positive" : "negative"
            }`}
          >
            {formatPercent(stock.change)}
          </div>
          <div className="tagRow">
            <span className="tag">{stock.grid_coordinate}</span>
            <span
              className="tag"
              style={{
                borderColor: DOMINANT_META[stock.dominant].color,
                color: DOMINANT_META[stock.dominant].color,
              }}
            >
              {stock.grid_label}
            </span>
            <span className="tag">{stock.buy_signals.alert_level}</span>
            <span className="tag">{MARKET_META[stock.market].label}</span>
          </div>
        </div>
      </section>

      <section className="detailGrid">
        <div className="surfaceCard">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Position</p>
              <h2>宮格位置</h2>
            </div>
            <p className="sectionHint">
              目前位於 {stock.grid_coordinate}，也就是 {stock.grid_label}
            </p>
          </div>
          <PositionGrid stock={stock} />
          <p className="guidanceText">{stock.grid_guidance}</p>
        </div>

        <div className="surfaceCard">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">5:3:2</p>
              <h2>體質分析</h2>
            </div>
            <p className="sectionHint">價值 / 成長 / 投機 比例</p>
          </div>
          <div className="compositionBar">
            {compositionSegments.map((segment) => (
              <div
                className={`compositionSegment ${segment.className}`}
                key={segment.label}
                style={{ width: `${segment.value}%` }}
              >
                {segment.value}%
              </div>
            ))}
          </div>
          <div className="compositionLegend">
            {compositionSegments.map((segment) => (
              <div key={segment.label}>
                <span className={`legendSwatch ${segment.className}`} />
                <span>
                  {segment.label} {segment.value}%
                </span>
              </div>
            ))}
          </div>
          <p className="guidanceText">{stock.grid_guidance}</p>
        </div>

        <div className="surfaceCard">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Metrics</p>
              <h2>關鍵指標</h2>
            </div>
          </div>
          <div className="metricGrid">
            {metrics.map(([label, value]) => (
              <div className="metricCard" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="surfaceCard">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Buy Signals</p>
              <h2>買點三條件</h2>
            </div>
            <p className="sectionHint">分數 {stock.buy_signals.score}/3</p>
          </div>
          <div className="signalList">
            {buySignalRows.map((signal) => (
              <div className="signalRow" key={signal.label}>
                <div>
                  <strong>
                    {signal.passed ? "✅" : "⬜"} {signal.label}
                  </strong>
                  <p>{signal.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="surfaceCard">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">AI Analysis</p>
              <h2>AI 分析建議</h2>
            </div>
            <p className="sectionHint">
              {stock.ai_model ? `模型 ${stock.ai_model}` : "未啟用 OpenAI 分析"}
            </p>
          </div>
          <div className="actionRow">
            <button
              className="primaryButton"
              disabled={aiPending}
              onClick={handleGenerateAI}
              type="button"
            >
              {aiPending
                ? "AI 分析中..."
                : stock.insights
                  ? "重新產生 AI 分析"
                  : "產生 AI 分析"}
            </button>
            <span className="mutedText">
              按下後才會抓新聞並呼叫 OpenAI，避免每次開頁都耗時與耗 token。
            </span>
          </div>
          {aiError ? <p className="errorText">{aiError}</p> : null}
          {stock.insights ? (
            <div className="signalList">
              <div className="signalRow">
                <div>
                  <strong>📍 坐標判讀</strong>
                  <p>{stock.insights.coordinate_summary}</p>
                </div>
              </div>
              <div className="signalRow">
                <div>
                  <strong>📐 體質分析</strong>
                  <p>{stock.insights.constitution_summary}</p>
                </div>
              </div>
              <div className="signalRow">
                <div>
                  <strong>📊 技術面觀察</strong>
                  <p>{stock.insights.technical_observation}</p>
                </div>
              </div>
              <div className="signalRow">
                <div>
                  <strong>📰 消息面觀察</strong>
                  <p>{stock.insights.news_observation}</p>
                </div>
              </div>
              <div className="signalRow">
                <div>
                  <strong>💡 操作建議</strong>
                  <p>{stock.insights.action_suggestion}</p>
                </div>
              </div>
              <div className="signalRow">
                <div>
                  <strong>⚠️ 免責聲明</strong>
                  <p>{stock.insights.disclaimer}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="mutedText">
              尚未產生 AI 建議。按上方按鈕後才會執行。
            </p>
          )}
        </div>

        <div className="surfaceCard">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">News Sentiment</p>
              <h2>新聞情緒與近期新聞</h2>
            </div>
          </div>
          <div className="metricGrid">
            <div className="metricCard">
              <span>情緒方向</span>
              <strong>{stock.sentiment.sentiment}</strong>
            </div>
            <div className="metricCard">
              <span>情緒分數</span>
              <strong>{stock.sentiment.score ?? "N/A"}</strong>
            </div>
          </div>
          <p className="guidanceText">{stock.sentiment.summary}</p>
          <div className="signalList">
            {stock.recent_news.length > 0 ? (
              stock.recent_news.map((item) => (
                <div className="signalRow" key={item.link}>
                  <div>
                    <strong>
                      <a
                        className="textLink inlineLink"
                        href={item.link}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {item.title}
                      </a>
                    </strong>
                    <p>
                      {item.source ?? "Unknown"} · {item.published_at ?? "N/A"}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="mutedText">目前沒有抓到近期新聞。</p>
            )}
          </div>
        </div>

        <div className="surfaceCard">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Technical</p>
              <h2>技術面快照</h2>
            </div>
          </div>
          <div className="metricGrid">
            <div className="metricCard">
              <span>布林上軌</span>
              <strong>{formatCurrency(stock.technical.bollinger?.upper ?? null, stock.currency)}</strong>
            </div>
            <div className="metricCard">
              <span>布林中軌</span>
              <strong>{formatCurrency(stock.technical.bollinger?.middle ?? null, stock.currency)}</strong>
            </div>
            <div className="metricCard">
              <span>布林下軌</span>
              <strong>{formatCurrency(stock.technical.bollinger?.lower ?? null, stock.currency)}</strong>
            </div>
            <div className="metricCard">
              <span>MA20</span>
              <strong>{formatCurrency(stock.technical.ma20, stock.currency)}</strong>
            </div>
            <div className="metricCard">
              <span>MA50</span>
              <strong>{formatCurrency(stock.technical.ma50, stock.currency)}</strong>
            </div>
            <div className="metricCard">
              <span>MA60</span>
              <strong>{formatCurrency(stock.technical.ma60, stock.currency)}</strong>
            </div>
          </div>
        </div>

        <div className="surfaceCard">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Institutional</p>
              <h2>機構持股</h2>
            </div>
          </div>
          <div className="signalList">
            {stock.top_holders.length > 0 ? (
              stock.top_holders.map((holder) => (
                <div className="signalRow" key={holder.holder}>
                  <div>
                    <strong>{holder.holder}</strong>
                    <p>
                      持股 {formatCompactNumber(holder.shares)} 股 · 佔比{" "}
                      {holder.pct_out === null ? "N/A" : `${holder.pct_out}%`}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="mutedText">目前沒有可用的機構持股資料。</p>
            )}
          </div>
        </div>

        <div className="surfaceCard">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Fundamentals</p>
              <h2>基本面補充</h2>
            </div>
          </div>
          <div className="metricGrid">
            <div className="metricCard">
              <span>目標價</span>
              <strong>{formatCurrency(stock.fundamentals.analyst_target_price, stock.currency)}</strong>
            </div>
            <div className="metricCard">
              <span>52W 高點</span>
              <strong>{formatCurrency(stock.fundamentals.fifty_two_week_high, stock.currency)}</strong>
            </div>
            <div className="metricCard">
              <span>52W 低點</span>
              <strong>{formatCurrency(stock.fundamentals.fifty_two_week_low, stock.currency)}</strong>
            </div>
            <div className="metricCard">
              <span>市值</span>
              <strong>{formatCompactNumber(stock.fundamentals.market_cap)}</strong>
            </div>
            <div className="metricCard">
              <span>50 日均線</span>
              <strong>{formatCurrency(stock.fundamentals.fifty_day_ma, stock.currency)}</strong>
            </div>
            <div className="metricCard">
              <span>200 日均線</span>
              <strong>{formatCurrency(stock.fundamentals.two_hundred_day_ma, stock.currency)}</strong>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
