import { StockDetailClient } from "@/components/stock-detail-client";

type StockPageProps = {
  params: Promise<{
    symbol: string;
  }>;
};

export default async function StockPage({ params }: StockPageProps) {
  const { symbol } = await params;

  return <StockDetailClient symbol={symbol.toUpperCase()} />;
}
