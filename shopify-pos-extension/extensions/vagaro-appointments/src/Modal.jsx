import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';

const BACKEND_URL = 'https://your-replit-url.replit.app';

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  const [isLoading, setIsLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAppointments();
  }, []);

  async function fetchAppointments() {
    try {
      setIsLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/pos/pending-appointments`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch');
      }

      const data = await response.json();
      setAppointments(data.appointments || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function addToCart(appointment) {
    try {
      if (appointment.shopifyProductVariantId) {
        await shopify.cart.addLineItem({
          variantId: appointment.shopifyProductVariantId,
          quantity: 1,
        });
      } else {
        await shopify.cart.addCustomSale({
          title: appointment.serviceName,
          price: appointment.amount,
          quantity: 1,
          taxable: false,
        });
      }

      await fetch(`${BACKEND_URL}/api/pos/mark-loaded/${appointment.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      shopify.toast.show(`Added ${appointment.serviceName} to cart`);
      setAppointments(prev => prev.filter(a => a.id !== appointment.id));

      if (appointments.length === 1) {
        shopify.action.exitModal();
      }
    } catch (err) {
      shopify.toast.show('Failed to add to cart');
    }
  }

  if (isLoading) {
    return (
      <s-page heading="Vagaro Appointments">
        <s-scroll-box>
          <s-box padding="base">
            <s-text>Loading appointments...</s-text>
          </s-box>
        </s-scroll-box>
      </s-page>
    );
  }

  if (error) {
    return (
      <s-page heading="Vagaro Appointments">
        <s-scroll-box>
          <s-box padding="base">
            <s-banner status="critical" title="Error">
              {error}
            </s-banner>
            <s-button onClick={fetchAppointments}>Retry</s-button>
          </s-box>
        </s-scroll-box>
      </s-page>
    );
  }

  return (
    <s-page heading="Vagaro Appointments">
      <s-scroll-box>
        {appointments.length === 0 ? (
          <s-box padding="base">
            <s-text>No pending appointments</s-text>
            <s-button onClick={fetchAppointments}>Refresh</s-button>
          </s-box>
        ) : (
          <s-box padding="base">
            <s-text variant="headingLarge">{appointments.length} Pending</s-text>
            {appointments.map((apt) => (
              <s-card key={apt.id}>
                <s-box padding="base">
                  <s-text variant="headingMedium">{apt.customerName}</s-text>
                  <s-text>{apt.serviceName}</s-text>
                  <s-text>Stylist: {apt.stylistName}</s-text>
                  <s-text variant="headingLarge">${apt.amount}</s-text>
                  <s-button onClick={() => addToCart(apt)}>Add to Cart</s-button>
                </s-box>
              </s-card>
            ))}
          </s-box>
        )}
      </s-scroll-box>
    </s-page>
  );
}
