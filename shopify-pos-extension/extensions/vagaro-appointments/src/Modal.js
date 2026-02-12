import '@shopify/ui-extensions/preact';
import { render, h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

var BACKEND_URL = 'https://Beautyoasisadmin.replit.app';

export default function extension() {
  render(h(ModalComponent), document.body);
}

function ModalComponent() {
  var _s1 = useState(true); var loading = _s1[0]; var setLoading = _s1[1];
  var _s2 = useState([]); var appointments = _s2[0]; var setAppointments = _s2[1];
  var _s3 = useState(null); var error = _s3[0]; var setError = _s3[1];
  var _s4 = useState('manager'); var viewMode = _s4[0]; var setViewMode = _s4[1];
  var _s5 = useState(null); var stylistName = _s5[0]; var setStylistName = _s5[1];

  useEffect(function() { fetchAppointments(); }, []);

  async function fetchAppointments() {
    try {
      setLoading(true);
      var staffParam = '';
      try {
        var staff = await shopify.staff.current();
        if (staff && staff.id) staffParam = '?staffId=' + staff.id;
      } catch (e) {}

      var response = await fetch(BACKEND_URL + '/api/pos/pending-appointments' + staffParam, {
        method: 'GET', headers: { 'Content-Type': 'application/json' }, mode: 'cors'
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      var data = await response.json();
      setAppointments(data.appointments || []);
      setViewMode(data.viewMode || 'manager');
      setStylistName(data.stylistName || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function addToCart(apt) {
    try {
      if (apt.shopifyProductVariantId) {
        await shopify.cart.addLineItem({ variantId: apt.shopifyProductVariantId, quantity: 1 });
      } else {
        await shopify.cart.addCustomSale({ title: apt.serviceName, price: apt.amount, quantity: 1, taxable: false });
      }
      await fetch(BACKEND_URL + '/api/pos/mark-loaded/' + apt.id, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      shopify.toast.show('Added ' + apt.serviceName + ' to cart');
      fetchAppointments();
    } catch (err) {
      shopify.toast.show('Failed to add to cart');
    }
  }

  var pageTitle = viewMode === 'stylist' && stylistName ? stylistName + "'s Appointments" : "Today's Appointments";

  if (loading) {
    return h('s-page', { title: pageTitle },
      h('s-scroll-box', null,
        h('s-box', { padding: 'base' },
          h('s-text', null, 'Loading appointments...')
        )
      )
    );
  }

  if (error) {
    return h('s-page', { title: pageTitle },
      h('s-scroll-box', null,
        h('s-box', { padding: 'base' },
          h('s-banner', { status: 'critical', title: 'Error' }, error),
          h('s-button', { onClick: fetchAppointments }, 'Retry')
        )
      )
    );
  }

  if (appointments.length === 0) {
    return h('s-page', { title: pageTitle },
      h('s-scroll-box', null,
        h('s-box', { padding: 'base' },
          h('s-text', null, 'No pending appointments'),
          h('s-button', { onClick: fetchAppointments }, 'Refresh')
        )
      )
    );
  }

  var items = appointments.map(function(apt) {
    return h('s-section', { key: apt.id },
      h('s-box', { padding: 'base' },
        h('s-text', { variant: 'headingMd' }, apt.customerName),
        h('s-text', null, apt.serviceName),
        viewMode === 'manager' ? h('s-text', null, 'Stylist: ' + apt.stylistName) : null,
        h('s-text', { variant: 'headingLg' }, '$' + apt.amount),
        h('s-button', { onClick: function() { addToCart(apt); } }, 'Add to Cart')
      )
    );
  });

  return h('s-page', { title: pageTitle },
    h('s-scroll-box', null,
      h('s-box', { padding: 'base' },
        h('s-text', { variant: 'headingLg' }, appointments.length + ' Pending'),
        items,
        h('s-button', { onClick: fetchAppointments }, 'Refresh')
      )
    )
  );
}
