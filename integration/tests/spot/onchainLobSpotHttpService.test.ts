import { ethers, type Signer } from 'ethers';
import { OnchainLobClient } from '../../../src';
import { getTestConfig, type TestConfig } from '../../testConfig';

describe('Onchain LOB Spot HTTP Client', () => {
  let testConfig: TestConfig;
  let signer: Signer;
  let onchainLobClient: OnchainLobClient;

  beforeAll(() => {
    testConfig = getTestConfig();
    signer = new ethers.VoidSigner('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');

    onchainLobClient = new OnchainLobClient({
      apiBaseUrl: testConfig.onchainLobApiBaseUrl,
      webSocketApiBaseUrl: testConfig.onchainLobWebsocketBaseUrl,
      signer: signer,
      webSocketConnectImmediately: false,
    });
  });

  test('get btcusd market info', async () => {
    const marketId = testConfig.testMarkets.btcUsd.id;
    const market = await onchainLobClient.spot.getMarket({ market: marketId });
    if (market) {
      expect(market.orderbookAddress).toBe(marketId);
      expect(market.tokenXScalingFactor).toBe(testConfig.testMarkets.btcUsd.tokenXScalingFactor);
      expect(market.tokenYScalingFactor).toBe(testConfig.testMarkets.btcUsd.tokenYScalingFactor);
      expect(market.priceScalingFactor).toBe(testConfig.testMarkets.btcUsd.priceScalingFactor);
      if (market.lastPrice)
        expect(market.lastPrice).toEqual(testConfig.testMarkets.btcUsd.lastPrice);
      if (market.lowPrice24h)
        expect(market.lowPrice24h).toEqual(testConfig.testMarkets.btcUsd.lowPrice24h);
      if (market.highPrice24h)
        expect(market.highPrice24h).toEqual(testConfig.testMarkets.btcUsd.highPrice24h);
      if (market.bestAsk)
        expect(market.bestAsk).toEqual(testConfig.testMarkets.btcUsd.bestAsk);
      if (market.bestBid)
        expect(market.bestBid).toEqual(testConfig.testMarkets.btcUsd.bestBid);
      expect(market.tradingVolume24h).toEqual(testConfig.testMarkets.btcUsd.tradingVolume24h);
      expect(market.lastTouched).toEqual(testConfig.testMarkets.btcUsd.lastTouched);
      expect(market.baseToken).toEqual(testConfig.testMarkets.btcUsd.baseToken);
      expect(market.quoteToken).toEqual(testConfig.testMarkets.btcUsd.quoteToken);
      expect(market.supportsNativeToken).toBe(testConfig.testMarkets.btcUsd.supportsNativeToken);
      expect(market.isNativeTokenX).toBe(testConfig.testMarkets.btcUsd.isNativeTokenX);
      expect(market.aggressiveFee).toBe(testConfig.testMarkets.btcUsd.aggressiveFee);
      expect(market.passiveFee).toBe(testConfig.testMarkets.btcUsd.passiveFee);
      expect(market.passiveOrderPayout).toBe(testConfig.testMarkets.btcUsd.passiveOrderPayout);
    }
    else {
      throw new Error('market is undefined');
    }
  });

  test('get candles data', async () => {
    const candles = await onchainLobClient.spot.getCandles({
      market: testConfig.testMarkets.btcUsd.id,
      resolution: '60',
      toTime: 1721966400000,
      fromTime: 1721955600000,
    });
    // no market data for now
    expect(candles).toEqual([]);
  });
});
