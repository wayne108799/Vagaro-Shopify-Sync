import '@shopify/ui-extensions/preact';
import { render, h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';

var BACKEND_URL = 'https://Beautyoasisadmin.replit.app';

export default function extension() {
  render(h(StylistModalComponent), document.body);
}

function StylistModalComponent() {
  var _s1 = useState(null); var summary = _s1[0]; var setSummary = _s1[1];
  var _s2 = useState(false); var loading = _s2[0]; var setLoading = _s2[1];
  var _s3 = useState(null); var error = _s3[0]; var setError = _s3[1];
  var _s4 = useState(null); var clockStatus = _s4[0]; var setClockStatus = _s4[1];
  var _s5 = useState(false); var clockLoading = _s5[0]; var setClockLoading = _s5[1];
  var _s6 = useState(''); var pin = _s6[0]; var setPin = _s6[1];
  var _s7 = useState(null); var loggedInStylistId = _s7[0]; var setLoggedInStylistId = _s7[1];
  var _s8 = useState(false); var pinLoading = _s8[0]; var setPinLoading = _s8[1];
  var _s9 = useState(null); var pinError = _s9[0]; var setPinError = _s9[1];

  async function verifyPin() {
    if (!pin || pin.length < 4 || pin.length > 6) {
      setPinError('PIN must be 4-6 digits');
      return;
    }
    setPinLoading(true);
    setPinError(null);
    try {
      var r = await fetch(BACKEND_URL + '/api/pos/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        body: JSON.stringify({ pin: pin })
      });
      if (!r.ok) {
        var errData = {};
        try { errData = await r.json(); } catch (e) {}
        setPinError(errData.error || 'Invalid PIN');
        return;
      }
      var data = await r.json();
      if (data.role === 'admin') {
        setPinError('Admin PIN not supported here');
        return;
      }
      if (data.stylistId) {
        setLoggedInStylistId(data.stylistId);
        setPin('');
        fetchSummary(data.stylistId);
      }
    } catch (e) {
      setPinError('Connection error');
    } finally {
      setPinLoading(false);
    }
  }

  async function fetchSummary(stylistId) {
    setLoading(true); setError(null);
    try {
      var url = BACKEND_URL + '/api/pos/stylist-summary-by-id?stylistId=' + stylistId;
      var response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' }, mode: 'cors' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      var data = await response.json();
      setSummary(data);
      fetchClockStatus(stylistId);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function fetchClockStatus(stylistId) {
    try {
      var r = await fetch(BACKEND_URL + '/api/pos/clock-status?stylistId=' + stylistId, { method: 'GET', headers: { 'Content-Type': 'application/json' }, mode: 'cors' });
      if (r.ok) setClockStatus(await r.json());
    } catch (e) {}
  }

  async function handleClockIn() {
    if (!loggedInStylistId) return;
    setClockLoading(true);
    try {
      var r = await fetch(BACKEND_URL + '/api/pos/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        body: JSON.stringify({ stylistId: loggedInStylistId })
      });
      var d = await r.json();
      if (r.ok) {
        shopify.toast.show('Clocked in!');
        setClockStatus({ found: true, clockedIn: true, clockInTime: d.clockInTime, hoursWorked: '0.00' });
      } else {
        shopify.toast.show(d.error || 'Failed to clock in');
      }
    } catch (e) {
      shopify.toast.show('Clock in error');
    }
    finally { setClockLoading(false); }
  }

  async function handleClockOut() {
    if (!loggedInStylistId) return;
    setClockLoading(true);
    try {
      var r = await fetch(BACKEND_URL + '/api/pos/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        body: JSON.stringify({ stylistId: loggedInStylistId })
      });
      var d = await r.json();
      if (r.ok) {
        shopify.toast.show('Clocked out - ' + d.hoursWorked + ' hrs');
        setClockStatus({ found: true, clockedIn: false });
        fetchSummary(loggedInStylistId);
      } else {
        shopify.toast.show(d.error || 'Failed to clock out');
      }
    } catch (e) {
      shopify.toast.show('Clock out error');
    }
    finally { setClockLoading(false); }
  }

  function handleLogout() {
    setLoggedInStylistId(null);
    setSummary(null);
    setClockStatus(null);
    setPin('');
    setPinError(null);
  }

  async function addToCart(apt) {
    try {
      if (apt.shopifyProductVariantId) await shopify.cart.addLineItem({ variantId: apt.shopifyProductVariantId, quantity: 1 });
      else await shopify.cart.addCustomSale({ title: apt.serviceName, price: apt.amount, quantity: 1, taxable: false });
      await fetch(BACKEND_URL + '/api/pos/mark-loaded/' + apt.id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, mode: 'cors' });
      shopify.toast.show('Added ' + apt.serviceName); fetchSummary(loggedInStylistId);
    } catch (e) { shopify.toast.show('Failed to add'); }
  }

  function fmtTime(iso) {
    if (!iso) return '';
    var d = new Date(iso), hr = d.getHours(), mn = d.getMinutes(), ap = hr >= 12 ? 'PM' : 'AM';
    hr = hr % 12; hr = hr || 12;
    return hr + ':' + (mn < 10 ? '0' : '') + mn + ' ' + ap;
  }

  if (!loggedInStylistId) {
    return h('s-page', { title: 'My Earnings' },
      h('s-scroll-box', null, h('s-box', { padding: 'base' },
        h('s-text', { variant: 'headingMd' }, 'Enter Your PIN'),
        h('s-text', null, 'Enter your stylist PIN to view your earnings'),
        h('s-box', { padding: 'base' },
          h('s-text-field', {
            label: 'PIN',
            type: 'number',
            value: pin,
            maxLength: 6,
            onChange: function(e) {
              var val = (e.currentTarget.value || '').replace(/\D/g, '').slice(0, 6);
              setPin(val);
              if (pinError) setPinError(null);
            }
          })
        ),
        pinError ? h('s-banner', { status: 'critical' }, pinError) : null,
        pin.length >= 4 ? h('s-button', {
          variant: 'primary',
          disabled: pinLoading,
          onClick: verifyPin
        }, pinLoading ? 'Verifying...' : 'Log In (' + pin.length + '-digit PIN)') : null
      ))
    );
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
        h('s-button', { onClick: function() { fetchSummary(loggedInStylistId); } }, 'Retry'),
        h('s-button', { variant: 'destructive', onClick: handleLogout }, 'Log Out')
      ))
    );
  }

  if (!summary || !summary.found) {
    return h('s-page', { title: 'My Earnings' },
      h('s-scroll-box', null, h('s-box', { padding: 'base' },
        h('s-banner', { status: 'critical' }, 'Could not load your data'),
        h('s-button', { onClick: handleLogout }, 'Try Again')
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

      h('s-button', { onClick: function() { fetchSummary(loggedInStylistId); } }, 'Refresh'),
      h('s-box', { padding: 'base' },
        h('s-button', { variant: 'destructive', onClick: handleLogout }, 'Log Out')
      )
    ))
  );
}
