import { describe, it } from "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import { ethers, BaseContractMethod } from "ethers";

import { TOKEN_ADDRESSES, USDG_DECIMALS } from "contracts";
import { SWAP_ROUTER_02_ABI } from "abis";
import { CONFIG_CONSTS } from "config";
import {
  getCoingeckoAPIHistoricalPricesUrl,
  getCoingeckoAPIPriceUrl,
  getCurrentSMA,
  getQuoteAndAmountOut,
} from "helpers/getQuote";
import {
  closePosition,
  createNewPosition,
  getPositionByStatus,
} from "dbQueries/positions";

import { createDebug } from "../debug";
import { cleanTestDatabase } from "./setup";

const { SWAP_ROUTER_02 } = CONFIG_CONSTS;

// TODO add test cases and clean

const debug = createDebug("Test swap functions");

interface Erc20Fake {
  allowance: sinon.SinonSpy<[string, string], Promise<bigint>>;
  approve: sinon.SinonSpy<[string, string], Promise<{}>>;
  exactInputSingle: sinon.SinonSpy<[string, string], Promise<{}>>;
  balanceOf: sinon.SinonSpy<[string, string], Promise<bigint>>;
  quoteExactInputSingle: sinon.SinonSpy<[string, string], {}>;
}

const usdgBuyAmount = 0.1;
const usdgBuyAmountBigInt = ethers.parseUnits(usdgBuyAmount.toString(), 6);

const underSMAFactor = 0.9;

const fakeUrl = "fakeurl.com";

const provider = new ethers.JsonRpcProvider(fakeUrl);

const wallet = new ethers.Wallet(
  "0xe806686101aae52d7d2882c5bcf3ebe4232c1bab38204de755c7cea7c05cd123",
  provider,
);

const token = TOKEN_ADDRESSES[0];

const historicalPrices = [
  [0, 0.2, 0, 0, 0.3],
  [0, 0.3, 0, 0, 0.4],
];

const pricesOC = historicalPrices.map((price) => ({
  open: price[1],
  close: price[4],
}));

const sma = getCurrentSMA(pricesOC);

const price = { [token.identifier]: { usd: 0.5 * sma - 0.0001 } };

const TOKEN_QUOTE_MOCK = 1.23;
const TOKEN_QUOTE_MOCK_BIG_INT = ethers.parseUnits(
  TOKEN_QUOTE_MOCK.toString(),
  token.decimals,
);

const quote = [TOKEN_QUOTE_MOCK_BIG_INT];

const txSuccessReturn = {
  hash: "0x111",
  wait: async () => ({ status: 1, blockNumber: "333222111" }),
};

const fakeFetch = sinon.fake(async (url) => {
  if (url === getCoingeckoAPIPriceUrl(token.identifier)) {
    return new Response(JSON.stringify(price), { status: 200 });
  }
  if (url === getCoingeckoAPIHistoricalPricesUrl(token.identifier)) {
    return new Response(JSON.stringify(historicalPrices), { status: 200 });
  }
  throw new Error(`Unexpected fetch: ${url}`);
});

sinon.replace(globalThis, "fetch", fakeFetch);

const fakeQuoter = {
  quoteExactInputSingle: {
    staticCall: sinon.fake.resolves(quote),
  },
};

type FakeExactInputSingleType = {
  estimateGas?: sinon.SinonSpy<any[], any>;
} & sinon.SinonSpy<any[], any>;

const fakeExactInputSingle: FakeExactInputSingleType =
  sinon.fake.resolves(txSuccessReturn);

fakeExactInputSingle.estimateGas = sinon.fake.resolves(10000n);

const fakeUsdgContract = {
  getAddress: sinon.fake.resolves("0x123aba"),
  allowance: sinon.fake.resolves(usdgBuyAmountBigInt / 2n),
  approve: sinon.fake.resolves(txSuccessReturn),
};

const fakeTokenContract = {
  getAddress: sinon.fake.resolves("0x123aba"),
  balanceOf: sinon.fake.resolves(1000n),
};

describe("Get Quote tests", () => {
  afterEach(async () => {
    sinon.restore();
    await cleanTestDatabase();
  });

  it("should call proper functions and return quote", (done) => {
    const USDG_BUY_AMOUNT = ethers.parseUnits((0.1).toString(), USDG_DECIMALS);

    getQuoteAndAmountOut(
      fakeQuoter.quoteExactInputSingle as unknown as BaseContractMethod,
      fakeUsdgContract as unknown as ethers.Contract,
      fakeTokenContract as unknown as ethers.Contract,
      USDG_BUY_AMOUNT,
    )
      .then((result) => {
        expect(fakeUsdgContract.getAddress.callCount).to.equal(1);
        expect(fakeTokenContract.getAddress.callCount).to.equal(1);
        expect(fakeQuoter.quoteExactInputSingle.staticCall.callCount).to.equal(
          1,
        );

        expect(result).to.equal(TOKEN_QUOTE_MOCK_BIG_INT);

        done();
      })
      .catch((err) => {
        done(err);
      });
  });

  it("should create new position, return it as an open position and later close it", async () => {
    const TOKEN_AMOUNT = 1.234;
    const FAKE_PRICE = 3.21;
    const FAKE_PNL = 4.56;

    let openPositions = await getPositionByStatus("open");
    expect(openPositions).to.be.an("array");
    expect(openPositions?.length).to.equal(0);
    let closedPositions = await getPositionByStatus("closed");
    expect(closedPositions).to.be.an("array");
    expect(closedPositions?.length).to.equal(0);

    await createNewPosition(TOKEN_AMOUNT, token.identifier, FAKE_PRICE);

    openPositions = await getPositionByStatus("open");
    expect(openPositions).to.be.an("array");
    expect(openPositions?.length).to.equal(1);

    const openPosition = openPositions[0];
    expect(openPosition.amount).to.equal(TOKEN_AMOUNT);
    expect(openPosition.price).to.equal(FAKE_PRICE);
    expect(openPosition.tokenIdentifier).to.equal(token.identifier);

    await closePosition(openPosition.id, FAKE_PNL);

    openPositions = await getPositionByStatus("open");
    expect(openPositions).to.be.an("array");
    expect(openPositions?.length).to.equal(0);

    closedPositions = await getPositionByStatus("closed");
    expect(closedPositions).to.be.an("array");
    expect(closedPositions?.length).to.equal(1);

    const closedPosition = closedPositions[0];
    expect(closedPosition.amount).to.equal(TOKEN_AMOUNT);
    expect(closedPosition.price).to.equal(FAKE_PRICE);
    expect(closedPosition.tokenIdentifier).to.equal(token.identifier);
  });
});
