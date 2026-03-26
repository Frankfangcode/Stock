# 投資十二宮格系統 — 核心功能需求文件

## Project: Investment Grid System (投資十二宮格)
## Author: Frank (方澤享)
## Date: 2026-03-26
## Target: Claude Code 全端實作

---

## 一、系統概述

基於 EMBA 學長的投資框架，建立一套「去散戶化」的專業投資分析系統。
核心理念：將感性的「買賣衝動」轉化為理性的「坐標分析」。

### 技術棧建議
- **前端**: Next.js / React + Tailwind CSS
- **後端**: Node.js API routes (或 Python FastAPI)
- **資料來源**: Yahoo Finance API (yfinance Python 套件)
- **AI 分析**: Anthropic Claude API (claude-sonnet-4-20250514)
- **部署**: Vercel / Zeabur

---

## 二、核心框架：5:3:2 體質分析

### 股價拆解公式
```
股價 = 價值底層(50%) + 成長溢價(30%) + 投機情緒(20%)
```

### 三種體質定義

| 體質 | 理想佔比 | 評估指標 | 數據來源 |
|------|---------|---------|---------|
| 價值 (Value) | 50% | PE、EPS、ROE、毛利率、營業利益率、產業結構 | Yahoo Finance: financialData, defaultKeyStatistics |
| 成長 (Growth) | 30% | 營收成長率、40%法則(營收成長率+營業利益率>40%)、題材 | Yahoo Finance: financialData.revenueGrowth, operatingMargins |
| 投機 (Speculative) | 20% | 籌碼面(法人買賣超)、消息面(新聞情緒)、資金流向 | Yahoo Finance: institutionOwnership + Google News RSS + Claude API 情緒分析 |

### 體質計算邏輯 (給 Claude Code 的具體演算法)

```python
def calculate_composition(fundamentals):
    value_score = 0
    growth_score = 0
    spec_score = 0
    
    # 價值評分
    if fundamentals['eps'] and fundamentals['eps'] > 0: value_score += 25
    if fundamentals['pe'] and fundamentals['pe'] < 30: value_score += 20
    elif fundamentals['pe'] and fundamentals['pe'] < 60: value_score += 10
    if fundamentals['roe'] and fundamentals['roe'] > 15: value_score += 20
    if fundamentals['gross_margin'] and fundamentals['gross_margin'] > 40: value_score += 15
    if fundamentals['operating_margin'] and fundamentals['operating_margin'] > 20: value_score += 20
    
    # 成長評分
    if fundamentals['revenue_growth'] and fundamentals['revenue_growth'] > 40: growth_score += 40
    elif fundamentals['revenue_growth'] and fundamentals['revenue_growth'] > 20: growth_score += 25
    elif fundamentals['revenue_growth'] and fundamentals['revenue_growth'] > 10: growth_score += 15
    rule40 = (fundamentals['revenue_growth'] or 0) + (fundamentals['operating_margin'] or 0)
    if rule40 > 40: growth_score += 30
    elif rule40 > 25: growth_score += 15
    
    # 投機評分
    if not fundamentals['eps'] or fundamentals['eps'] < 0: spec_score += 30
    if fundamentals['pe'] and fundamentals['pe'] > 80: spec_score += 20
    if not fundamentals['revenue_growth'] or fundamentals['revenue_growth'] <= 0: spec_score += 15
    if not fundamentals['roe'] or fundamentals['roe'] < 0: spec_score += 15
    
    # 正規化到 100%
    total = max(value_score + growth_score + spec_score, 1)
    composition = {
        'value': round(value_score / total * 100),
        'growth': round(growth_score / total * 100),
        'speculative': round(spec_score / total * 100),
    }
    # 確保加總 = 100
    diff = 100 - sum(composition.values())
    composition['value'] += diff
    
    dominant = max(composition, key=composition.get)
    return composition, dominant
```

---

## 三、十二宮格坐標系統

### 坐標定義
```
十二宮格 = 4 階段 × 3 體質

行為 (Row):     評估(Evaluate) | 買進(Buy) | 持有(Hold) | 賣出(Sell)
體質 (Column):  價值(Value)    | 成長(Growth) | 投機(Speculative)
```

### 每格操作指引

