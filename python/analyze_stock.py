#!/usr/bin/env python3

import json
import sys
from datetime import datetime, timezone

import numpy as np
import yfinance as yf


GRID_GUIDANCE = {
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
}

PHASE_META = {
    "evaluate": {"label": "評估", "letter": "A"},
    "buy": {"label": "買進", "letter": "B"},
    "hold": {"label": "持有", "letter": "C"},
    "sell": {"label": "賣出", "letter": "D"},
}

DOMINANT_META = {
    "value": {"label": "價值", "column": "1"},
    "growth": {"label": "成長", "column": "2"},
    "speculative": {"label": "投機", "column": "3"},
}

ALERT_LEVELS = {
    3: "🔥 強烈買入",
    2: "⚡ 關注買入",
    1: "📊 觀察中",
    0: "🧘 無信號",
}

TW_MARKET_SUFFIXES = (".TW", ".TWO")


def safe_round(value, digits=2):
    if value is None:
        return None
    try:
        if np.isnan(value):
            return None
    except TypeError:
        pass
    return round(float(value), digits)


def infer_symbol_candidates(raw_symbol):
    normalized = raw_symbol.strip().upper()
    if not normalized:
        raise ValueError("請提供股票代號")

    if normalized.endswith(TW_MARKET_SUFFIXES):
        return [
            {
                "query_symbol": normalized,
                "display_symbol": normalized.replace(".TWO", "").replace(".TW", ""),
                "market": "TW",
                "currency": "TWD",
            }
        ]

    if normalized.isdigit() and 4 <= len(normalized) <= 6:
        return [
            {
                "query_symbol": f"{normalized}.TW",
                "display_symbol": normalized,
                "market": "TW",
                "currency": "TWD",
            },
            {
                "query_symbol": f"{normalized}.TWO",
                "display_symbol": normalized,
                "market": "TW",
                "currency": "TWD",
            },
        ]

    return [
        {
            "query_symbol": normalized,
            "display_symbol": normalized,
            "market": "US",
            "currency": "USD",
        }
    ]


def has_meaningful_quote(info):
    return any(
        info.get(key) is not None
        for key in [
            "currentPrice",
            "regularMarketPrice",
            "shortName",
            "longName",
            "marketCap",
            "symbol",
        ]
    )


def resolve_symbol(raw_symbol):
    last_error = None
    for candidate in infer_symbol_candidates(raw_symbol):
        try:
            ticker = yf.Ticker(candidate["query_symbol"])
            info = ticker.info or {}
            history = ticker.history(period="6mo", auto_adjust=False)
            if history.empty or "Close" not in history or history["Close"].dropna().empty:
                raise ValueError(f"{candidate['query_symbol']} 無法取得歷史價格資料")
            if not has_meaningful_quote(info):
                raise ValueError(f"{candidate['query_symbol']} 無法取得基本資料")
            return {
                **candidate,
                "ticker": ticker,
                "info": info,
                "history": history,
            }
        except Exception as exc:
            last_error = exc

    raise ValueError(str(last_error) if last_error else "找不到可分析的股票代號")


def fetch_fundamentals(resolved):
    info = resolved["info"]

    return {
        "symbol": resolved["display_symbol"],
        "yahoo_symbol": resolved["query_symbol"],
        "market": resolved["market"],
        "currency": resolved["currency"],
        "name": info.get("shortName") or info.get("longName") or resolved["display_symbol"],
        "sector": info.get("sector"),
        "pe": safe_round(info.get("trailingPE")),
        "forward_pe": safe_round(info.get("forwardPE")),
        "eps": safe_round(info.get("trailingEps")),
        "roe": safe_round((info.get("returnOnEquity") or 0) * 100)
        if info.get("returnOnEquity") is not None
        else None,
        "revenue_growth": safe_round((info.get("revenueGrowth") or 0) * 100)
        if info.get("revenueGrowth") is not None
        else None,
        "operating_margin": safe_round((info.get("operatingMargins") or 0) * 100)
        if info.get("operatingMargins") is not None
        else None,
        "gross_margin": safe_round((info.get("grossMargins") or 0) * 100)
        if info.get("grossMargins") is not None
        else None,
        "analyst_target_price": safe_round(info.get("targetMeanPrice")),
        "current_price": safe_round(
            info.get("currentPrice") or info.get("regularMarketPrice")
        ),
        "market_cap": safe_round(info.get("marketCap"), 0),
        "fifty_two_week_high": safe_round(info.get("fiftyTwoWeekHigh")),
        "fifty_two_week_low": safe_round(info.get("fiftyTwoWeekLow")),
        "fifty_day_ma": safe_round(info.get("fiftyDayAverage")),
        "two_hundred_day_ma": safe_round(info.get("twoHundredDayAverage")),
        "beta": safe_round(info.get("beta")),
    }


