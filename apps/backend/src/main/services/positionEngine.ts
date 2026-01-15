import type { AssetClass, LedgerEntry, PortfolioId, Position } from "@mytrader/shared";

export interface PositionMetadata {
  id?: string | null;
  symbol: string;
  name: string | null;
  assetClass: AssetClass;
  market: string;
  currency: string;
}

export interface DerivedPositionsResult {
  positions: Position[];
  cashBalances: Record<string, number>;
}

interface PositionAccumulator {
  key: string;
  symbol: string;
  instrumentId: string | null;
  quantity: number;
  costValue: number;
  openDate: string | null;
  metadata: PositionMetadata;
}

export function derivePositionsFromLedger(input: {
  portfolioId: PortfolioId;
  entries: LedgerEntry[];
  metadataBySymbol: Map<string, PositionMetadata>;
  baseCurrency: string;
}): DerivedPositionsResult {
  const { portfolioId, entries, metadataBySymbol, baseCurrency } = input;
  const cashBalances: Record<string, number> = {};
  const accumulators = new Map<string, PositionAccumulator>();

  const sorted = [...entries].sort(compareLedgerEntries);
  for (const entry of sorted) {
    applyCash(entry, cashBalances);
    if (entry.eventType === "corporate_action") {
      applyCorporateAction(entry, accumulators);
      continue;
    }
    if (entry.eventType !== "trade" && entry.eventType !== "adjustment") {
      continue;
    }

    const key = entry.instrumentId ?? entry.symbol;
    if (!key) continue;
    const symbol = entry.symbol ?? entry.instrumentId ?? "UNKNOWN";
    const metadata = resolveMetadata(symbol, metadataBySymbol, baseCurrency);
    const acc =
      accumulators.get(key) ??
      createAccumulator(key, symbol, entry.instrumentId ?? null, metadata);
    accumulators.set(key, acc);

    const quantity = entry.quantity ?? 0;
    if (!entry.side || quantity <= 0) continue;
    const avgCost = acc.quantity > 0 ? acc.costValue / acc.quantity : 0;

    if (entry.eventType === "adjustment") {
      const mode = getAdjustmentMode(entry.meta);
      if (mode === "absolute") {
        const unitCost = entry.price ?? avgCost;
        acc.quantity = quantity;
        acc.costValue = unitCost * quantity;
        acc.openDate = pickEarlierDate(acc.openDate, entry.tradeDate);
        continue;
      }
    }

    if (entry.side === "buy") {
      const unitCost = entry.price ?? avgCost;
      const fee = entry.fee ?? 0;
      const tax = entry.tax ?? 0;
      acc.quantity += quantity;
      acc.costValue += unitCost * quantity + fee + tax;
      acc.openDate = pickEarlierDate(acc.openDate, entry.tradeDate);
      continue;
    }

    const reduce = Math.min(quantity, acc.quantity);
    acc.quantity -= reduce;
    acc.costValue -= avgCost * reduce;
    if (acc.quantity <= 0) {
      acc.quantity = 0;
      acc.costValue = 0;
    }
  }

  const now = Date.now();
  const positions = Array.from(accumulators.values())
    .filter((acc) => acc.quantity > 0)
    .map((acc) => ({
      id: acc.metadata.id ?? `ledger:${portfolioId}:${acc.key}`,
      portfolioId,
      symbol: acc.symbol,
      name: acc.metadata.name,
      assetClass: acc.metadata.assetClass,
      market: acc.metadata.market,
      currency: acc.metadata.currency,
      quantity: acc.quantity,
      cost: acc.quantity > 0 ? acc.costValue / acc.quantity : null,
      openDate: acc.openDate,
      createdAt: now,
      updatedAt: now
    }));

  const cashPositions = buildCashPositions(
    portfolioId,
    cashBalances,
    metadataBySymbol,
    now
  );
  positions.push(...cashPositions);
  positions.sort((a, b) => a.symbol.localeCompare(b.symbol));

  return { positions, cashBalances };
}

function applyCash(entry: LedgerEntry, balances: Record<string, number>): void {
  if (!entry.cashCurrency || entry.cashAmount === null) return;
  balances[entry.cashCurrency] =
    (balances[entry.cashCurrency] ?? 0) + entry.cashAmount;
}

