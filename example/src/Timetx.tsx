import { Button, Typography } from '@mui/material';
import { useCallback, useContext, useEffect, useState } from 'react';
import { ClientAddressContext, OnchainLobClientContext } from './clientContext';
import { MARKET_ADDRESS } from './constants';
import { ContractTransactionResponse, JsonRpcProvider, Network } from 'ethers';
import BigNumber from 'bignumber.js';

let tx: ContractTransactionResponse | undefined;
let placeOrderDate: number, eventDate: number;
async function waitTx(): Promise<void> {
  while (!tx) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

const network = new Network('testnet', 128123n);
const provider = new JsonRpcProvider(
  'https://rpc.testnet.soniclabs.com',
  network,
  { pollingInterval: 100, polling: true, staticNetwork: network }
);

const Timetx = () => {
  const onchainLobClient = useContext(OnchainLobClientContext);
  const user = useContext(ClientAddressContext);
  const [timetxText, setText] = useState<string>('');

  useEffect(() => {
    onchainLobClient.spot.getCachedMarkets();
  });

  useEffect(() => {
    if (user) {
      onchainLobClient.spot.subscribeToUserOrders({ market: MARKET_ADDRESS, user });
      return () => onchainLobClient.spot.unsubscribeFromUserOrders({ market: MARKET_ADDRESS, user });
    }
  }, [onchainLobClient, user]);

  const eventListener = useCallback(async (_: any, __: any, orders: any[]) => {
    await waitTx();

    const newOrder = orders.find((o: { txnHash: string }) => o.txnHash === tx!.hash);
    if (newOrder) {
      eventDate = Date.now();
      setText(`Event response took ${eventDate - placeOrderDate} milliseconds`);
    }
  }, [onchainLobClient, setText]);

  useEffect(() => {
    onchainLobClient.spot.events.userOrdersUpdated.addListener(eventListener);
    return () => {
      onchainLobClient.spot.events.userOrdersUpdated.removeListener(eventListener);
      return;
    };
  }, [onchainLobClient, eventListener]);

  const handleClick = useCallback(async () => {
    if (!user) {
      alert('Please connect your wallet first');
      return;
    }
    const nonce = BigInt(await provider.getTransactionCount(user));
    tx = (await onchainLobClient.spot.placeOrder({
      market: MARKET_ADDRESS,
      type: 'limit',
      side: 'ask',
      price: BigNumber(0.9),
      size: BigNumber(0.1),
      maxCommission: BigNumber(0.1),
      nativeTokenToSend: BigNumber(0.1),
      // additional params
      gasLimit: 20000000n,
      maxFeePerGas: 1000000000n,
      maxPriorityFeePerGas: 0n,
      nonce,
    })) as unknown as ContractTransactionResponse;
    placeOrderDate = Date.now();
  }, [onchainLobClient, user]);

  return (
    <>
      <Typography variant="h6">Time place order transaction</Typography>
      <Button
        variant="contained"
        color="primary"
        onClick={handleClick}
      >
        Click Me
      </Button>
      <Typography>
        {timetxText}
      </Typography>
    </>
  );
};

export default Timetx;
