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
  var _s6 = useState(null); var editingId = _s6[0]; var setEditingId = _s6[1];
  var _s7 = useState(''); var editPrice = _s7[0]; var setEditPrice = _s7[1];
  var _s8 = useState(null); var addingId = _s8[0]; var setAddingId = _s8[1];

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

  function startEditPrice(apt) {
    setEditingId(apt.id);
    setEditPrice(apt.amount || '');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditPrice('');
  }

  async function savePrice(apt) {
    var newPrice = parseFloat(editPrice);
    if (isNaN(newPrice) || newPrice < 0) {
      shopify.toast.show('Please enter a valid price');
      return;
    }
    try {
      await fetch(BACKEND_URL + '/api/pos/update-price/' + apt.id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        body: JSON.stringify({ price: newPrice.toFixed(2) })
      });
      setEditingId(null);
      setEditPrice('');
      fetchAppointments();
      shopify.toast.show('Price updated to $' + newPrice.toFixed(2));
    } catch (e) {
      shopify.toast.show('Failed to update price');
    }
  }

  async function addToCart(apt) {
    var price = parseFloat(apt.amount);
    if (price <= 0) {
      startEditPrice(apt);
      shopify.toast.show('Please set a price before adding to cart');
      return;
    }

    try {
      setAddingId(apt.id);
      var markRes = await fetch(BACKEND_URL + '/api/pos/mark-loaded/' + apt.id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        body: JSON.stringify({ price: apt.amount })
      });
      var markData = await markRes.json();
      var vid = markData.variantId || apt.shopifyProductVariantId;

      if (!vid) {
        shopify.toast.show('Could not find Shopify product for ' + apt.serviceName);
        setAddingId(null);
        return;
      }
      await shopify.cart.addLineItem({ variantId: vid, quantity: 1, price: parseFloat(apt.amount) });

      shopify.toast.show('Added ' + apt.serviceName + ' to cart');
      fetchAppointments();
    } catch (err) {
      shopify.toast.show('Failed to add to cart');
    } finally {
      setAddingId(null);
    }
  }

  async function addToCartWithPrice(apt) {
    var newPrice = parseFloat(editPrice);
    if (isNaN(newPrice) || newPrice <= 0) {
      shopify.toast.show('Please enter a valid price greater than $0');
      return;
    }
    try {
      setAddingId(apt.id);
      await fetch(BACKEND_URL + '/api/pos/update-price/' + apt.id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        body: JSON.stringify({ price: newPrice.toFixed(2) })
      });

      var markRes = await fetch(BACKEND_URL + '/api/pos/mark-loaded/' + apt.id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        body: JSON.stringify({ price: newPrice.toFixed(2) })
      });
      var markData = await markRes.json();
      var vid = markData.variantId || apt.shopifyProductVariantId;

      if (!vid) {
        shopify.toast.show('Could not find Shopify product for ' + apt.serviceName);
        setAddingId(null);
        return;
      }
      await shopify.cart.addLineItem({ variantId: vid, quantity: 1, price: newPrice });

      setEditingId(null);
      setEditPrice('');
      shopify.toast.show('Added ' + apt.serviceName + ' ($' + newPrice.toFixed(2) + ') to cart');
      fetchAppointments();
    } catch (e) {
      shopify.toast.show('Failed to add to cart');
    } finally {
      setAddingId(null);
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
    var isEditing = editingId === apt.id;
    var isAdding = addingId === apt.id;
    var isZeroPrice = parseFloat(apt.amount) <= 0;

    if (isEditing) {
      return h('s-section', { key: apt.id },
        h('s-box', { padding: 'base' },
          h('s-text', { variant: 'headingMd' }, apt.customerName),
          h('s-text', null, apt.serviceName),
          viewMode === 'manager' ? h('s-text', null, 'Stylist: ' + apt.stylistName) : null,
          h('s-box', { paddingBlockStart: 'small' },
            h('s-text', { variant: 'bodyMd' }, isZeroPrice ? 'Enter price for this service:' : 'Edit price:'),
            h('s-text-field', {
              type: 'number',
              value: editPrice,
              label: 'Price ($)',
              onChange: function(val) { setEditPrice(val); }
            }),
            h('s-box', { paddingBlockStart: 'small', inlineAlignment: 'trailing' },
              h('s-button', {
                onClick: function() { addToCartWithPrice(apt); },
                disabled: isAdding
              }, isAdding ? 'Adding...' : 'Set Price & Add to Cart'),
              h('s-button', { kind: 'plain', onClick: cancelEdit }, 'Cancel')
            )
          )
        )
      );
    }

    return h('s-section', { key: apt.id },
      h('s-box', { padding: 'base' },
        h('s-text', { variant: 'headingMd' }, apt.customerName),
        h('s-text', null, apt.serviceName),
        viewMode === 'manager' ? h('s-text', null, 'Stylist: ' + apt.stylistName) : null,
        h('s-text', { variant: 'headingLg' }, isZeroPrice ? '$0.00 - Price Required' : '$' + apt.amount),
        h('s-box', { paddingBlockStart: 'small', inlineAlignment: 'trailing' },
          h('s-button', {
            onClick: function() { addToCart(apt); },
            disabled: isAdding
          }, isAdding ? 'Adding...' : 'Add to Cart'),
          h('s-button', { kind: 'plain', onClick: function() { startEditPrice(apt); } }, 'Edit Price')
        )
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
