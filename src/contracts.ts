// ADDRESSES FOR ROBINHOOD CHAIN, CHANGE IF NEEDED

export interface TokensData {
  identifier: string;
  address: string;
  decimals: number;
  poolFee: number;
}

export const TOKEN_ADDRESSES: TokensData[] = [
  {
    identifier: "the-index",
    address: "0x56910d4409f3a0c78c64dd8d0545ff0705389870",
    decimals: 18,
    poolFee: 10000,
  },
  {
    identifier: "artificial-inu-3",
    address: "0x2E8c31162b855A2ffa90F6F8634643Ad6F111e18",
    decimals: 18,
    poolFee: 10000,
  },

  {
    identifier: "pons",
    address: "0x39dbed3a2bd333467115de45665cc57f813c4571",
    decimals: 18,
    poolFee: 10000,
  },
];

export const WETH_ADDRESS = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";

export const USDG_ADDRESS = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";

export const USDG_DECIMALS = 6;
