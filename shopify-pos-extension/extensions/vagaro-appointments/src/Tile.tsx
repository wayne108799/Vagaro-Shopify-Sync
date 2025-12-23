import React, { useState, useEffect } from 'react';
import {
  Tile,
  useApi,
  reactExtension,
} from '@shopify/ui-extensions-react/point-of-sale';
import { CONFIG } from './config';

const VagaroTile = () => {
  const api = useApi<'pos.home.tile.render'>();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetchPendingAppointments();
    const interval = setInterval(fetchPendingAppointments, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPendingAppointments = async () => {
    try {
      const sessionToken = await api.session.getSessionToken();
      const response = await fetch(`${CONFIG.BACKEND_URL}/api/pos/pending-appointments`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPendingCount(data.appointments?.length || 0);
      }
    } catch (error) {
      console.error('Failed to fetch appointments:', error);
    }
  };

  return (
    <Tile
      title="Vagaro Appointments"
      subtitle={pendingCount > 0 ? `${pendingCount} pending` : 'No pending'}
      enabled={true}
      onPress={() => api.action.presentModal()}
    />
  );
};

export default reactExtension('pos.home.tile.render', () => {
  return <VagaroTile />;
});
