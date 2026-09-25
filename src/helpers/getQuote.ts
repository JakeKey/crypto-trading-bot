import { Contract, ContractRunner } from "ethers";

import { DebugLevels } from "../types/enums";
import { QUOTER_V2_ABI } from "../abis";
import { CONFIG_CONSTS } from "../config";
import { createDebug } from "../debug";
import { USDG_ADDRESS } from "../contracts";

const { CTB_ALCHEMY_API_KEY, CTB_COINGECKO_API_KEY, QUOTER_V2 } = CONFIG_CONSTS;

const debug = createDebug("getQuote");

export const getQuote = async (
  provider: ContractRunner,
  address: string,
  usdgInAmount: bigint,
  fee = 10000,
): Promise<bigint | undefined> => {
  try {
    const quoter = new Contract(QUOTER_V2, QUOTER_V2_ABI, provider);

    const params = {
      tokenIn: USDG_ADDRESS,
      tokenOut: address,
      amountIn: usdgInAmount,
      fee,
      sqrtPriceLimitX96: 0,
    };

    const result = await quoter.quoteExactInputSingle.staticCall(params);

    return result[0];
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

  return averagesSum / prices.length;
};

export const getCoingeckoHistoricalPrices = async (
  //   provider: ContractRunner,
  identifier: string,
): Promise<PriceOC[]> => {
  try {
    if (!CTB_COINGECKO_API_KEY) return [];

    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${identifier}/ohlc?vs_currency=usd&days=14`,
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
    console.error("Error:", error);

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