| 坐標 | 行為 × 體質 | 具體操作 |
|------|-----------|---------|
| A-1 | 評估-價值 | 財報分析：ROE、EPS、毛利率、產業結構穩定性 |
| A-2 | 評估-成長 | 40%法則：營收成長率 + 營業利益率 > 40% |
| A-3 | 評估-投機 | 籌碼面與消息面：法人動向、題材發酵程度 |
| B-1 | 買進-價值 | 股價低於內在價值，PE 低於歷史平均 |
| B-2 | 買進-成長 | 成長趨勢確立，突破關鍵均線 |
| B-3 | 買進-投機 | 消息面發酵前，籌碼明顯集中 |
| C-1 | 持有-價值 | 體質穩健，穩定領息，長期看好 |
| C-2 | 持有-成長 | 成長力維持 40%+ 法則，持續觀察 |
| C-3 | 持有-投機 | 監控籌碼是否撤退，消息面是否轉向 |
| D-1 | 賣出-價值 | 體質轉壞，產業結構性衰退 |
| D-2 | 賣出-成長 | 成長趨緩，題材結束，法說不如預期 |
| D-3 | 賣出-投機 | 消息兌現完畢，籌碼散去，量能萎縮 |

### 坐標判定邏輯 (Phase Detection)

```python
def determine_phase(price, technical, fundamentals):
    rsi = technical['rsi']
    bollinger = technical['bollinger']
    target_price = fundamentals.get('analyst_target_price', price)
    
    # 買進條件 (學長的三條件)
    buy_conditions = [
        price <= target_price,           # ① 股價 ≤ 分析師目標價
        rsi is not None and rsi < 20,    # ② RSI < 20 (超賣)
        bollinger and price <= bollinger['lower'],  # ③ 觸及布林下軌
    ]
    buy_score = sum(buy_conditions)
    
    # 賣出條件
    sell_conditions = [
        rsi is not None and rsi > 70,    # RSI > 70 (超買)
        bollinger and price >= bollinger['upper'],  # 觸及布林上軌
    ]
    sell_score = sum(sell_conditions)
    
    # 判定
    if buy_score >= 2: return 'buy'
    elif sell_score >= 2: return 'sell'
    elif rsi and 30 < rsi < 70: return 'hold'
    else: return 'evaluate'
```

### 動態位移理論
同一檔股票在不同價位會「換格」。
- 例：台積電 800 元 = 價值股，1700 元 = 成長股，10000 元 = 投機股
- 系統需定期重新評估體質比例

---

## 四、數據蒐集模組

### 4.1 基本面數據 (Yahoo Finance)

```python
import yfinance as yf

def fetch_fundamentals(symbol):
    t = yf.Ticker(symbol)
    info = t.info
    return {
        'pe': info.get('trailingPE'),
        'forward_pe': info.get('forwardPE'),
        'eps': info.get('trailingEps'),
        'roe': info.get('returnOnEquity', 0) * 100 if info.get('returnOnEquity') else None,
        'revenue_growth': info.get('revenueGrowth', 0) * 100 if info.get('revenueGrowth') else None,
        'operating_margin': info.get('operatingMargins', 0) * 100 if info.get('operatingMargins') else None,
        'gross_margin': info.get('grossMargins', 0) * 100 if info.get('grossMargins') else None,
        'analyst_target_price': info.get('targetMeanPrice'),
        'current_price': info.get('currentPrice') or info.get('regularMarketPrice'),
        'market_cap': info.get('marketCap'),
        'fifty_two_week_high': info.get('fiftyTwoWeekHigh'),
        'fifty_two_week_low': info.get('fiftyTwoWeekLow'),
        'fifty_day_ma': info.get('fiftyDayAverage'),
        'two_hundred_day_ma': info.get('twoHundredDayAverage'),
        'beta': info.get('beta'),
        'sector': info.get('sector'),
        'name': info.get('shortName') or info.get('longName'),
    }
```

### 4.2 技術指標計算