def calc_rsi(prices, period=14):
    if len(prices) <= period:
        return None

    deltas = np.diff(prices)
    gains = np.where(deltas > 0, deltas, 0)
    losses = np.where(deltas < 0, -deltas, 0)
    avg_gain = np.mean(gains[-period:])
    avg_loss = np.mean(losses[-period:])

    if avg_loss == 0:
        return 100.0

    rs = avg_gain / avg_loss
    return safe_round(100 - 100 / (1 + rs))


def calc_bollinger(prices, period=20, mult=2):
    if len(prices) < period:
        return None

    window = prices[-period:]
    sma = np.mean(window)
    std = np.std(window)
    return {
        "upper": safe_round(sma + mult * std),
        "middle": safe_round(sma),
        "lower": safe_round(sma - mult * std),
    }


def calc_ma(prices, period):
    if len(prices) < period:
        return None
    return safe_round(np.mean(prices[-period:]))


def fetch_technical(resolved):
    hist = resolved["history"]
    if hist.empty or "Close" not in hist:
        raise ValueError(f"{resolved['query_symbol']} 無法取得歷史價格資料")

    closes = hist["Close"].dropna().astype(float).values
    current_price = safe_round(closes[-1]) if len(closes) > 0 else None
    prev_close = safe_round(closes[-2]) if len(closes) > 1 else None

    return {
        "rsi": calc_rsi(closes),
        "bollinger": calc_bollinger(closes),
        "ma5": calc_ma(closes, 5),
        "ma20": calc_ma(closes, 20),
        "ma50": calc_ma(closes, 50),
        "ma60": calc_ma(closes, 60),
        "current_price": current_price,
        "prev_close": prev_close,
    }


def fetch_institutional(resolved):
    holders = getattr(resolved["ticker"], "institutional_holders", None)
    if holders is None or holders.empty:
        return []

    top_holders = []
    for _, row in holders.head(5).iterrows():
        top_holders.append(
            {
                "holder": row.get("Holder") or "Unknown Holder",
                "shares": safe_round(row.get("Shares"), 0),
                "value": safe_round(row.get("Value"), 0),
                "pct_out": safe_round(row.get("% Out"), 4),
            }
        )

    return top_holders


def calculate_composition(fundamentals):
    value_score = 0
    growth_score = 0
    spec_score = 0

    eps = fundamentals.get("eps")
    pe = fundamentals.get("pe")
    roe = fundamentals.get("roe")
    gross_margin = fundamentals.get("gross_margin")
    operating_margin = fundamentals.get("operating_margin")
    revenue_growth = fundamentals.get("revenue_growth")

    if eps is not None and eps > 0:
        value_score += 25
    if pe is not None and pe < 30:
        value_score += 20
    elif pe is not None and pe < 60:
        value_score += 10
    if roe is not None and roe > 15:
        value_score += 20
    if gross_margin is not None and gross_margin > 40:
        value_score += 15
    if operating_margin is not None and operating_margin > 20:
        value_score += 20

    if revenue_growth is not None and revenue_growth > 40:
        growth_score += 40
    elif revenue_growth is not None and revenue_growth > 20:
        growth_score += 25
    elif revenue_growth is not None and revenue_growth > 10:
        growth_score += 15

    rule40 = (revenue_growth or 0) + (operating_margin or 0)
    if rule40 > 40:
        growth_score += 30
    elif rule40 > 25:
        growth_score += 15

    if eps is None or eps < 0:
        spec_score += 30
    if pe is not None and pe > 80:
        spec_score += 20
    if revenue_growth is None or revenue_growth <= 0:
        spec_score += 15
    if roe is None or roe < 0:
        spec_score += 15

    total = max(value_score + growth_score + spec_score, 1)
    composition = {
        "value": round(value_score / total * 100),
        "growth": round(growth_score / total * 100),
        "speculative": round(spec_score / total * 100),
    }
    diff = 100 - sum(composition.values())
    composition["value"] += diff

    dominant = max(composition, key=composition.get)
    return composition, dominant, safe_round(rule40)


