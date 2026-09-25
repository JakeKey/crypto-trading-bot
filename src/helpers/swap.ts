// 0.0001 eth
import { ethers, Contract, Wallet } from "ethers";

import { DebugLevels } from "../types/enums";
import { SWAP_ROUTER_02_ABI } from "../abis";
import { createDebug } from "../debug";
import { CONFIG_CONSTS } from "../config";

const { SWAP_ROUTER_02, CTB_WALLET_ADDRESS } = CONFIG_CONSTS;

const debug = createDebug("swap");

export const checkAllowance = async (
  tokenIn: Contract,
  wallet: Wallet,
  amountIn: bigint,
) => {
  try {
    const current = await tokenIn.allowance(wallet.address, SWAP_ROUTER_02);

    debug("Current allowance: " + current);

    if (current >= amountIn) return;

    debug("Approving router to spend TOKEN_IN...");
    const tx = await tokenIn.approve(SWAP_ROUTER_02, amountIn);
    debug(`Approval tx submitted: ${tx.hash}`);
    const receipt = await tx?.wait();
    if (receipt.status !== 1)
      throw new Error(`Approval tx ${tx.hash} reverted`);
    debug(`Approval confirmed in block ${receipt.blockNumber}`);
  } catch (err) {
    debug(`Check allowance error error: ${err}`, DebugLevels.ERROR);
  }
};

export const buyToken = async (
  tokenIn: Contract,
  tokenOut: Contract,
  wallet: Wallet,
  amountIn: bigint,
  amountOut: bigint,
  fee = 10000,
): Promise<bigint | undefined> => {
  try {
    const router = new ethers.Contract(
      SWAP_ROUTER_02,
      SWAP_ROUTER_02_ABI,
      wallet,
    );

    const params = {
      tokenIn: await tokenIn.getAddress(),
      tokenOut: await tokenOut.getAddress(),
      fee: fee,
      recipient: wallet.address,
      amountIn,
      amountOutMinimum: amountOut,
      sqrtPriceLimitX96: 0n,
    };

    await checkAllowance(tokenIn, wallet, amountIn);

    const gasEstimate = await router.exactInputSingle.estimateGas(params);

    debug("gasEstimate: " + gasEstimate);

    const tx = await router.exactInputSingle(params, {
      gasLimit: (gasEstimate * 120n) / 100n,
    });
    debug(`Submitted tx ${tx.hash}, waiting for confirmation...`);
    const receipt = await tx.wait();
    if (receipt.status !== 1)
      throw new Error(`Transaction ${tx.hash} reverted`);
    debug(`Confirmed in block ${receipt.blockNumber}`);

    return await tokenOut.balanceOf(CTB_WALLET_ADDRESS);
  } catch (err) {
    debug(`swap error: ${err}`, DebugLevels.ERROR);
    return undefined;
  }
};
