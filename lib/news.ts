import { Market, NewsItem } from "@/lib/types";

function decodeXmlEntities(input: string) {
  return input
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function matchTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decodeXmlEntities(match[1]) : null;
}

function buildNewsQuery(symbol: string, name: string, market: Market) {
  if (market === "TW") {
    return `${symbol} ${name} 股票`;
  }

  return `${symbol} ${name} stock`;
}

export async function fetchRecentNews(params: {
  symbol: string;
  name: string;
  market: Market;
}): Promise<NewsItem[]> {
  const query = buildNewsQuery(params.symbol, params.name, params.market);
  const locale = params.market === "TW" ? "zh-TW" : "en-US";
  const region = params.market === "TW" ? "TW" : "US";
  const ceid = params.market === "TW" ? "TW:zh-Hant" : "US:en";
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", locale);
  url.searchParams.set("gl", region);
  url.searchParams.set("ceid", ceid);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "investment-grid-system/1.0",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`Google News RSS 讀取失敗: ${response.status}`);
  }

  const xml = await response.text();
  const items = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi))
    .slice(0, 8)
    .map((match) => {
      const block = match[1];
      return {
        title: matchTag(block, "title") ?? "未命名新聞",
        link: matchTag(block, "link") ?? "",
        source: matchTag(block, "source"),
        published_at: matchTag(block, "pubDate"),
      } satisfies NewsItem;
    })
    .filter((item) => item.link);

  return items;
}
