import BigNumber from 'bignumber.js';
import type { Market } from '../src';

const testMarkets = {
  btcUsd: {
    id: '0x46fbd14b11891100f25a7b543bdfe68ff95a277f'.toLowerCase(),
    name: 'BTCUSDC',
    symbol: 'BTCUSDC',
    baseToken: {
      id: '0x92d81a25f6f46cd52b8230ef6cea5747bc3826db'.toLowerCase(),
      name: 'Bitcoin',
      symbol: 'BTC',
      contractAddress: '0x92d81a25f6f46cd52b8230ef6cea5747bc3826db'.toLowerCase(),
      decimals: 18,
      roundingDecimals: 8,
      supportsPermit: false,
      iconUrl: null,
      fromOg: false,
    },
    quoteToken: {
      id: '0x9626cc8790c547779551b5948029a4f646853f91'.toLowerCase(),
      name: 'USD Coin',
      symbol: 'USDC',
      contractAddress: '0x9626cc8790c547779551b5948029a4f646853f91'.toLowerCase(),
      decimals: 6,
      roundingDecimals: 6,
      supportsPermit: false,
      iconUrl: null,
      fromOg: false,
    },
    orderbookAddress: '0x46fbd14b11891100f25a7b543bdfe68ff95a277f'.toLowerCase(),
    aggregations: expect.any(Array),
    rawLastPrice: expect.any(BigInt),
    lastPrice: expect.any(BigNumber),
    rawLowPrice24h: expect.any(BigInt),
    lowPrice24h: expect.any(BigNumber),
    rawHighPrice24h: expect.any(BigInt),
    highPrice24h: expect.any(BigNumber),
    tokenXScalingFactor: 6,
    tokenYScalingFactor: 6,
    priceScalingFactor: 0,
    rawPrice24h: expect.any(BigInt),
    price24h: expect.any(BigNumber),
    rawBestAsk: expect.any(BigInt),
    bestAsk: expect.any(BigNumber),
    rawBestBid: expect.any(BigInt),
    bestBid: expect.any(BigNumber),
    rawTradingVolume24h: expect.any(BigInt),
    tradingVolume24h: expect.any(BigNumber),
    totalSupply: expect.any(BigNumber),
    lastTouched: expect.any(Number),
    supportsNativeToken: false,
    isNativeTokenX: false,
    aggressiveFee: 0.0003,
    passiveFee: 0,
    passiveOrderPayout: 0.00005,
  },
} as const satisfies Record<string, Market>;

export interface TestConfig {
  readonly rpcUrl: string;
  readonly chainId: number;
  readonly accountPrivateKey: string;
  readonly mmPrivateKey: string;
  readonly onchainLobApiBaseUrl: string;
  readonly onchainLobWebsocketBaseUrl: string;
  readonly testMarkets: typeof testMarkets;
}

const envInfos = [
  ['RPC_URL', 'the RPC URL for EVM node'],
  ['CHAIN_ID', 'chain ID of the EVM network'],
  ['ACCOUNT_PRIVATE_KEY', 'the private key of the test account'],
  ['MM_PRIVATE_KEY', 'the private key of the market maker account'],
  ['API_BASE_URL', 'the base URL for Onchain LOB API'],
  ['WEBSOCKET_BASE_URL', 'the base URL for Onchain LOB Websocket'],
] as const;

const validateRequiredEnvironmentVariables = (): [true, typeof process.env & Record<typeof envInfos[number][0], string>] | [false, string[]] => {
  const errors: string[] = [];
  for (const [name, description] of envInfos) {
    if (!process.env[name])
      errors.push(`Please, specify \x1b[34m${name}\x1b[0m - ${description}`);
  }

  return errors.length ? [false, errors] : [true, process.env as any];
};

const createInvalidEnvironmentVariablesError = (errors: string[]): Error =>
  new Error(errors.reduce(
    (acc, error, index) => `  ${acc}${index + 1}. ${error}\n`,
    '\nSome required environment variables are invalid:\n'
  ));

export const getTestConfig = (): TestConfig => {
  const [isValid, env] = validateRequiredEnvironmentVariables();
  if (!isValid)
    throw createInvalidEnvironmentVariablesError(env);

  return {
    rpcUrl: env.RPC_URL,
    chainId: Number.parseInt(env.CHAIN_ID),
    accountPrivateKey: env.ACCOUNT_PRIVATE_KEY,
    mmPrivateKey: env.MM_PRIVATE_KEY,
    onchainLobApiBaseUrl: env.API_BASE_URL,
    onchainLobWebsocketBaseUrl: env.WEBSOCKET_BASE_URL,
    testMarkets,
  };
};
