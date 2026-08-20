import type { Currency } from '@mcp-pg/types';

export type RoutingPath = 'direct_bank' | 'kaiserx' | 'dex_aggregator' | 'cross_chain';

export interface RouteQuote {
  path: RoutingPath;
  fromCurrency: Currency;
  toCurrency: Currency;
  inputAmount: bigint;
  outputAmount: bigint;
  estimatedTimeSeconds: number;
  estimatedFee: number;
  feePercentage: number;
}

export interface AutoRouterConfig {
  bankApiUrl?: string;
  bankApiKey?: string;
  kaiserxApiUrl?: string;
  kaiserxApiKey?: string;
  dexAggregatorUrl?: string;
}

const GERO_USD_RATE = 0.05;
const BTC_USD_RATE = 65000;

export class AutoRouter {
  constructor(private _config: AutoRouterConfig = {}) {}

  getConfig(): AutoRouterConfig {
    return this._config;
  }

  async findBestRoute(
    fromCurrency: Currency,
    toCurrency: Currency,
    amount: bigint
  ): Promise<RouteQuote | null> {
    if (fromCurrency === toCurrency) {
      return this.createDirectRoute(fromCurrency, toCurrency, amount);
    }

    const routes: RouteQuote[] = [];

    if (fromCurrency === 'USD' && (toCurrency === 'GERO' || toCurrency === 'BTC')) {
      const bankRoute = await this.checkBankPath(fromCurrency, toCurrency, amount);
      if (bankRoute) routes.push(bankRoute);

      const kaiserxRoute = await this.checkKaiserxPath(fromCurrency, toCurrency, amount);
      if (kaiserxRoute) routes.push(kaiserxRoute);
    }

    if ((fromCurrency === 'GERO' && toCurrency === 'BTC') || (fromCurrency === 'BTC' && toCurrency === 'GERO')) {
      const dexRoute = await this.checkDexPath(fromCurrency, toCurrency, amount);
      if (dexRoute) routes.push(dexRoute);
    }

    if (routes.length === 0) {
      return null;
    }

    return this.selectBestRoute(routes);
  }

  private createDirectRoute(from: Currency, to: Currency, amount: bigint): RouteQuote {
    return {
      path: 'direct_bank',
      fromCurrency: from,
      toCurrency: to,
      inputAmount: amount,
      outputAmount: amount,
      estimatedTimeSeconds: 0,
      estimatedFee: 0,
      feePercentage: 0,
    };
  }

  private async checkBankPath(
    fromCurrency: Currency,
    toCurrency: Currency,
    amount: bigint
  ): Promise<RouteQuote | null> {
    const rate = toCurrency === 'GERO' ? GERO_USD_RATE : BTC_USD_RATE;
    const usdAmount = fromCurrency === 'USD' ? Number(amount) : Number(amount) * 1.1;
    const cryptoAmount = BigInt(Math.floor(usdAmount / rate * (toCurrency === 'GERO' ? 1000000 : 100000000)));

    return {
      path: 'direct_bank',
      fromCurrency,
      toCurrency,
      inputAmount: amount,
      outputAmount: cryptoAmount,
      estimatedTimeSeconds: 60,
      estimatedFee: Math.floor(usdAmount * 0.005),
      feePercentage: 0.5,
    };
  }

  private async checkKaiserxPath(
    fromCurrency: Currency,
    toCurrency: Currency,
    amount: bigint
  ): Promise<RouteQuote | null> {
    const rate = toCurrency === 'GERO' ? GERO_USD_RATE * 0.98 : BTC_USD_RATE * 0.995;
    const usdAmount = fromCurrency === 'USD' ? Number(amount) : Number(amount) * 1.1;
    const cryptoAmount = BigInt(Math.floor(usdAmount / rate * (toCurrency === 'GERO' ? 1000000 : 100000000)));

    return {
      path: 'kaiserx',
      fromCurrency,
      toCurrency,
      inputAmount: amount,
      outputAmount: cryptoAmount,
      estimatedTimeSeconds: 30,
      estimatedFee: Math.floor(usdAmount * 0.003),
      feePercentage: 0.3,
    };
  }

  private async checkDexPath(
    fromCurrency: Currency,
    toCurrency: Currency,
    amount: bigint
  ): Promise<RouteQuote | null> {
    const fromRate = fromCurrency === 'GERO' ? GERO_USD_RATE : BTC_USD_RATE;
    const toRate = toCurrency === 'GERO' ? GERO_USD_RATE : BTC_USD_RATE;
    const usdValue = Number(amount) * fromRate;
    const outputAmount = BigInt(Math.floor(usdValue / toRate * (toCurrency === 'GERO' ? 1000000 : 100000000)));

    return {
      path: 'dex_aggregator',
      fromCurrency,
      toCurrency,
      inputAmount: amount,
      outputAmount,
      estimatedTimeSeconds: 120,
      estimatedFee: Math.floor(usdValue * 0.008),
      feePercentage: 0.8,
    };
  }

  private selectBestRoute(routes: RouteQuote[]): RouteQuote {
    return routes.reduce((best, current) => {
      const bestScore = this.calculateRouteScore(best);
      const currentScore = this.calculateRouteScore(current);
      return currentScore > bestScore ? current : best;
    });
  }

  private calculateRouteScore(route: RouteQuote): number {
    const timeWeight = 0.3;
    const feeWeight = 0.5;
    const outputWeight = 0.2;

    const maxTime = 300;
    const maxFee = 10;

    const timeScore = (1 - route.estimatedTimeSeconds / maxTime) * timeWeight;
    const feeScore = (1 - route.feePercentage / maxFee) * feeWeight;
    const outputScore = outputWeight;

    return timeScore + feeScore + outputScore;
  }

  async convertCurrency(
    fromCurrency: Currency,
    toCurrency: Currency,
    amount: bigint
  ): Promise<{ success: boolean; outputAmount?: bigint; route?: RouteQuote; error?: string }> {
    const route = await this.findBestRoute(fromCurrency, toCurrency, amount);

    if (!route) {
      return {
        success: false,
        error: `No route found for ${fromCurrency} to ${toCurrency}`,
      };
    }

    if (process.env.MOCK_MODE === 'true') {
      return {
        success: true,
        outputAmount: route.outputAmount,
        route,
      };
    }

    return {
      success: true,
      outputAmount: route.outputAmount,
      route,
    };
  }
}

export function createAutoRouter(config?: AutoRouterConfig): AutoRouter {
  return new AutoRouter(config);
}
