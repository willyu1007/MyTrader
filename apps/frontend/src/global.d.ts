import type { MyTraderApi } from "@mytrader/shared";

declare global {
  interface Window {
    mytrader?: MyTraderApi;
  }
}

export {};
