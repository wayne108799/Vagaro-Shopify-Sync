import React, { useState, useEffect } from 'react';
import {
  Screen,
  ScrollView,
  Navigator,
  Stack,
  Text,
  Button,
  Section,
  Banner,
  useApi,
  reactExtension,
} from '@shopify/ui-extensions-react/point-of-sale';
import { CONFIG } from './config';

interface Appointment {
  id: string;
  customerName: string;
  serviceName: string;
  stylistName: string;
  amount: string;
  date: string;
  shopifyDraftOrderId?: string;
  shopifyProductVariantId?: string;
}

const AppointmentList = () => {
  const api = useApi<'pos.home.modal.render'>();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      setError(null);
      const sessionToken = await api.session.getSessionToken();
      
      const response = await fetch(`${CONFIG.BACKEND_URL}/api/pos/pending-appointments`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch appointments');
      }

      const data = await response.json();
      setAppointments(data.appointments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (appointment: Appointment) => {
    try {
      setProcessing(appointment.id);

      if (appointment.shopifyProductVariantId) {
        await api.cart.addLineItem({
          variantId: appointment.shopifyProductVariantId,
          quantity: 1,
        });
      } else {
        await api.cart.addCustomSale({
          title: appointment.serviceName,
          price: appointment.amount,
          quantity: 1,
          taxable: false,
        });
      }

      const sessionToken = await api.session.getSessionToken();
      await fetch(`${CONFIG.BACKEND_URL}/api/pos/mark-loaded/${appointment.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
      });

      api.toast.show(`Added ${appointment.serviceName} to cart`);
      
      setAppointments(prev => prev.filter(a => a.id !== appointment.id));

      if (appointments.length === 1) {
        api.action.exitModal();
      }
    } catch (err) {
      api.toast.show('Failed to add to cart');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <Navigator>
        <Screen name="Loading" title="Vagaro Appointments">
          <ScrollView>
            <Stack direction="vertical" alignment="center" paddingVertical="extraLarge">
              <Text>Loading appointments...</Text>
            </Stack>
          </ScrollView>
        </Screen>
      </Navigator>
    );
  }

  if (error) {
    return (
      <Navigator>
        <Screen name="Error" title="Vagaro Appointments">
          <ScrollView>
            <Stack direction="vertical" paddingVertical="base">
              <Banner status="critical" title="Error" description={error} />
              <Button title="Retry" onPress={fetchAppointments} />
            </Stack>
          </ScrollView>
        </Screen>
      </Navigator>
    );
  }

  return (
    <Navigator>
      <Screen name="Appointments" title="Vagaro Appointments">
        <ScrollView>
          {appointments.length === 0 ? (
            <Stack direction="vertical" alignment="center" paddingVertical="extraLarge">
              <Text>No pending appointments</Text>
              <Button title="Refresh" onPress={fetchAppointments} />
            </Stack>
          ) : (
            <Stack direction="vertical" paddingVertical="base">
              <Text size="large">{appointments.length} Pending Appointments</Text>
              {appointments.map((appointment) => (
                <Section key={appointment.id}>
                  <Stack direction="vertical">
                    <Text size="large">{appointment.customerName}</Text>
                    <Text>{appointment.serviceName}</Text>
                    <Text>Stylist: {appointment.stylistName}</Text>
                    <Text size="large">${appointment.amount}</Text>
                    <Button 
                      title="Add to Cart" 
                      onPress={() => addToCart(appointment)}
                    />
                  </Stack>
                </Section>
              ))}
            </Stack>
          )}
        </ScrollView>
      </Screen>
    </Navigator>
  );
};

export default reactExtension('pos.home.modal.render', () => {
  return <AppointmentList />;
});