function applyCorporateAction(
  entry: LedgerEntry,
  accumulators: Map<string, PositionAccumulator>
): void {
  const ratio = getCorporateActionRatio(entry.meta);
  if (!ratio) return;
  const key = entry.instrumentId ?? entry.symbol;
  if (!key) return;
  let acc = accumulators.get(key) ?? null;
  if (!acc && entry.symbol) {
    acc =
      Array.from(accumulators.values()).find(
        (item) => item.symbol === entry.symbol
      ) ?? null;
  }
  if (!acc || acc.quantity <= 0) return;
  acc.quantity = acc.quantity * ratio;
  if (!Number.isFinite(acc.quantity) || acc.quantity <= 0) {
    acc.quantity = 0;
    acc.costValue = 0;
  }
  accumulators.set(acc.key, acc);
}

function getCorporateActionRatio(meta: LedgerEntry["meta"]): number | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const data = meta as Record<string, unknown>;
  const kind = data.kind;
  if (kind !== "split" && kind !== "reverse_split") return null;
  const numerator = Number(data.numerator);
  const denominator = Number(data.denominator);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (numerator <= 0 || denominator <= 0) return null;
  return numerator / denominator;
}

function resolveMetadata(
  symbol: string,
  metadataBySymbol: Map<string, PositionMetadata>,
  baseCurrency: string
): PositionMetadata {
  const meta = metadataBySymbol.get(symbol);
  return {
    id: meta?.id ?? null,
    symbol,
    name: meta?.name ?? (symbol === "UNKNOWN" ? null : symbol),
    assetClass: meta?.assetClass ?? "stock",
    market: meta?.market ?? "CN",
    currency: meta?.currency ?? baseCurrency
  };
}

function createAccumulator(
  key: string,
  symbol: string,
  instrumentId: string | null,
  metadata: PositionMetadata
): PositionAccumulator {
  return {
    key,
    symbol,
    instrumentId,
    quantity: 0,
    costValue: 0,
    openDate: null,
    metadata
  };
}

function buildCashPositions(
  portfolioId: PortfolioId,
  balances: Record<string, number>,
  metadataBySymbol: Map<string, PositionMetadata>,
  now: number
): Position[] {
  const positions: Position[] = [];
  Object.entries(balances).forEach(([currency, amount]) => {
    if (!Number.isFinite(amount) || amount === 0) return;
    const existing = metadataBySymbol.get(currency);
    if (existing && existing.assetClass === "cash") {
      positions.push({
        id: existing.id ?? `ledger:${portfolioId}:cash:${currency}`,
        portfolioId,
        symbol: existing.symbol,
        name: existing.name,
        assetClass: "cash",
        market: existing.market,
        currency: existing.currency,
        quantity: amount,
        cost: null,
        openDate: null,
        createdAt: now,
        updatedAt: now
      });
      return;
    }
    const symbol = `CASH:${currency}`;
    positions.push({
      id: `ledger:${portfolioId}:cash:${currency}`,
      portfolioId,
      symbol,
      name: `${currency} Cash`,
      assetClass: "cash",
      market: "CASH",
      currency,
      quantity: amount,
      cost: null,
      openDate: null,
      createdAt: now,
      updatedAt: now
    });
  });
  return positions;
}

function getAdjustmentMode(meta: LedgerEntry["meta"]): "absolute" | "delta" {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return "delta";
  const data = meta as Record<string, unknown>;
  const raw = data.adjustment_mode;
  if (raw === "absolute" || raw === "delta") return raw;
  if (data.baseline === true) return "absolute";
  return "delta";
}

function compareLedgerEntries(a: LedgerEntry, b: LedgerEntry): number {
  const aKey = entrySortKey(a);
  const bKey = entrySortKey(b);
  if (aKey !== bKey) return aKey - bKey;
  const aSeq = a.sequence ?? 0;
  const bSeq = b.sequence ?? 0;
  if (aSeq !== bSeq) return aSeq - bSeq;
  return a.createdAt - b.createdAt;
}

function entrySortKey(entry: LedgerEntry): number {
  if (entry.eventTs && entry.eventTs > 0) return entry.eventTs;
  return Date.parse(`${entry.tradeDate}T00:00:00Z`);
}

function pickEarlierDate(
  current: string | null,
  next: string
): string | null {
  if (!current) return next;
  return next < current ? next : current;
}
