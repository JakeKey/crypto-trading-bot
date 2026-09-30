import { ethers } from "ethers";

import { buyUnderSMAStrategy } from "strategies/buyUnderSMAStrategy";
import { sellOnProfitStrategy } from "strategies/sellOnProfitStrategy";
import { DebugLevels } from "./types/enums";
import { ERC20_ABI, QUOTER_V2_ABI, SWAP_ROUTER_02_ABI } from "./abis";
import { CONFIG_CONSTS } from "./config";
import { createDebug } from "./debug";
import { TOKEN_ADDRESSES, USDG_ADDRESS } from "./contracts";
import { getOpenPositions } from "./dbQueries/positions";

const {
  CTB_WALLET_ADDRESS,
  CTB_ALCHEMY_API_KEY,
  CTB_PRIVATE_KEY,
  QUOTER_V2,
  SWAP_ROUTER_02,
} = CONFIG_CONSTS;

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

  const provider = new ethers.JsonRpcProvider(url);
  const wallet = new ethers.Wallet(CTB_PRIVATE_KEY, provider);
  const usdgContract = new ethers.Contract(USDG_ADDRESS, ERC20_ABI, wallet);
  const quoter = new ethers.Contract(QUOTER_V2, QUOTER_V2_ABI, provider);
  const router = new ethers.Contract(
    SWAP_ROUTER_02,
    SWAP_ROUTER_02_ABI,
    wallet,
  );

  const openPositions = await getOpenPositions();

  // Iterate over open positions and sell if above PROFIT_FACTOR
  for (let i = 0; i < openPositions.length; i++) {
    if (!openPositions.length) break;

    const currentPosition = openPositions[i];

    const tokenData = getTokenByIdentifier(currentPosition.tokenIdentifier);

    if (!tokenData) continue;

    const tokenContract = new ethers.Contract(
      tokenData.address,
      ERC20_ABI,
      wallet,
    );

    const PROFIT_FACTOR = 1.1;

    await sellOnProfitStrategy(
      router.exactInputSingle,
      quoter.quoteExactInputSingle,
      wallet,
      tokenData,
      usdgContract,
      tokenContract,
      currentPosition,
      PROFIT_FACTOR,
    );

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

    const tokenContract = new ethers.Contract(
      tokenData.address,
      ERC20_ABI,
      wallet,
    );

    const UNDER_SMA_FACTOR = 0.9;

    await buyUnderSMAStrategy(
      router.exactInputSingle,
      quoter.quoteExactInputSingle,
      wallet,
      tokenData,
      usdgContract,
      tokenContract,
      UNDER_SMA_FACTOR,
    );
  }
};

try {
  main();
} catch (err) {
  debug(err as string, DebugLevels.ERROR);
}
