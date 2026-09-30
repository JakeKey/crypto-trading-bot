import { describe, it } from "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import { ethers, BaseContractMethod } from "ethers";

import { buyUnderSMAStrategy } from "strategies/buyUnderSMAStrategy";
import { TOKEN_ADDRESSES } from "contracts";
import { SWAP_ROUTER_02_ABI } from "abis";
import { CONFIG_CONSTS } from "config";
import {
  getCoingeckoAPIHistoricalPricesUrl,
  getCoingeckoAPIPriceUrl,
  getCurrentSMA,
} from "helpers/getQuote";
import { getOpenPositions } from "dbQueries/positions";

import { createDebug } from "../debug";
import { cleanTestDatabase } from "./setup";

const { SWAP_ROUTER_02 } = CONFIG_CONSTS;

// TODO add test cases

const debug = createDebug("Test Buy Strategy");

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

const provider = new ethers.JsonRpcProvider("fakeurl.com");

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

const quote = [ethers.parseUnits(TOKEN_QUOTE_MOCK.toString(), token.decimals)];

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

// const fakeRouterExactInputSingle = sinon.replace(
//   router as unknown as Erc20Fake,
//   "exactInputSingle",
//   sinon.fake.resolves(txSuccessReturn) as Erc20Fake["exactInputSingle"],
//   //   sinon.fake.returns(FakeContract() as unknown as Contract),
// );

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

describe("Buy Strategy tests", () => {
  afterEach(async () => {
    await cleanTestDatabase();
  });

  it("should buy token and create position in database if price < SMA*underSMAFactor", (done) => {
    buyUnderSMAStrategy(
      fakeExactInputSingle as unknown as BaseContractMethod,
      fakeQuoter.quoteExactInputSingle as unknown as BaseContractMethod,
      wallet,
      token,
      fakeUsdgContract as unknown as ethers.Contract,
      fakeTokenContract as unknown as ethers.Contract,
      underSMAFactor,
    )
      .then((result) => {
        expect(fakeUsdgContract.getAddress.callCount).to.equal(2);
        expect(fakeTokenContract.getAddress.callCount).to.equal(2);
        expect(fakeQuoter.quoteExactInputSingle.staticCall.callCount).to.equal(
          1,
        );
        expect(fakeUsdgContract.allowance.callCount).to.equal(1);
        expect(fakeUsdgContract.approve.callCount).to.equal(1);
        expect(fakeExactInputSingle.estimateGas?.callCount).to.equal(1);
        expect(fakeExactInputSingle.callCount).to.equal(1);
        expect(fakeTokenContract.balanceOf.callCount).to.equal(1);

        expect(result).to.equal(TOKEN_QUOTE_MOCK);

        getOpenPositions()
          .then((data) => {
            expect(data).to.be.an("array");
            expect(data?.length).to.equal(1);

            const position = data[0];
            expect(position.amount).to.equal(TOKEN_QUOTE_MOCK);
            expect(position.tokenIdentifier).to.equal(token.identifier);
            done();
          })
          .catch((err) => {
            done(err);
          });
      })
      .catch((err) => {
        done(err);
      });
  });
});
