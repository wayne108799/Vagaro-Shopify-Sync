import '@shopify/ui-extensions/preact';
import { render, h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

const BACKEND_URL = 'https://Beautyoasisadmin.replit.app';

export default function extension() {
  render(h(Extension), document.body);
}

function Extension() {
  var _s1 = useState(true);
  var isLoading = _s1[0];
  var setIsLoading = _s1[1];

  var _s2 = useState([]);
  var appointments = _s2[0];
  var setAppointments = _s2[1];

  var _s3 = useState(null);
  var error = _s3[0];
  var setError = _s3[1];

  var _s4 = useState(null);
  var viewMode = _s4[0];
  var setViewMode = _s4[1];

  var _s5 = useState(null);
  var stylistName = _s5[0];
  var setStylistName = _s5[1];

  useEffect(function() {
    fetchAppointments();
  }, []);

  async function fetchAppointments() {
    try {
      setIsLoading(true);

      var staffParam = '';
      try {
        if (typeof shopify !== 'undefined' && shopify.staff && shopify.staff.current) {
          var staff = await shopify.staff.current();
          if (staff && staff.id) {
            staffParam = '?staffId=' + staff.id;
          }
        }
      } catch (staffErr) {
        console.log('Staff error:', staffErr);
      }

      var url = BACKEND_URL + '/api/pos/pending-appointments' + staffParam;

      var response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors'
      });

      if (!response.ok) throw new Error('HTTP ' + response.status);
      var data = await response.json();
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
    return h('s-page', { title: 'Vagaro Appointments' },
      h('s-scroll-box', null,
        h('s-box', { padding: 'base' },
          h('s-text', null, 'Loading appointments...')
        )
      )
    );
  }

  if (error) {
    return h('s-page', { title: 'Vagaro Appointments' },
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
        items
      )
    )
  );
}
