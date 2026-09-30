import { ethers, Wallet, Contract, BaseContractMethod } from "ethers";

import { TokensData } from "contracts";
import {
  getCoingeckoHistoricalPrices,
  getCoingeckoTokenPrice,
  getCurrentSMA,
  getQuoteAndAmountOut,
} from "helpers/getQuote";
import { swapToken } from "helpers/swap";
import { createNewPosition } from "dbQueries/positions";
import { createDebug } from "../debug";

const debug = createDebug("Buy Strategy");

const decideToBuy = async (
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

export const buyUnderSMAStrategy = async (
  exactInputSingle: BaseContractMethod,
  quoteExactInputSingle: BaseContractMethod,
  wallet: Wallet,
  tokenData: TokensData,
  usdgContract: Contract,
  tokenContract: Contract,
  underSMAFactor: number,
) => {
  const usdgInAmount: bigint = 100000n;

  const { buy, price } = await decideToBuy(tokenData, underSMAFactor);

  if (!price || !buy) return;

  const amountOut = await getQuoteAndAmountOut(
    quoteExactInputSingle,
    usdgContract,
    tokenContract,
    usdgInAmount,
  );

  if (!amountOut) return;

  const tokenBalanceAfterTx = await swapToken(
    exactInputSingle,
    usdgContract,
    tokenContract,
    wallet,
    usdgInAmount,
    amountOut,
  );

  debug("tokenBalanceAfterTx: " + tokenBalanceAfterTx);

  const amountOutWithoutDecimals = parseFloat(
    ethers.formatUnits(amountOut, 18),
  );

  await createNewPosition(
    amountOutWithoutDecimals,
    tokenData.identifier,
    price,
  );

  return amountOutWithoutDecimals;
};