```python
import numpy as np

def fetch_technical(symbol):
    t = yf.Ticker(symbol)
    hist = t.history(period='3mo')
    closes = hist['Close'].values
    
    # RSI(14)
    def calc_rsi(prices, period=14):
        deltas = np.diff(prices)
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)
        avg_gain = np.mean(gains[-period:])
        avg_loss = np.mean(losses[-period:])
        if avg_loss == 0: return 100
        rs = avg_gain / avg_loss
        return round(100 - 100 / (1 + rs), 2)
    
    # 布林通道(20, 2)
    def calc_bollinger(prices, period=20, mult=2):
        if len(prices) < period: return None
        sma = np.mean(prices[-period:])
        std = np.std(prices[-period:])
        return {
            'upper': round(sma + mult * std, 2),
            'middle': round(sma, 2),
            'lower': round(sma - mult * std, 2),
        }
    
    # 均線
    def calc_ma(prices, period):
        if len(prices) < period: return None
        return round(np.mean(prices[-period:]), 2)
    
    return {
        'rsi': calc_rsi(closes) if len(closes) > 14 else None,
        'bollinger': calc_bollinger(closes),
        'ma5': calc_ma(closes, 5),
        'ma20': calc_ma(closes, 20),
        'ma50': calc_ma(closes, 50),
        'ma60': calc_ma(closes, 60),
        'current_price': round(float(closes[-1]), 2),
        'prev_close': round(float(closes[-2]), 2) if len(closes) > 1 else None,
    }
```

### 4.3 消息面 — 新聞情緒分析

```python
import requests

def fetch_news_sentiment(symbol, anthropic_api_key):
    # 1. 抓新聞標題 (Google News RSS)
    url = f'https://news.google.com/rss/search?q={symbol}+stock&hl=en-US&gl=US&ceid=US:en'
    resp = requests.get(url)
    # 解析 RSS XML 提取 <title> 標籤（最多 8 條）
    
    # 2. 送 Claude 做情緒分析
    response = requests.post('https://api.anthropic.com/v1/messages', 
        headers={
            'x-api-key': anthropic_api_key,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
        },
        json={
            'model': 'claude-sonnet-4-20250514',
            'max_tokens': 300,
            'messages': [{
                'role': 'user',
                'content': f'分析新聞情緒，回傳純JSON：{{"sentiment":"positive/neutral/negative","score":0-100,"summary":"一句話摘要"}}\n\n{headlines}'
            }]
        }
    )
    return parse_sentiment(response.json())
```

### 4.4 籌碼面 — 機構持股

```python
def fetch_institutional(symbol):
    t = yf.Ticker(symbol)
    holders = t.institutional_holders
    # 回傳前 5 大機構持股、持股變動百分比
    return {
        'top_holders': holders.head(5).to_dict() if holders is not None else [],
        'insider_trades': t.insider_transactions,
    }
```

---

## 五、買點觸發警報系統

### 三條件買點 (學長的核心策略)

```
最安全買點 = 條件①+②+③ 同時滿足

① 股價 ≤ 分析師目標價（基本面確認）
② RSI(14) < 20（技術面超賣）
③ 股價觸及布林通道下軌（價格支撐）
```

### 警報等級
| 等級 | 條件 | 動作 |
|------|------|------|
| 🔥 強烈買入 | 3/3 條件滿足 | 立即推播通知 |
| ⚡ 關注買入 | 2/3 條件滿足 | 日報提醒 |
| 📊 觀察中 | 1/3 條件滿足 | 週報記錄 |
| 🧘 無信號 | 0/3 條件滿足 | 正常監控 |

---

## 六、AI 分析建議模組

### Claude API 整合

每次分析一檔股票時，將所有維度數據送入 Claude，產生結構化建議：

```python
ANALYSIS_PROMPT = """
你是「投資十二宮格」分析系統。根據以下數據，用繁體中文產出分析：

股票：{symbol} ({name})
價格：${price} | 漲跌：{change}%

【基本面】
PE：{pe} | EPS：${eps} | ROE：{roe}%
營收成長：{revenue_growth}% | 營業利益率：{operating_margin}%
40%法則：{rule40}%

【技術面】
RSI(14)：{rsi}
布林通道：上軌 ${bb_upper} / 中軌 ${bb_middle} / 下軌 ${bb_lower}
MA50：${ma50} | MA200：${ma200}

【體質分析】
價值 {value_pct}% | 成長 {growth_pct}% | 投機 {spec_pct}%
主導體質：{dominant}

【買點條件】
① 股價≤目標價：{cond1} (${price} vs ${target})
② RSI<20：{cond2} (RSI={rsi})
③ 布林下軌：{cond3}
買入分數：{buy_score}/3

請回傳：
1. 📍 坐標判讀（哪一個宮格）
2. 📐 體質分析重點
3. 📊 技術面觀察
4. 📰 消息面觀察
5. 💡 操作建議（一句話）

⚠️ 加上免責聲明：僅供參考，不構成投資建議
"""
```