def determine_phase(price, technical, fundamentals):
    rsi = technical.get("rsi")
    bollinger = technical.get("bollinger")
    target_price = fundamentals.get("analyst_target_price") or price

    buy_conditions = [
        price is not None and target_price is not None and price <= target_price,
        rsi is not None and rsi < 20,
        bollinger is not None
        and price is not None
        and bollinger.get("lower") is not None
        and price <= bollinger["lower"],
    ]
    buy_score = sum(1 for condition in buy_conditions if condition)

    sell_conditions = [
        rsi is not None and rsi > 70,
        bollinger is not None
        and price is not None
        and bollinger.get("upper") is not None
        and price >= bollinger["upper"],
    ]
    sell_score = sum(1 for condition in sell_conditions if condition)

    if buy_score >= 2:
        return "buy"
    if sell_score >= 2:
        return "sell"
    if rsi is not None and 30 < rsi < 70:
        return "hold"
    return "evaluate"


def determine_buy_signals(price, technical, fundamentals):
    target_price = fundamentals.get("analyst_target_price")
    bollinger = technical.get("bollinger")

    below_target = (
        price is not None and target_price is not None and price <= target_price
    )
    rsi_below_20 = technical.get("rsi") is not None and technical["rsi"] < 20
    below_bollinger = (
        bollinger is not None
        and price is not None
        and bollinger.get("lower") is not None
        and price <= bollinger["lower"]
    )
    score = sum([below_target, rsi_below_20, below_bollinger])

    return {
        "below_target": below_target,
        "rsi_below_20": rsi_below_20,
        "below_bollinger": below_bollinger,
        "score": score,
        "alert_level": ALERT_LEVELS[score],
    }


def calculate_change(price, prev_close):
    if price is None or prev_close in (None, 0):
        return None
    return safe_round(((price - prev_close) / prev_close) * 100)


def build_grid(phase, dominant):
    coordinate = (
        f"{PHASE_META[phase]['letter']}-{DOMINANT_META[dominant]['column']}"
    )
    label = f"{PHASE_META[phase]['label']} · {DOMINANT_META[dominant]['label']}"
    return coordinate, label, GRID_GUIDANCE[coordinate]


def analyze(symbol):
    resolved = resolve_symbol(symbol)
    fundamentals = fetch_fundamentals(resolved)
    technical = fetch_technical(resolved)
    top_holders = fetch_institutional(resolved)

    price = technical.get("current_price") or fundamentals.get("current_price")
    change = calculate_change(price, technical.get("prev_close"))

    fundamentals["current_price"] = price

    composition, dominant, rule40 = calculate_composition(fundamentals)
    phase = determine_phase(price, technical, fundamentals)
    buy_signals = determine_buy_signals(price, technical, fundamentals)
    grid_coordinate, grid_label, grid_guidance = build_grid(phase, dominant)

    return {
        "input_symbol": symbol,
        "display_symbol": fundamentals["symbol"],
        "symbol": fundamentals["symbol"],
        "yahoo_symbol": fundamentals["yahoo_symbol"],
        "market": fundamentals["market"],
        "currency": fundamentals["currency"],
        "name": fundamentals["name"],
        "sector": fundamentals["sector"],
        "price": price,
        "change": change,
        "fundamentals": {
            "pe": fundamentals["pe"],
            "forward_pe": fundamentals["forward_pe"],
            "eps": fundamentals["eps"],
            "roe": fundamentals["roe"],
            "revenue_growth": fundamentals["revenue_growth"],
            "operating_margin": fundamentals["operating_margin"],
            "gross_margin": fundamentals["gross_margin"],
            "analyst_target_price": fundamentals["analyst_target_price"],
            "market_cap": fundamentals["market_cap"],
            "fifty_two_week_high": fundamentals["fifty_two_week_high"],
            "fifty_two_week_low": fundamentals["fifty_two_week_low"],
            "fifty_day_ma": fundamentals["fifty_day_ma"],
            "two_hundred_day_ma": fundamentals["two_hundred_day_ma"],
            "beta": fundamentals["beta"],
        },
        "technical": technical,
        "composition": composition,
        "dominant": dominant,
        "phase": phase,
        "grid_coordinate": grid_coordinate,
        "grid_label": grid_label,
        "grid_guidance": grid_guidance,
        "rule40": rule40,
        "top_holders": top_holders,
        "recent_news": [],
        "sentiment": {
            "sentiment": "unavailable",
            "score": None,
            "summary": "尚未產生新聞情緒分析。",
        },
        "insights": None,
        "ai_model": None,
        "buy_signals": buy_signals,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def main():
    if len(sys.argv) < 2 or not sys.argv[1].strip():
        raise ValueError("請提供股票代號")

    symbol = sys.argv[1].strip().upper()
    result = analyze(symbol)
    sys.stdout.write(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        sys.stderr.write(str(exc))
        sys.exit(1)
