import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';

var BACKEND_URL = 'https://Beautyoasisadmin.replit.app';

export default function extension() {
  render(<StylistModalComponent />, document.body);
}

function StylistModalComponent() {
  var _s1 = useState(null); var summary = _s1[0]; var setSummary = _s1[1];
  var _s2 = useState(true); var loading = _s2[0]; var setLoading = _s2[1];
  var _s3 = useState(null); var error = _s3[0]; var setError = _s3[1];
  var _s4 = useState(null); var staffId = _s4[0]; var setStaffId = _s4[1];
  var _s5 = useState(null); var clockStatus = _s5[0]; var setClockStatus = _s5[1];
  var _s6 = useState(false); var clockLoading = _s6[0]; var setClockLoading = _s6[1];

  useEffect(function() { fetchSummary(); }, []);

  async function fetchSummary() {
    setLoading(true); setError(null);
    try {
      var savedLink = null;
      try { savedLink = localStorage.getItem('vagaro_stylist_link'); } catch (e) {}

      var sid = null;
      try {
        var staff = await shopify.staff.current();
        if (staff && staff.id) sid = staff.id;
      } catch (e) {}

      var effectiveId = sid || savedLink;
      setStaffId(effectiveId);

      var url = BACKEND_URL + '/api/pos/stylist-summary?staffId=' + (effectiveId || 'unknown');
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
    if (!staffId) return; setClockLoading(true);
    try {
      var r = await fetch(BACKEND_URL + '/api/pos/clock-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staffId: staffId }) });
      var d = await r.json();
      if (r.ok) { shopify.toast.show('Clocked in!'); setClockStatus({ found: true, clockedIn: true, clockInTime: d.clockInTime, hoursWorked: '0.00' }); }
      else shopify.toast.show(d.error || 'Failed');
    } catch (e) { shopify.toast.show('Failed to clock in'); }
    finally { setClockLoading(false); }
  }

  async function handleClockOut() {
    if (!staffId) return; setClockLoading(true);
    try {
      var r = await fetch(BACKEND_URL + '/api/pos/clock-out', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staffId: staffId }) });
      var d = await r.json();
      if (r.ok) { shopify.toast.show('Clocked out - ' + d.hoursWorked + ' hrs'); setClockStatus({ found: true, clockedIn: false }); fetchSummary(); }
      else shopify.toast.show(d.error || 'Failed');
    } catch (e) { shopify.toast.show('Failed to clock out'); }
    finally { setClockLoading(false); }
  }

  async function linkStylist(stylistId) {
    try {
      var r = await fetch(BACKEND_URL + '/api/pos/link-stylist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stylistId: stylistId, shopifyStaffId: staffId }) });
      if (!r.ok) throw new Error('Failed');
      var d = await r.json();
      if (d.linkId) { try { localStorage.setItem('vagaro_stylist_link', d.linkId); setStaffId(d.linkId); } catch (e) {} }
      shopify.toast.show('Account linked!');
      fetchSummary();
    } catch (e) { shopify.toast.show('Failed to link'); }
  }

  async function addToCart(apt) {
    try {
      if (apt.shopifyProductVariantId) await shopify.cart.addLineItem({ variantId: apt.shopifyProductVariantId, quantity: 1 });
      else await shopify.cart.addCustomSale({ title: apt.serviceName, price: apt.amount, quantity: 1, taxable: false });
      await fetch(BACKEND_URL + '/api/pos/mark-loaded/' + apt.id, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      shopify.toast.show('Added ' + apt.serviceName); fetchSummary();
    } catch (e) { shopify.toast.show('Failed to add'); }
  }

  function fmtTime(iso) {
    if (!iso) return '';
    var d = new Date(iso), h = d.getHours(), m = d.getMinutes(), ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12; h = h || 12;
    return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
  }

  if (loading) return <s-page title="My Earnings"><s-scroll-box><s-box padding="base"><s-text>Loading...</s-text></s-box></s-scroll-box></s-page>;

  if (error) return (
    <s-page title="My Earnings"><s-scroll-box><s-box padding="base">
      <s-banner status="critical" title="Error">{error}</s-banner>
      <s-button onClick={fetchSummary}>Retry</s-button>
    </s-box></s-scroll-box></s-page>
  );

  if (!summary || !summary.found) {
    var stylists = summary && summary.availableStylists ? summary.availableStylists : [];
    return (
      <s-page title="Link Your Account"><s-scroll-box><s-box padding="base">
        <s-text variant="headingMd">Select Your Name</s-text>
        <s-text>Link your POS account to track your earnings</s-text>
        {stylists.map(function(s) {
          return (
            <s-box key={s.id} padding="base">
              <s-text variant="headingMd">{s.name}</s-text>
              {s.hasShopifyLink
                ? <s-text>(Already linked)</s-text>
                : <s-button onClick={function() { linkStylist(s.id); }}>This is me</s-button>
              }
            </s-box>
          );
        })}
      </s-box></s-scroll-box></s-page>
    );
  }

  var sty = summary.stylist, today = summary.today, period = summary.payPeriod, pending = summary.pendingAppointments || [];

  return (
    <s-page title={sty.name}><s-scroll-box><s-box padding="base">

      <s-section heading="Time Clock"><s-box padding="base">
        {clockStatus && clockStatus.clockedIn
          ? <s-box>
              <s-badge tone="success">Clocked In</s-badge>
              <s-text>{'Since ' + fmtTime(clockStatus.clockInTime)}</s-text>
              <s-text>{(clockStatus.hoursWorked || '0') + ' hours today'}</s-text>
              <s-button variant="destructive" disabled={clockLoading} onClick={handleClockOut}>{clockLoading ? 'Processing...' : 'Clock Out'}</s-button>
            </s-box>
          : <s-box>
              <s-badge>Clocked Out</s-badge>
              <s-button variant="primary" disabled={clockLoading} onClick={handleClockIn}>{clockLoading ? 'Processing...' : 'Clock In'}</s-button>
            </s-box>
        }
      </s-box></s-section>

      <s-section heading="Today's Earnings"><s-box padding="base">
        <s-text variant="headingLg">{'$' + today.totalEarnings}</s-text>
        <s-text>{'Sales: $' + today.sales + ' | Tips: $' + today.tips}</s-text>
        <s-text>{'Commission: $' + today.commission + ' (' + sty.commissionRate + '%)'}</s-text>
        <s-text>{today.paidOrders + ' paid, ' + today.pendingOrders + ' pending'}</s-text>
      </s-box></s-section>

      <s-section heading="Pay Period"><s-box padding="base">
        <s-text>{period.start + ' to ' + period.end}</s-text>
        <s-text variant="headingLg">{'$' + period.totalEarnings}</s-text>
        <s-text>{'Sales: $' + period.sales}</s-text>
        <s-text>{'Commission: $' + period.commission}</s-text>
        <s-text>{'Tips: $' + period.tips}</s-text>
        {sty.hourlyRate !== '0' && sty.hourlyRate !== null ? <s-text>{'Hourly: $' + period.hourlyEarnings + ' (' + period.hoursWorked + ' hrs)'}</s-text> : null}
        <s-text>{period.orderCount + ' orders'}</s-text>
      </s-box></s-section>

      {pending.length > 0 &&
        <s-section heading="Your Pending Appointments"><s-box padding="base">
          {pending.map(function(apt) {
            return (
              <s-box key={apt.id} padding="base">
                <s-text variant="headingMd">{apt.customerName}</s-text>
                <s-text>{apt.serviceName}</s-text>
                <s-text variant="headingLg">{'$' + apt.amount}</s-text>
                <s-button onClick={function() { addToCart(apt); }}>Add to Cart</s-button>
              </s-box>
            );
          })}
        </s-box></s-section>
      }

      <s-button onClick={fetchSummary}>Refresh</s-button>
    </s-box></s-scroll-box></s-page>
  );
}
