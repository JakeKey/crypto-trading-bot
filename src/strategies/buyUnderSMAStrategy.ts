import { TokensData } from "contracts";
import {
  getCoingeckoHistoricalPrices,
  getCoingeckoTokenPrice,
  getCurrentSMA,
} from "helpers/getQuote";

import { createDebug } from "../debug";

const debug = createDebug("Buy Strategy");

export const decideToBuy = async (
  tokenData: TokensData,
  underSMAFactor: number,
): Promise<{ buy: boolean; price: number | null }> => {
  debug(
    "CONSIDER NEW POSITION #################################################### " +
      tokenData.identifier,
  );

  const price = await getCoingeckoTokenPrice(tokenData.identifier);

  if (!price) return { buy: false, price: null };

  const historicalPrices = await getCoingeckoHistoricalPrices(
    tokenData.identifier,
  );

  const sma = getCurrentSMA(historicalPrices);

  return { buy: price < sma * underSMAFactor, price };
};
