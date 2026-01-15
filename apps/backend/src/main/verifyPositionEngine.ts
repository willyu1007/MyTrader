import type { LedgerEntry, PortfolioId } from "@mytrader/shared";

import {
  derivePositionsFromLedger,
  type PositionMetadata
} from "./services/positionEngine";

function xorshift32(seed: number): () => number {
  let x = seed | 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0xffffffff;
  };
}

function shuffleInPlace<T>(items: T[], nextRandom: () => number): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(nextRandom() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function fingerprint(result: ReturnType<typeof derivePositionsFromLedger>): string {
  const cashBalances = Object.entries(result.cashBalances)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => [currency, round(amount)]);

  const positions = [...result.positions]
    .sort((a, b) => a.symbol.localeCompare(b.symbol))
    .map((pos) => ({
      symbol: pos.symbol,
      assetClass: pos.assetClass,
      currency: pos.currency,
      quantity: round(pos.quantity),
      cost: pos.cost === null ? null : round(pos.cost)
    }));

  return JSON.stringify({ cashBalances, positions });
}

function round(value: number): number {
  return Math.round(value * 1e12) / 1e12;
}

function createEntry(
  partial: Partial<LedgerEntry> & Pick<LedgerEntry, "eventType" | "tradeDate">
): LedgerEntry {
  const now = 1_700_000_000_000;
  return {
    id: partial.id ?? "E:missing",
    portfolioId: partial.portfolioId ?? "P:missing",
    accountKey: partial.accountKey ?? null,
    eventType: partial.eventType,
    tradeDate: partial.tradeDate,
    eventTs: partial.eventTs ?? null,
    sequence: partial.sequence ?? null,
    instrumentId: partial.instrumentId ?? null,
    symbol: partial.symbol ?? null,
    side: partial.side ?? null,
    quantity: partial.quantity ?? null,
    price: partial.price ?? null,
    priceCurrency: partial.priceCurrency ?? null,
    cashAmount: partial.cashAmount ?? null,
    cashCurrency: partial.cashCurrency ?? null,
    fee: partial.fee ?? null,
    tax: partial.tax ?? null,
    note: partial.note ?? null,
    source: partial.source ?? "manual",
    externalId: partial.externalId ?? null,
    meta: partial.meta ?? null,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    deletedAt: partial.deletedAt ?? null
  };
}

function buildFixture(portfolioId: PortfolioId): {
  entries: LedgerEntry[];
  metadataBySymbol: Map<string, PositionMetadata>;
  baseCurrency: string;
} {
  const baseCurrency = "CNY";
  const metadataBySymbol = new Map<string, PositionMetadata>([
    [
      "600519.SH",
      {
        id: null,
        symbol: "600519.SH",
        name: "贵州茅台",
        assetClass: "stock",
        market: "CN",
        currency: "CNY"
      }
    ]
  ]);

  const entries: LedgerEntry[] = [
    createEntry({
      id: "E1",
      portfolioId,
      eventType: "cash",
      tradeDate: "2026-01-01",
      eventTs: Date.parse("2026-01-01T08:00:00Z"),
      cashAmount: 20000,
      cashCurrency: "CNY",
      createdAt: 1000
    }),
    createEntry({
      id: "E2",
      portfolioId,
      eventType: "cash",
      tradeDate: "2026-01-01",
      eventTs: Date.parse("2026-01-01T08:00:10Z"),
      cashAmount: 100,
      cashCurrency: "USD",
      createdAt: 1001
    }),
    createEntry({
      id: "E3",
      portfolioId,
      eventType: "adjustment",
      tradeDate: "2026-01-01",
      eventTs: Date.parse("2026-01-01T09:00:00Z"),
      symbol: "600519.SH",
      side: "buy",
      quantity: 10,
      price: 1000,
      priceCurrency: "CNY",
      meta: { baseline: true, adjustment_mode: "absolute" },
      createdAt: 1002
    }),
    createEntry({
      id: "E4",
      portfolioId,
      eventType: "trade",
      tradeDate: "2026-01-02",
      // no eventTs -> fallback to tradeDate
      sequence: 0,
      symbol: "600519.SH",
      side: "buy",
      quantity: 5,
      price: 1100,
      priceCurrency: "CNY",
      fee: 10,
      tax: 0,
      cashAmount: -5510,
      cashCurrency: "CNY",
      createdAt: 1003
    }),
    createEntry({
      id: "E5",
      portfolioId,
      eventType: "trade",
      tradeDate: "2026-01-05",
      eventTs: Date.parse("2026-01-05T10:00:00Z"),
      sequence: 0,
      symbol: "600519.SH",
      side: "sell",
      quantity: 3,
      price: 1200,
      priceCurrency: "CNY",
      fee: 5,
      tax: 3,
      cashAmount: 3592,
      cashCurrency: "CNY",
      createdAt: 1004
    }),
    createEntry({
      id: "E6",
      portfolioId,
      eventType: "fee",
      tradeDate: "2026-01-06",
      cashAmount: -20,
      cashCurrency: "CNY",
      createdAt: 1005
    }),
    createEntry({
      id: "E7",
      portfolioId,
      eventType: "dividend",
      tradeDate: "2026-01-07",
      symbol: "600519.SH",
      cashAmount: 100,
      cashCurrency: "CNY",
      createdAt: 1006
    }),
    createEntry({
      id: "E8",
      portfolioId,
      eventType: "fee",
      tradeDate: "2026-01-08",
      cashAmount: -2,
      cashCurrency: "USD",
      createdAt: 1007
    })
  ];

  return { entries, metadataBySymbol, baseCurrency };
}

function verifyReplayDeterminism(): void {
  const portfolioId = "P:verify" as PortfolioId;
  const { entries, metadataBySymbol, baseCurrency } = buildFixture(portfolioId);

  const baseline = derivePositionsFromLedger({
    portfolioId,
    entries,
    metadataBySymbol,
    baseCurrency
  });
  const expected = fingerprint(baseline);

  for (let i = 0; i < 100; i += 1) {
    const rng = xorshift32(0x9e3779b9 ^ i);
    const shuffled = [...entries];
    shuffleInPlace(shuffled, rng);

    const result = derivePositionsFromLedger({
      portfolioId,
      entries: shuffled,
      metadataBySymbol,
      baseCurrency
    });
    const actual = fingerprint(result);
    if (actual !== expected) {
      console.error("[verify-position-engine] mismatch at run", i);
      console.error("expected:", expected);
      console.error("actual  :", actual);
      process.exitCode = 1;
      return;
    }
  }

  console.log("[verify-position-engine] ok (100 runs)");
  console.log("[verify-position-engine] fingerprint:", expected);
}

verifyReplayDeterminism();

