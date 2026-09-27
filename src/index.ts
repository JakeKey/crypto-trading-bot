import { ethers } from "ethers";

import { DebugLevels } from "./types/enums";
import { ERC20_ABI } from "./abis";
import { CONFIG_CONSTS } from "./config";
import { createDebug } from "./debug";
import { TOKEN_ADDRESSES, USDG_ADDRESS } from "./contracts";
import {
  getCoingeckoHistoricalPrices,
  getCoingeckoTokenPrice,
  getCurrentSMA,
  getQuoteAndAmountOut,
} from "./helpers/getQuote";
import { swapToken } from "./helpers/swap";
import {
  closePosition,
  createNewPosition,
  getOpenPositions,
} from "./dbQueries/positions";

const { CTB_WALLET_ADDRESS, CTB_ALCHEMY_API_KEY, CTB_PRIVATE_KEY } =
  CONFIG_CONSTS;

const url = `https://robinhood-mainnet.g.alchemy.com/v2/${CTB_ALCHEMY_API_KEY}`;

// If no %%url%% is provided, it connects to the default
// http://localhost:8545, which most nodes use.

const debug = createDebug("Main");

const getTokenByIdentifier = (tokenIdentifier: string) => {
  return TOKEN_ADDRESSES.find((token) => token.identifier === tokenIdentifier);
};

const sleep = (seconds: number) => {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
};

const main = async () => {
  if (!CTB_WALLET_ADDRESS || !CTB_ALCHEMY_API_KEY || !CTB_PRIVATE_KEY) {
    throw new Error("Missing environmental variables!");
  }

  const provider = new ethers.JsonRpcProvider(url);

  const wallet = new ethers.Wallet(CTB_PRIVATE_KEY, provider);

  const usdgContract = new ethers.Contract(USDG_ADDRESS, ERC20_ABI, wallet);

  const openPositions = await getOpenPositions();

  // Iterate over open positions and sell if above profitSellThreshold
  for (let i = 0; i < openPositions.length; i++) {
    if (!openPositions.length) break;

    const profitSellThreshold = 1.1;

    const currentPosition = openPositions[i];

    debug(
      "OPEN POSITION ################################################### " +
        currentPosition.tokenIdentifier,
    );

    const tokenData = getTokenByIdentifier(currentPosition.tokenIdentifier);
    const price = await getCoingeckoTokenPrice(currentPosition.tokenIdentifier);

    if (!tokenData || !price) continue;

    const tokenContract = new ethers.Contract(
      tokenData.address,
      ERC20_ABI,
      wallet,
    );

    const amountOut = await getQuoteAndAmountOut(
      provider,
      tokenContract,
      usdgContract,
      ethers.parseUnits(currentPosition.amount.toString(), tokenData.decimals),
    );

    if (!amountOut) continue;

    const buyUsdgAmount = currentPosition.price * currentPosition.amount;

    const sellUsdgAmount = price * currentPosition.amount;

    debug(
      "PNL % ################################################### " +
        (buyUsdgAmount - sellUsdgAmount / sellUsdgAmount),
    );

    if (price > currentPosition.price * profitSellThreshold) {
      const usdgBalanceAfterTx = await swapToken(
        tokenContract,
        usdgContract,
        wallet,
        ethers.parseUnits(
          currentPosition.amount.toString(),
          tokenData.decimals,
        ),
        amountOut,
      );
      debug("usdgBalanceAfterTx: " + usdgBalanceAfterTx);

      await closePosition(currentPosition.id, buyUsdgAmount - sellUsdgAmount);
    }

    // TODO add stoploss
  }

  const tokensWithoutOpenPosition = TOKEN_ADDRESSES.filter(
    (token) =>
      !openPositions.some(
        (position) => position.tokenIdentifier === token.identifier,
      ),
  );

  if (!tokensWithoutOpenPosition.length) return;

  for (let i = 0; i < tokensWithoutOpenPosition.length; i++) {
    const usdgInAmount: bigint = 100000n;

    if (!tokensWithoutOpenPosition.length) break;

    const currentToken = tokensWithoutOpenPosition[i];

    debug(
      "NEW POSITION #################################################### " +
        currentToken.identifier,
    );

    const tokenData = getTokenByIdentifier(currentToken.identifier);

    if (!tokenData) continue;

    const tokenContract = new ethers.Contract(
      tokenData.address,
      ERC20_ABI,
      wallet,
    );

    const amountOut = await getQuoteAndAmountOut(
      provider,
      usdgContract,
      tokenContract,
      usdgInAmount,
    );

    if (!amountOut) return;

    const price = await getCoingeckoTokenPrice(currentToken.identifier);

    if (!price) continue;

    const historicalPrices = await getCoingeckoHistoricalPrices(
      tokenData.identifier,
    );

    const sma = getCurrentSMA(historicalPrices);

    const quoteVsSMADivergencePercent = ((price - sma) / sma) * 100;

    debug("quoteVsSMADivergencePercent: " + quoteVsSMADivergencePercent);

    if (quoteVsSMADivergencePercent < -10) {
      const tokenBalanceAfterTx = await swapToken(
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
        currentToken.identifier,
        price,
      );
    }
  }
};

try {
  main();
} catch (err) {
  debug(err as string, DebugLevels.ERROR);
}
