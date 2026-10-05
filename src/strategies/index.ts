import { ethers } from "ethers";

import { TokensData, USDG_ADDRESS, USDG_DECIMALS } from "contracts";
import { getQuoteAndAmountOut } from "helpers/getQuote";
import { swapToken } from "helpers/swap";
import { closePosition, createNewPosition } from "dbQueries/positions";
import { CONFIG_CONSTS } from "config";
import { ERC20_ABI, QUOTER_V2_ABI, SWAP_ROUTER_02_ABI } from "abis";

import { decideToSell } from "./sellOnProfitStrategy";
import { decideToBuy } from "./buyUnderSMAStrategy";
import { createDebug } from "../debug";

const debug = createDebug("Strategy");

const { CTB_PRIVATE_KEY, QUOTER_V2, SWAP_ROUTER_02 } = CONFIG_CONSTS;

interface Position {
  id: number;
  price: number;
  amount: number;
}

export class Strategy {
  provider;
  wallet;
  usdgContract;
  tokenContract;
  quoter;
  router;
  url;
  tokenData;

  constructor(url: string, tokenData: TokensData) {
    this.url = url;
    this.tokenData = tokenData;
    this.provider = new ethers.JsonRpcProvider(url);
    this.wallet = new ethers.Wallet(CTB_PRIVATE_KEY || "", this.provider);
    this.tokenContract = new ethers.Contract(
      tokenData.address || "",
      ERC20_ABI,
      this.wallet,
    );
    this.usdgContract = new ethers.Contract(
      USDG_ADDRESS || "",
      ERC20_ABI,
      this.wallet,
    );
    this.quoter = new ethers.Contract(QUOTER_V2, QUOTER_V2_ABI, this.provider);
    this.router = new ethers.Contract(
      SWAP_ROUTER_02,
      SWAP_ROUTER_02_ABI,
      this.wallet,
    );
  }

  async sellOnProfit(position: Position, profitFactor: number) {
    const { sell, price } = await decideToSell(
      this.tokenData,
      profitFactor,
      position.price,
    );

    if (!price || !sell) return;

    const amountOut = await getQuoteAndAmountOut(
      this.quoter.quoteExactInputSingle,
      this.tokenContract,
      this.usdgContract,
      ethers.parseUnits(position.amount.toString(), this.tokenData.decimals),
    );

    if (!amountOut) throw new Error("Get Quote Error");

    const tokenBalanceAfterTx = await swapToken(
      this.router.exactInputSingle,
      this.tokenContract,
      this.usdgContract,
      this.wallet,
      ethers.parseUnits(position.amount.toString(), this.tokenData.decimals),
      amountOut,
    );

    debug("tokenBalanceAfterTx: " + tokenBalanceAfterTx);

    if (!tokenBalanceAfterTx) throw new Error("Swap Error");

    const amountOutWithoutDecimals = parseFloat(
      ethers.formatUnits(amountOut, USDG_DECIMALS),
    );

    const buyUSDGAmount = position.price * position.amount;

    await closePosition(position.id, amountOutWithoutDecimals - buyUSDGAmount);

    return amountOutWithoutDecimals;
  }

  async buyUnderSMA(
    tokenData: TokensData,
    underSMAFactor: number,
    usdgInAmount: bigint,
  ) {
    const { buy, price } = await decideToBuy(tokenData, underSMAFactor);

    if (!price || !buy) return;

    const amountOut = await getQuoteAndAmountOut(
      this.quoter.quoteExactInputSingle,
      this.usdgContract,
      this.tokenContract,
      usdgInAmount,
    );

    if (!amountOut) throw new Error("Get Quote Error");

    const tokenBalanceAfterTx = await swapToken(
      this.router.exactInputSingle,
      this.usdgContract,
      this.tokenContract,
      this.wallet,
      usdgInAmount,
      amountOut,
    );

    debug("tokenBalanceAfterTx: " + tokenBalanceAfterTx);

    if (!tokenBalanceAfterTx) throw new Error("Swap Error");

    const amountOutWithoutDecimals = parseFloat(
      ethers.formatUnits(amountOut, 18),
    );

    await createNewPosition(
      amountOutWithoutDecimals,
      tokenData.identifier,
      price,
    );

    return amountOutWithoutDecimals;
  }
}