---

## 七、前端 UI 需求

### 7.1 首頁 — 觀察清單 + 十二宮格

- 輸入框：輸入美股代號，按 Enter 分析
- 觀察清單橫列：已分析的股票代號按鈕
- 十二宮格：4×3 網格，每格顯示歸類到該格的股票代號
- 點擊格子顯示該格的操作說明

### 7.2 個股分析頁

- **頂部卡片**：代號、名稱、價格、漲跌、體質標籤、坐標標籤
- **5:3:2 體質條**：三色進度條 (藍=價值, 綠=成長, 紅=投機)
- **關鍵指標面板**：PE、EPS、ROE、營收成長、營業利益率、40%法則、RSI、Beta
- **買點三條件**：三個條件各顯示 ✅/⬜ + 數值
- **AI 分析建議**：Claude 產出的五點分析
- **新聞情緒**：近期新聞標題 + 正面/中性/負面標示
- **機構持股**：前五大機構名稱

### 7.3 設計風格
- 深色主題 (背景 #020617 → #0f172a → #1a1145 漸層)
- 科技感、儀表板風格
- 配色：藍=價值 #3b82f6, 綠=成長 #16a34a, 紅=投機 #ef4444
- 字體：SF Pro Display / Noto Sans TC

---

## 八、API Endpoints 設計

```
POST /api/analyze
  Body: { symbol: "OKLO" }
  Response: {
    symbol, name, sector, price, change,
    fundamentals: { pe, eps, roe, revenue_growth, operating_margin, ... },
    technical: { rsi, bollinger, ma50, ma60, ... },
    composition: { value, growth, speculative },
    dominant, phase, rule40,
    buy_signals: { below_target, rsi_below_20, below_bollinger, score },
    sentiment: { sentiment, score, summary },
    insights: [...],
    top_holders: [...],
    recent_news: [...]
  }

GET /api/watchlist
  Response: [{ symbol, price, change, phase, dominant, last_updated }]

POST /api/watchlist
  Body: { symbol: "NVDA" }
  
DELETE /api/watchlist/:symbol
```

---

## 九、預設觀察清單

```python
DEFAULT_WATCHLIST = [
    {"symbol": "OKLO", "name": "Oklo Inc.", "sector": "Nuclear Energy"},
    {"symbol": "CRWD", "name": "CrowdStrike", "sector": "Cybersecurity"},
    {"symbol": "NVDA", "name": "NVIDIA", "sector": "Semiconductors"},
    {"symbol": "AAPL", "name": "Apple Inc.", "sector": "Consumer Tech"},
]
```

---

## 十、環境變數

```env
ANTHROPIC_API_KEY=your_key_here
# Yahoo Finance 不需要 API key (yfinance 套件免費)
```

---

## 十一、MVP 優先級

### P0 — Must Have (第一版)
1. ✅ 輸入股票代號 → 即時抓取 Yahoo Finance 數據
2. ✅ 5:3:2 體質分析 + 十二宮格坐標定位
3. ✅ 技術指標計算 (RSI + 布林通道 + 均線)
4. ✅ 買點三條件警報
5. ✅ 前端儀表板顯示

### P1 — Should Have (第二版)
6. Claude AI 深度分析建議
7. 新聞情緒分析
8. 機構持股數據
9. 多股票比較總覽表

### P2 — Nice to Have (第三版)
10. LINE Bot 推播警報
11. 歷史坐標追蹤 (看一檔股票的坐標如何移動)
12. Google Sheet 自動記錄
13. 自訂觀察清單持久化

---

## 十二、「落難美女」選股策略 (參考)

學長建議按年齡/資金規模選擇不同類型：
- **資深落難美女 (價值股)**：巴菲特型，大營收、穩健。適合資金大、求穩。
- **年輕落難美女 (潛力成長股)**：策略對、市場對、營收在衝。適合年輕人、資金小、追求翻倍。

Frank 目前適合「年輕落難美女」策略 — 聚焦成長股中暫時回檔的標的。

---

*Generated by Claude for use with Claude Code*
*Framework credit: EMBA 學長 Chester 張清鑫*
