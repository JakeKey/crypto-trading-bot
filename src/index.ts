import { ethers, Contract } from "ethers";

import { DebugLevels } from "./types/enums";
import { ERC20_ABI } from "./abis";
import { CONFIG_CONSTS } from "./config";
import { createDebug } from "./debug";
import { TOKEN_ADDRESSES, USDG_ADDRESS } from "./contracts";
import {
  getCoingeckoHistoricalPrices,
  getCurrentSMA,
  getQuote,
} from "./helpers/getQuote";
import { buyToken } from "./helpers/swap";

const { CTB_WALLET_ADDRESS, CTB_ALCHEMY_API_KEY, CTB_PRIVATE_KEY } =
  CONFIG_CONSTS;

const url = `https://robinhood-mainnet.g.alchemy.com/v2/${CTB_ALCHEMY_API_KEY}`;

// If no %%url%% is provided, it connects to the default
// http://localhost:8545, which most nodes use.

const debug = createDebug("Main");

const checkWalletBalance = async (
  tokenIn: Contract,
  decimals: number,
): Promise<bigint> => {
  const tokenBalance = await tokenIn.balanceOf(CTB_WALLET_ADDRESS);

  const tokenBalanceNoDecimals = parseFloat(
    ethers.formatUnits(tokenBalance, USDG_DECIMALS),
  );

  debug("tokenBalance: " + tokenBalance);
  debug("tokenBalanceNoDecimals: " + tokenBalanceNoDecimals);

  return tokenBalance;
};

const USDG_DECIMALS = 6;

const main = async () => {
  if (!CTB_WALLET_ADDRESS || !CTB_ALCHEMY_API_KEY || !CTB_PRIVATE_KEY) {
    throw new Error("Missing environmental variables!");
  }
  const token = TOKEN_ADDRESSES[1];

  const provider = new ethers.JsonRpcProvider(url);

  const wallet = new ethers.Wallet(CTB_PRIVATE_KEY, provider);

  const tokenContract = new ethers.Contract(token.address, ERC20_ABI, wallet);
  const usdgContract = new ethers.Contract(USDG_ADDRESS, ERC20_ABI, wallet);

  // 0. check tokens balances

  const tokenBalance = await checkWalletBalance(tokenContract, token.decimals);
  const usdgBalance = await checkWalletBalance(usdgContract, token.decimals);

  // 1. Check tokens prices

  // 0.1 usdg
  const usdgInAmount: bigint = 100000n;

  const amountOut = await getQuote(provider, token.address, usdgInAmount);

  if (!amountOut) return;

  const amountOutWithoutDecimals = parseFloat(
    ethers.formatUnits(amountOut, token.decimals),
  );

  const usdgWithoutDecimals = parseFloat(
    ethers.formatUnits(usdgInAmount, USDG_DECIMALS),
  );

  const quote = usdgWithoutDecimals / amountOutWithoutDecimals;

  const prices = await getCoingeckoHistoricalPrices(token.identifier);

  const sma = getCurrentSMA(prices);

  debug("quote: " + quote);
  debug("sma: " + sma);

  const quoteVsSMADivergencePercent = ((quote - sma) / sma) * 100;

  debug("quoteVsSMADivergencePercent: " + quoteVsSMADivergencePercent);

  // 2. Buy tokens if 10% under SMA and tokenBalance < 0.0001

  if (quoteVsSMADivergencePercent < -10 && tokenBalance < 0.0001) {
    const tokenBalanceAfterTx = await buyToken(
      usdgContract,
      tokenContract,
      wallet,
      usdgInAmount,
      amountOut,
    );
    debug("tokenBalanceAfterTx: " + tokenBalanceAfterTx);
  }
};

try {
  main();
} catch (err) {
  debug(err as string, DebugLevels.ERROR);
}
