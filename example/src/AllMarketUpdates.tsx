import React, { useState, useEffect, useContext } from 'react';
import { Button, Container, Typography, Box } from '@mui/material';
import { OnchainLobClientContext } from './clientContext';
import { MarketUpdate } from 'onchain-lob-sdk';

export const AllMarketsUpdates: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const onchainLobClient = useContext(OnchainLobClientContext);

  function onAllMarketsUpdateed(_isSnapshot: boolean, data: MarketUpdate[]) {
    setEvents(_prevEvents => [...data]);
  }

  useEffect(() => {
    onchainLobClient.spot.events.allMarketUpdated.addListener(onAllMarketsUpdateed);

    return () => {
      onchainLobClient.spot.events.allMarketUpdated.removeListener(onAllMarketsUpdateed);
    };
  }, []);

  const handleSubscribe = () => {
    setIsSubscribed(prev => !prev);
    if (!isSubscribed) {
      onchainLobClient.spot.subscribeToAllMarkets();
    }
    else {
      onchainLobClient.spot.unsubscribeFromAllMarkets();
    }
  };

  return (
    <Container>
      <Typography variant="h6" component="h3" gutterBottom>
        All Markets Updates
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

export default AllMarketsUpdates;
