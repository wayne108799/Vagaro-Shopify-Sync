import '@shopify/ui-extensions/preact';
import { render, h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';

var BACKEND_URL = 'https://Beautyoasisadmin.replit.app';

export default function extension() {
  render(h(StylistModalComponent), document.body);
}

function StylistModalComponent() {
  var _s1 = useState(null); var summary = _s1[0]; var setSummary = _s1[1];
  var _s2 = useState(true); var loading = _s2[0]; var setLoading = _s2[1];
  var _s3 = useState(null); var error = _s3[0]; var setError = _s3[1];
  var _s5 = useState(null); var clockStatus = _s5[0]; var setClockStatus = _s5[1];
  var _s6 = useState(false); var clockLoading = _s6[0]; var setClockLoading = _s6[1];

  var currentStaffId = useRef(null);

  useEffect(function() { fetchSummary(); }, []);

  function getEffectiveStaffId() {
    return new Promise(function(resolve) {
      try {
        shopify.staff.current().then(function(staff) {
          if (staff && staff.id) {
            try { localStorage.setItem('vagaro_staff_id', staff.id.toString()); } catch (e) {}
            resolve(staff.id.toString());
          } else {
            var saved = null;
            try { saved = localStorage.getItem('vagaro_staff_id'); } catch (e) {}
            resolve(saved);
          }
        }).catch(function() {
          var saved = null;
          try { saved = localStorage.getItem('vagaro_staff_id'); } catch (e) {}
          resolve(saved);
        });
      } catch (e) {
        var saved = null;
        try { saved = localStorage.getItem('vagaro_staff_id'); } catch (e2) {}
        resolve(saved);
      }
    });
  }

  async function fetchSummary(overrideStaffId) {
    setLoading(true); setError(null);
    try {
      var effectiveId = overrideStaffId || await getEffectiveStaffId();
      currentStaffId.current = effectiveId;

      if (!effectiveId) {
        var url = BACKEND_URL + '/api/pos/stylist-summary?staffId=none';
        var response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' }, mode: 'cors' });
        if (response.ok) {
          var data = await response.json();
          data.noStaffId = true;
          setSummary(data);
        } else {
          setSummary({ found: false, availableStylists: [], noStaffId: true });
        }
        return;
      }

      var url = BACKEND_URL + '/api/pos/stylist-summary?staffId=' + effectiveId;
      var response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' }, mode: 'cors' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      var data = await response.json();
      setSummary(data);

      if (effectiveId && data.found) fetchClockStatus(effectiveId);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function fetchClockStatus(id) {
    try {
      var r = await fetch(BACKEND_URL + '/api/pos/clock-status?staffId=' + id, { method: 'GET', headers: { 'Content-Type': 'application/json' }, mode: 'cors' });
      if (r.ok) setClockStatus(await r.json());
    } catch (e) {}
  }

  async function handleClockIn() {
    var sid = currentStaffId.current;
    if (!sid) { shopify.toast.show('No staff ID found'); return; }
    setClockLoading(true);
    try {
      var r = await fetch(BACKEND_URL + '/api/pos/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        body: JSON.stringify({ staffId: sid })
      });
      var d = await r.json();
      if (r.ok) {
        shopify.toast.show('Clocked in!');
        setClockStatus({ found: true, clockedIn: true, clockInTime: d.clockInTime, hoursWorked: '0.00' });
      } else {
        shopify.toast.show(d.error || 'Failed to clock in');
      }
    } catch (e) {
      shopify.toast.show('Clock in error: ' + (e.message || 'unknown'));
    }
    finally { setClockLoading(false); }
  }

  async function handleClockOut() {
    var sid = currentStaffId.current;
    if (!sid) { shopify.toast.show('No staff ID found'); return; }
    setClockLoading(true);
    try {
      var r = await fetch(BACKEND_URL + '/api/pos/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        body: JSON.stringify({ staffId: sid })
      });
      var d = await r.json();
      if (r.ok) {
        shopify.toast.show('Clocked out - ' + d.hoursWorked + ' hrs');
        setClockStatus({ found: true, clockedIn: false });
        fetchSummary();
      } else {
        shopify.toast.show(d.error || 'Failed to clock out');
      }
    } catch (e) {
      shopify.toast.show('Clock out error: ' + (e.message || 'unknown'));
    }
    finally { setClockLoading(false); }
  }

  async function linkStylist(stylistId) {
    try {
      var sid = await getEffectiveStaffId();
      
      if (!sid) {
        sid = 'pos-' + String(stylistId) + '-' + Date.now();
        try { localStorage.setItem('vagaro_staff_id', sid); } catch (e) {}
      }

      var r = await fetch(BACKEND_URL + '/api/pos/link-stylist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        body: JSON.stringify({ stylistId: stylistId, shopifyStaffId: String(sid) })
      });
      if (!r.ok) {
        var errData = {};
        try { errData = await r.json(); } catch (e) {}
        throw new Error(errData.error || 'Failed');
      }

      currentStaffId.current = sid;

      shopify.toast.show('Account linked!');
      fetchSummary(sid);
    } catch (e) { shopify.toast.show('Link error: ' + (e.message || 'unknown')); }
  }

  async function unlinkStylist() {
    try {
      var sid = currentStaffId.current;
      if (!sid) { shopify.toast.show('No staff ID'); return; }
      var r = await fetch(BACKEND_URL + '/api/pos/unlink-stylist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        body: JSON.stringify({ shopifyStaffId: sid })
      });
      if (r.ok) {
        shopify.toast.show('Account unlinked');
        fetchSummary(sid);
      } else {
        shopify.toast.show('Failed to unlink');
      }
    } catch (e) { shopify.toast.show('Unlink error'); }
  }

  async function addToCart(apt) {
    try {
      if (apt.shopifyProductVariantId) await shopify.cart.addLineItem({ variantId: apt.shopifyProductVariantId, quantity: 1 });
      else await shopify.cart.addCustomSale({ title: apt.serviceName, price: apt.amount, quantity: 1, taxable: false });
      await fetch(BACKEND_URL + '/api/pos/mark-loaded/' + apt.id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, mode: 'cors' });
      shopify.toast.show('Added ' + apt.serviceName); fetchSummary();
    } catch (e) { shopify.toast.show('Failed to add'); }
  }

  function fmtTime(iso) {
    if (!iso) return '';
    var d = new Date(iso), hr = d.getHours(), mn = d.getMinutes(), ap = hr >= 12 ? 'PM' : 'AM';
    hr = hr % 12; hr = hr || 12;
    return hr + ':' + (mn < 10 ? '0' : '') + mn + ' ' + ap;
  }

  if (loading) {
    return h('s-page', { title: 'My Earnings' },
      h('s-scroll-box', null, h('s-box', { padding: 'base' }, h('s-text', null, 'Loading...')))
    );
  }

  if (error) {
    return h('s-page', { title: 'My Earnings' },
      h('s-scroll-box', null, h('s-box', { padding: 'base' },
        h('s-banner', { status: 'critical', title: 'Error' }, error),
        h('s-button', { onClick: function() { fetchSummary(); } }, 'Retry')
      ))
    );
  }

  if (!summary || !summary.found) {
    var stylists = summary && summary.availableStylists ? summary.availableStylists : [];
    return h('s-page', { title: 'Link Your Account' },
      h('s-scroll-box', null, h('s-box', { padding: 'base' },
        h('s-text', { variant: 'headingMd' }, 'Select Your Name'),
        h('s-text', null, 'Link your POS account to track your earnings'),
        stylists.map(function(s) {
          return h('s-box', { key: s.id, padding: 'base' },
            h('s-text', { variant: 'headingMd' }, s.name),
            h('s-button', { onClick: function() { linkStylist(s.id); } }, 'This is me')
          );
        })
      ))
    );
  }

  var sty = summary.stylist, today = summary.today, period = summary.payPeriod, pending = summary.pendingAppointments || [];

  return h('s-page', { title: sty.name },
    h('s-scroll-box', null, h('s-box', { padding: 'base' },

      h('s-section', { heading: 'Time Clock' }, h('s-box', { padding: 'base' },
        clockStatus && clockStatus.clockedIn
          ? [
              h('s-badge', { tone: 'success' }, 'Clocked In'),
              h('s-text', null, 'Since ' + fmtTime(clockStatus.clockInTime)),
              h('s-text', null, (clockStatus.hoursWorked || '0') + ' hours today'),
              h('s-button', { variant: 'destructive', disabled: clockLoading, onClick: handleClockOut }, clockLoading ? 'Processing...' : 'Clock Out')
            ]
          : [
              h('s-badge', null, 'Clocked Out'),
              h('s-button', { variant: 'primary', disabled: clockLoading, onClick: handleClockIn }, clockLoading ? 'Processing...' : 'Clock In')
            ]
      )),

      h('s-section', { heading: "Today's Earnings" }, h('s-box', { padding: 'base' },
        h('s-text', { variant: 'headingLg' }, '$' + today.totalEarnings),
        h('s-text', null, 'Sales: $' + today.sales + ' | Tips: $' + today.tips),
        h('s-text', null, 'Commission: $' + today.commission + ' (' + sty.commissionRate + '%)'),
        h('s-text', null, today.paidOrders + ' paid, ' + today.pendingOrders + ' pending')
      )),

      h('s-section', { heading: 'Pay Period' }, h('s-box', { padding: 'base' },
        h('s-text', null, period.start + ' to ' + period.end),
        h('s-text', { variant: 'headingLg' }, '$' + period.totalEarnings),
        h('s-text', null, 'Sales: $' + period.sales),
        h('s-text', null, 'Commission: $' + period.commission),
        h('s-text', null, 'Tips: $' + period.tips),
        sty.hourlyRate !== '0' && sty.hourlyRate !== null ? h('s-text', null, 'Hourly: $' + period.hourlyEarnings + ' (' + period.hoursWorked + ' hrs)') : null,
        h('s-text', null, period.orderCount + ' orders')
      )),

      pending.length > 0 ? h('s-section', { heading: 'Your Pending Appointments' }, h('s-box', { padding: 'base' },
        pending.map(function(apt) {
          return h('s-box', { key: apt.id, padding: 'base' },
            h('s-text', { variant: 'headingMd' }, apt.customerName),
            h('s-text', null, apt.serviceName),
            h('s-text', { variant: 'headingLg' }, '$' + apt.amount),
            h('s-button', { onClick: function() { addToCart(apt); } }, 'Add to Cart')
          );
        })
      )) : null,

      h('s-button', { onClick: function() { fetchSummary(); } }, 'Refresh'),
      h('s-box', { padding: 'base' },
        h('s-button', { variant: 'destructive', onClick: unlinkStylist }, 'Switch Account')
      )
    ))
  );
}
