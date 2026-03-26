# 投資十二宮格系統 P1

以 Next.js + Python (`yfinance`) 實作的投資十二宮格 MVP，支援美股與台股。

## 已完成功能

- 股票代號輸入後即時抓取 Yahoo Finance 資料
- 台股代號自動解析 `.TW` / `.TWO`
- 5:3:2 體質分析與主導體質判定
- RSI、布林通道、MA5/20/50/60 技術指標
- 三條件買點警報與警示等級
- 首頁依市場拆分的十二宮格儀表板與個股分析頁
- 個股頁高亮顯示目前宮格位置
- 近期新聞列表與新聞情緒欄位
- 機構持股前五大
- OpenAI 分析建議整合

## 本機啟動

1. 安裝前端依賴: `npm install`
2. 建立虛擬環境: `python3 -m venv .venv`
3. 安裝 Python 套件: `.venv/bin/pip install -r requirements.txt`
4. 設定環境變數: `cp .env.example .env.local`
5. 啟動開發伺服器: `npm run dev`

`npm run dev` / `npm start` 已經在 script 內指定 `PYTHON_BIN=.venv/bin/python`，API route 會用它執行 [`python/analyze_stock.py`](/Users/frank/Library/Mobile Documents/com~apple~CloudDocs/政大大二下/股價分析/python/analyze_stock.py)。

## OpenAI 設定

- `OPENAI_API_KEY`: 必填，用於 P1 的 AI 分析與新聞情緒摘要
- `OPENAI_MODEL`: 選填，預設 `gpt-5-mini`，若帳號權限不同可改成其他可用模型

## 主要結構

- [`app/page.tsx`](/Users/frank/Library/Mobile Documents/com~apple~CloudDocs/政大大二下/股價分析/app/page.tsx): 首頁儀表板
- [`app/stock/[symbol]/page.tsx`](/Users/frank/Library/Mobile Documents/com~apple~CloudDocs/政大大二下/股價分析/app/stock/[symbol]/page.tsx): 個股分析頁
- [`app/api/analyze/route.ts`](/Users/frank/Library/Mobile Documents/com~apple~CloudDocs/政大大二下/股價分析/app/api/analyze/route.ts): Next API 與 Python bridge
- [`python/analyze_stock.py`](/Users/frank/Library/Mobile Documents/com~apple~CloudDocs/政大大二下/股價分析/python/analyze_stock.py): yfinance 抓資料與分析演算法
