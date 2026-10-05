import { ethers } from "ethers";

import { DebugLevels } from "./types/enums";
import { CONFIG_CONSTS } from "./config";
import { createDebug } from "./debug";
import { TOKEN_ADDRESSES, USDG_DECIMALS } from "./contracts";
import { getPositionByStatus } from "./dbQueries/positions";
import { Strategy } from "strategies";

const { CTB_WALLET_ADDRESS, CTB_ALCHEMY_API_KEY, CTB_PRIVATE_KEY } =
  CONFIG_CONSTS;

const url = `https://robinhood-mainnet.g.alchemy.com/v2/${CTB_ALCHEMY_API_KEY}`;

// If no %%url%% is provided, it connects to the default
// http://localhost:8545, which most nodes use.

const debug = createDebug("Main");

const getTokenByIdentifier = (tokenIdentifier: string) => {
  return TOKEN_ADDRESSES.find((token) => token.identifier === tokenIdentifier);
};

const main = async () => {
  if (!CTB_WALLET_ADDRESS || !CTB_ALCHEMY_API_KEY || !CTB_PRIVATE_KEY) {
    throw new Error("Missing environmental variables!");
  }

  // TODO change hardcoded value
  const USDG_BUY_AMOUNT = ethers.parseUnits((0.1).toString(), USDG_DECIMALS);

  const openPositions = await getPositionByStatus("open");

  // Iterate over open positions and sell if above PROFIT_FACTOR
  for (let i = 0; i < openPositions.length; i++) {
    if (!openPositions.length) break;

    const currentPosition = openPositions[i];

    const tokenData = getTokenByIdentifier(currentPosition.tokenIdentifier);

    if (!tokenData) continue;

    const PROFIT_FACTOR = 1.1;

    const strategy = new Strategy(url, tokenData);

    await strategy.sellOnProfit(currentPosition, PROFIT_FACTOR);

    // TODO add stoploss
  }

  const tokensWithoutOpenPosition = TOKEN_ADDRESSES.filter(
    (token) =>
      !openPositions.some(
        (position) => position.tokenIdentifier === token.identifier,
      ),
  );

  if (!tokensWithoutOpenPosition.length) return;

  // Iterate over whitelisted coins and buy if under UNDER_SMA_FACTOR
  for (let i = 0; i < tokensWithoutOpenPosition.length; i++) {
    if (!tokensWithoutOpenPosition.length) break;

    const currentToken = tokensWithoutOpenPosition[i];

    const tokenData = getTokenByIdentifier(currentToken.identifier);

    if (!tokenData) continue;

    const UNDER_SMA_FACTOR = 0.9;

    const strategy = new Strategy(url, tokenData);

    await strategy.buyUnderSMA(tokenData, UNDER_SMA_FACTOR, USDG_BUY_AMOUNT);
  }
};

try {
  main();
} catch (err) {
  debug(err as string, DebugLevels.ERROR);
}
