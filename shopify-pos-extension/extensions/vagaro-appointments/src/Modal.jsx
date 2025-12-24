/** @jsxImportSource preact */
import { render, h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

const BACKEND_URL = 'https://your-replit-url.replit.app';

export default async () => {
  render(h(Extension, null), document.body);
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
    return h('s-page', { heading: 'Vagaro Appointments' },
      h('s-scroll-box', null,
        h('s-box', { padding: 'base' },
          h('s-text', null, 'Loading appointments...')
        )
      )
    );
  }

  if (error) {
    return h('s-page', { heading: 'Vagaro Appointments' },
      h('s-scroll-box', null,
        h('s-box', { padding: 'base' },
          h('s-banner', { status: 'critical', title: 'Error' }, error),
          h('s-button', { onClick: fetchAppointments }, 'Retry')
        )
      )
    );
  }

  if (appointments.length === 0) {
    return h('s-page', { heading: 'Vagaro Appointments' },
      h('s-scroll-box', null,
        h('s-box', { padding: 'base' },
          h('s-text', null, 'No pending appointments'),
          h('s-button', { onClick: fetchAppointments }, 'Refresh')
        )
      )
    );
  }

  return h('s-page', { heading: 'Vagaro Appointments' },
    h('s-scroll-box', null,
      h('s-box', { padding: 'base' },
        h('s-text', { variant: 'headingLarge' }, `${appointments.length} Pending`),
        ...appointments.map((apt) =>
          h('s-card', { key: apt.id },
            h('s-box', { padding: 'base' },
              h('s-text', { variant: 'headingMedium' }, apt.customerName),
              h('s-text', null, apt.serviceName),
              h('s-text', null, `Stylist: ${apt.stylistName}`),
              h('s-text', { variant: 'headingLarge' }, `$${apt.amount}`),
              h('s-button', { onClick: () => addToCart(apt) }, 'Add to Cart')
            )
          )
        )
      )
    )
  );
}
