import { OnchainLobClient } from '../../../src';
import { wait } from '../../../src/utils/delay';
import { getTestConfig, type TestConfig } from '../../testConfig';

describe('Onchain LOB Spot WebSocket Client', () => {
  let testConfig: TestConfig;
  let onchainLobClient: OnchainLobClient;

  beforeAll(() => {
    testConfig = getTestConfig();

    onchainLobClient = new OnchainLobClient({
      apiBaseUrl: testConfig.onchainLobApiBaseUrl,
      webSocketApiBaseUrl: testConfig.onchainLobWebsocketBaseUrl,
      signer: null,
      webSocketConnectImmediately: false,
    });
  });

  test('check candles subscription exists', async () => {
    const subscriptionErrorListener = jest.fn();
    onchainLobClient.spot.events.subscriptionError.addListener(subscriptionErrorListener);
    onchainLobClient.spot.subscribeToCandles({ market: testConfig.testMarkets.btcUsd.id, resolution: '1D' });
    await wait(1000);
    onchainLobClient.spot.unsubscribeFromCandles({ market: testConfig.testMarkets.btcUsd.id, resolution: '1D' });
    expect(subscriptionErrorListener).not.toHaveBeenCalled();
    onchainLobClient.spot.events.subscriptionError.removeListener(subscriptionErrorListener);
    // TODO: need jest 30.0.0
    // onchainLobClient.spot[Symbol.dispose]();
  });
});
