import { config } from "dotenv";

const isTestEnv = process.env.NODE_ENV === "test";

config({ path: isTestEnv ? ".env.test" : ".env" });

export const CONFIG_CONSTS = {
  CTB_ALCHEMY_API_KEY: process.env.CTB_ALCHEMY_API_KEY,
  CTB_COINGECKO_API_KEY: process.env.CTB_COINGECKO_API_KEY,
  CTB_WALLET_ADDRESS: process.env.CTB_WALLET_ADDRESS,
  CTB_PRIVATE_KEY: process.env.CTB_PRIVATE_KEY,

  // ADDRESSES FOR ROBINHOOD CHAIN, CHANGE IF NEEDED
  QUOTER_V2: "0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7",
  SWAP_ROUTER_02: "0xcaf681a66d020601342297493863e78c959e5cb2",
};
