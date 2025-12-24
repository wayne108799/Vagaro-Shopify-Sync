import { render, h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

const BACKEND_URL = 'https://Beautyoasisadmin.replit.app';

export default async () => {
  render(h(Extension), document.body);
};

function Extension() {
  const [isLoading, setIsLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState(null);
  const [stylistName, setStylistName] = useState(null);

  useEffect(() => {
    fetchAppointments();
  }, []);

  async function fetchAppointments() {
    try {
      setIsLoading(true);
      
      // Get current staff member
      var staff = await shopify.staff.current();
      var staffParam = staff && staff.id ? '?staffId=' + staff.id : '';
      
      const response = await fetch(BACKEND_URL + '/api/pos/pending-appointments' + staffParam, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setAppointments(data.appointments || []);
      setViewMode(data.viewMode || 'manager');
      setStylistName(data.stylistName || null);
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

      await fetch(BACKEND_URL + '/api/pos/mark-loaded/' + appointment.id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      shopify.toast.show('Added ' + appointment.serviceName + ' to cart');
      setAppointments(function(prev) { return prev.filter(function(a) { return a.id !== appointment.id; }); });

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

  var pageTitle = viewMode === 'stylist' && stylistName 
    ? stylistName + "'s Appointments" 
    : "Today's Appointments";

  if (appointments.length === 0) {
    return h('s-page', { heading: pageTitle },
      h('s-scroll-box', null,
        h('s-box', { padding: 'base' },
          h('s-text', null, 'No pending appointments'),
          h('s-button', { onClick: fetchAppointments }, 'Refresh')
        )
      )
    );
  }

  var cards = appointments.map(function(apt) {
    return h('s-card', { key: apt.id },
      h('s-box', { padding: 'base' },
        h('s-text', { variant: 'headingMedium' }, apt.customerName),
        h('s-text', null, apt.serviceName),
        viewMode === 'manager' ? h('s-text', null, 'Stylist: ' + apt.stylistName) : null,
        h('s-text', { variant: 'headingLarge' }, '$' + apt.amount),
        h('s-button', { onClick: function() { addToCart(apt); } }, 'Add to Cart')
      )
    );
  });

  return h('s-page', { heading: pageTitle },
    h('s-scroll-box', null,
      h('s-box', { padding: 'base' },
        h('s-text', { variant: 'headingLarge' }, appointments.length + ' Pending'),
        cards
      )
    )
  );
}
