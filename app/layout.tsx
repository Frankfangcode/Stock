import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "投資十二宮格系統",
  description: "使用 Next.js + Python yfinance 建立的投資十二宮格分析儀表板",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
