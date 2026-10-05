import { TokensData } from "contracts";
import { getCoingeckoTokenPrice } from "helpers/getQuote";
import { createDebug } from "../debug";

const debug = createDebug("Sell Strategy");

export const decideToSell = async (
  tokenData: TokensData,
  profitFactor: number,
  buyPrice: number,
): Promise<{ sell: boolean; price: number | null }> => {
  debug(
    "CONSIDER CLOSE POSITION #################################################### " +
      tokenData.identifier,
  );

  const price = await getCoingeckoTokenPrice(tokenData.identifier);

  if (!price) return { sell: false, price: null };

  return { sell: price > buyPrice * profitFactor, price };
};
