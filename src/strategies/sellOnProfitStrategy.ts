import { ethers, Wallet, Contract, BaseContractMethod } from "ethers";

import { TokensData, USDG_DECIMALS } from "contracts";
import { getCoingeckoTokenPrice, getQuoteAndAmountOut } from "helpers/getQuote";
import { swapToken } from "helpers/swap";
import { closePosition } from "dbQueries/positions";
import { createDebug } from "../debug";

const debug = createDebug("Sell Strategy");

const decideToSell = async (
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

export const sellOnProfitStrategy = async (
  exactInputSingle: BaseContractMethod,
  quoteExactInputSingle: BaseContractMethod,
  wallet: Wallet,
  tokenData: TokensData,
  usdgContract: Contract,
  tokenContract: Contract,
  position: { id: number; price: number; amount: number },
  profitFactor: number,
) => {
  const usdgInAmount: bigint = 100000n;

  const { sell, price } = await decideToSell(
    tokenData,
    profitFactor,
    position.price,
  );

  if (!price || !sell) return;

  const amountOut = await getQuoteAndAmountOut(
    quoteExactInputSingle,
    tokenContract,
    usdgContract,
    usdgInAmount,
  );

  if (!amountOut) return;

  const tokenBalanceAfterTx = await swapToken(
    exactInputSingle,
    tokenContract,
    usdgContract,
    wallet,
    ethers.parseUnits(position.amount.toString(), tokenData.decimals),
    amountOut,
  );

  debug("tokenBalanceAfterTx: " + tokenBalanceAfterTx);

  const amountOutWithoutDecimals = parseFloat(
    ethers.formatUnits(amountOut, USDG_DECIMALS),
  );

  const buyUSDGAmount = position.price * position.amount;

  await closePosition(position.id, amountOutWithoutDecimals - buyUSDGAmount);

  return amountOutWithoutDecimals;
};
