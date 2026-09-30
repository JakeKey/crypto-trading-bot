import { Contract } from "ethers";

import { DebugLevels } from "types/enums";
import { CONFIG_CONSTS } from "config";
import { BaseContractMethod } from "ethers";
import { createDebug } from "../debug";

const { CTB_ALCHEMY_API_KEY, CTB_COINGECKO_API_KEY } = CONFIG_CONSTS;

const debug = createDebug("getQuote");

export const getQuoteAndAmountOut = async (
  quoteExactInputSingle: BaseContractMethod,
  tokenIn: Contract,
  tokenOut: Contract,
  amountIn: bigint,
  fee = 10000,
): Promise<bigint | undefined> => {
  try {
    const tokenInAddress = await tokenIn.getAddress();
    const tokenOutAddress = await tokenOut.getAddress();

    debug("tokenOutAddress: " + JSON.stringify(tokenOutAddress));

    const params = {
      tokenIn: tokenInAddress,
      tokenOut: tokenOutAddress,
      amountIn,
      fee,
      sqrtPriceLimitX96: 0n,
    };

    const quote = await quoteExactInputSingle.staticCall(params);

    if (!quote.length) return 0n;

    const amountOut = quote[0];

    debug("amountOut: " + amountOut);

    return amountOut;
  } catch (err) {
    debug(err as string, DebugLevels.ERROR);
    return undefined;
  }
};

interface PriceOC {
  open: number;
  close: number;
}

export const getCurrentSMA = (prices: PriceOC[]): number => {
  if (!prices.length) return 0;

  const averageOCPrices = prices.map(({ open, close }) =>
    Math.abs((open + close) / 2),
  );

  const averagesSum = averageOCPrices.reduce((pVal, cVal) => pVal + cVal, 0);

  const sma = averagesSum / prices.length;
  debug("sma: " + sma);

  return sma;
};

export const getCoingeckoAPIPriceUrl = (identifier: string) =>
  `https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&ids=${identifier}`;

export const getCoingeckoTokenPrice = async (
  identifier: string,
): Promise<number | undefined> => {
  try {
    if (!CTB_COINGECKO_API_KEY) return;

    const response = await fetch(getCoingeckoAPIPriceUrl(identifier), {
      method: "GET",
      headers: {
        "x-cg-demo-api-key": CTB_COINGECKO_API_KEY,
      },
    });
    const tokenPrice: number = (await response.json())[identifier].usd;
    debug("tokenPrice: " + JSON.stringify(tokenPrice));

    return tokenPrice;
  } catch (error) {
    debug("Error: " + error, DebugLevels.ERROR);
  }
};

export const getCoingeckoAPIHistoricalPricesUrl = (identifier: string) =>
  `https://api.coingecko.com/api/v3/coins/${identifier}/ohlc?vs_currency=usd&days=14`;

export const getCoingeckoHistoricalPrices = async (
  identifier: string,
): Promise<PriceOC[]> => {
  try {
    if (!CTB_COINGECKO_API_KEY) return [];

    const response = await fetch(
      getCoingeckoAPIHistoricalPricesUrl(identifier),
      //   `https://api.coingecko.com/api/v3/coins/robinhood/contract/${address}/ohlc?vs_currency=usd&days=30`,
      {
        method: "GET",
        headers: {
          "x-cg-demo-api-key": CTB_COINGECKO_API_KEY,
        },
      },
    );
    const tokenPrices: number[][] = await response.json();

    const pricesOC = tokenPrices.map((price) => ({
      open: price[1],
      close: price[4],
    }));

    return pricesOC;
  } catch (error) {
    debug("Error: " + error, DebugLevels.ERROR);

    return [];
  }
};

// PRICES API FOR robinhood-mainnet NOT SUPPORTED YET
export const getAlchemyHistoricalTokenPricesByAddress = async (
  address: string,
) => {
  try {
    const response = await fetch(
      `https://api.g.alchemy.com/prices/v1/tokens/historical`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CTB_ALCHEMY_API_KEY}`,
        },
        body: JSON.stringify({
          address,
          network: "robinhood-mainnet",
          startTime: "2026-09-01T00:00:00Z",
          endTime: "2026-09-21T23:59:59Z",
          interval: "1d",
          withMarketData: true,
        }),
      },
    );

    const data = await response.json();
    console.log("Token Prices By Address:");
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
};
