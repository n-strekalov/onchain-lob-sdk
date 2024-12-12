import { createContext } from 'react';
import { OnchainLobClient } from 'onchain-lob-sdk';
import { API_BASE_URL, WEBSOCKET_BASE_URL } from './constants';

export const defaultOnchainLobClient = new OnchainLobClient({
  apiBaseUrl: API_BASE_URL,
  webSocketApiBaseUrl: WEBSOCKET_BASE_URL,
  signer: null,
  webSocketConnectImmediately: false,
  autoWaitTransaction: false,
});
export const OnchainLobClientContext = createContext<OnchainLobClient>(defaultOnchainLobClient);
export const ClientAddressContext = createContext<string | null>(null);
