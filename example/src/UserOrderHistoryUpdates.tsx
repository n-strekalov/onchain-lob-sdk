import React, { useState, useEffect, useContext } from 'react';
import { Button, Container, Typography, Box } from '@mui/material';
import { ClientAddressContext, OnchainLobClientContext } from './clientContext';
import { type OrderHistoryUpdate } from 'onchain-lob-sdk';

export const UserOrderHistoryUpdates: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const onchainLobClient = useContext(OnchainLobClientContext);
  const address = useContext(ClientAddressContext);

  function onUserOrderHistoryUpdated(_marketId: string, _isSnapshot: boolean, data: OrderHistoryUpdate[]) {
    setEvents(prevEvents => [...prevEvents, ...data]);
  }

  useEffect(() => {
    onchainLobClient.spot.events.userOrderHistoryUpdated.addListener(onUserOrderHistoryUpdated);
    return () => {
      onchainLobClient.spot.events.userOrderHistoryUpdated.removeListener(onUserOrderHistoryUpdated);
    };
  }, []);

  const handleSubscribe = () => {
    if (!address) {
      alert('Please connect your wallet first');
      return;
    }
    setIsSubscribed(prev => !prev);
    if (!isSubscribed) {
      onchainLobClient.spot.subscribeToUserOrderHistory({
        user: address,
      });
    }
    else {
      onchainLobClient.spot.unsubscribeFromUserOrderHistory({
        user: address,
      });
    }
  };

  return (
    <Container>
      <Typography variant="h6" component="h3" gutterBottom>
        User Order History
      </Typography>
      <Button variant="contained" color="primary" onClick={handleSubscribe}>
        {isSubscribed ? 'Unsubscribe' : 'Subscribe'}
      </Button>
      <Box mt={2} textAlign="left">
        <Typography variant="body1" component="pre">
          {JSON.stringify(events, (_key, value) =>
            typeof value === 'bigint'
              ? value.toString()
              : value, 2)}
        </Typography>
      </Box>
    </Container>
  );
};

export default UserOrderHistoryUpdates;
