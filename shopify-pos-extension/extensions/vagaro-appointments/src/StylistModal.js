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

  function fmtMoney(val) {
    var n = parseFloat(val || '0');
    return '$' + n.toFixed(2);
  }

  function fmtDateRange(start, end) {
    if (!start || !end) return '';
    var s = start.split('-'), e = end.split('-');
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[parseInt(s[1])-1] + ' ' + parseInt(s[2]) + ' - ' + months[parseInt(e[1])-1] + ' ' + parseInt(e[2]);
  }

  if (!loggedInStylistId) {
    return h('s-page', { title: 'My Earnings' },
      h('s-scroll-box', null,
        h('s-box', { padding: 'loose' },
          h('s-box', { padding: 'base' },
            h('s-text', { variant: 'headingLg' }, 'Welcome Back'),
            h('s-text', { variant: 'bodyMd' }, 'Enter your PIN to view your earnings')
          ),
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
          pinError ? h('s-box', { padding: 'tight' },
            h('s-banner', { status: 'critical' }, pinError)
          ) : null,
          pin.length >= 4 ? h('s-box', { padding: 'base' },
            h('s-button', {
              variant: 'primary',
              disabled: pinLoading,
              onClick: verifyPin
            }, pinLoading ? 'Verifying...' : 'Log In')
          ) : null
        )
      )
    );
  }

  if (loading) {
    return h('s-page', { title: 'My Earnings' },
      h('s-scroll-box', null,
        h('s-box', { padding: 'loose' },
          h('s-text', { variant: 'headingMd' }, 'Loading your dashboard...')
        )
      )
    );
  }

  if (error) {
    return h('s-page', { title: 'My Earnings' },
      h('s-scroll-box', null,
        h('s-box', { padding: 'loose' },
          h('s-banner', { status: 'critical', title: 'Connection Error' }, error),
          h('s-box', { padding: 'base' },
            h('s-button', { variant: 'primary', onClick: function() { fetchSummary(loggedInStylistId); } }, 'Try Again')
          ),
          h('s-box', { padding: 'tight' },
            h('s-button', { onClick: handleLogout }, 'Log Out')
          )
        )
      )
    );
  }

  if (!summary || !summary.found) {
    return h('s-page', { title: 'My Earnings' },
      h('s-scroll-box', null,
        h('s-box', { padding: 'loose' },
          h('s-banner', { status: 'critical' }, 'Could not load your data'),
          h('s-box', { padding: 'base' },
            h('s-button', { onClick: handleLogout }, 'Try Again')
          )
        )
      )
    );
  }

  var sty = summary.stylist, today = summary.today, period = summary.payPeriod, pending = summary.pendingAppointments || [];

  return h('s-page', { title: 'My Earnings' },
    h('s-scroll-box', null,

      h('s-box', { padding: 'loose' },
        h('s-text', { variant: 'headingXl' }, sty.name),
        h('s-badge', { tone: 'info' }, sty.role || 'Stylist'),
        h('s-text', { variant: 'bodySm' }, sty.commissionRate + '% commission rate')
      ),

      h('s-section', { heading: 'Time Clock' },
        clockStatus && clockStatus.clockedIn
          ? h('s-box', { padding: 'base' },
              h('s-badge', { tone: 'success' }, 'Clocked In'),
              h('s-text', { variant: 'bodyMd' }, 'Since ' + fmtTime(clockStatus.clockInTime)),
              h('s-text', { variant: 'bodySm' }, (clockStatus.hoursWorked || '0') + ' hours today'),
              h('s-box', { padding: 'base' },
                h('s-button', { variant: 'destructive', disabled: clockLoading, onClick: handleClockOut },
                  clockLoading ? 'Processing...' : 'Clock Out'
                )
              )
            )
          : h('s-box', { padding: 'base' },
              h('s-badge', null, 'Not Clocked In'),
              h('s-box', { padding: 'base' },
                h('s-button', { variant: 'primary', disabled: clockLoading, onClick: handleClockIn },
                  clockLoading ? 'Processing...' : 'Clock In'
                )
              )
            )
      ),

      h('s-section', { heading: "Today's Earnings" },
        h('s-box', { padding: 'base' },
          h('s-text', { variant: 'headingXl' }, fmtMoney(today.totalEarnings)),
          h('s-box', { padding: 'tight' },
            h('s-text', { variant: 'bodyMd' }, 'Sales: ' + fmtMoney(today.sales)),
            h('s-text', { variant: 'bodyMd' }, 'Commission: ' + fmtMoney(today.commission)),
            h('s-text', { variant: 'bodyMd' }, 'Tips: ' + fmtMoney(today.tips))
          ),
          h('s-box', { padding: 'tight' },
            h('s-badge', { tone: 'success' }, today.paidOrders + ' completed'),
            today.pendingOrders > 0 ? h('s-badge', { tone: 'warning' }, today.pendingOrders + ' pending') : null
          )
        )
      ),

      h('s-section', { heading: 'Pay Period  \u2022  ' + fmtDateRange(period.start, period.end) },
        h('s-box', { padding: 'base' },
          h('s-text', { variant: 'headingXl' }, fmtMoney(period.totalEarnings)),
          h('s-text', { variant: 'bodySm' }, period.orderCount + ' orders'),
          h('s-box', { padding: 'tight' },
            h('s-text', { variant: 'bodyMd' }, 'Sales: ' + fmtMoney(period.sales)),
            h('s-text', { variant: 'bodyMd' }, 'Commission: ' + fmtMoney(period.commission)),
            h('s-text', { variant: 'bodyMd' }, 'Tips: ' + fmtMoney(period.tips))
          ),
          sty.hourlyRate !== '0' && sty.hourlyRate !== null
            ? h('s-box', { padding: 'tight' },
                h('s-text', { variant: 'bodyMd' }, 'Hourly: ' + fmtMoney(period.hourlyEarnings) + ' (' + period.hoursWorked + ' hrs)')
              )
            : null
        )
      ),

      pending.length > 0
        ? h('s-section', { heading: 'Pending Appointments (' + pending.length + ')' },
            pending.map(function(apt) {
              return h('s-box', { key: apt.id, padding: 'base' },
                h('s-box', { padding: 'tight' },
                  h('s-text', { variant: 'headingMd' }, apt.customerName),
                  h('s-text', { variant: 'bodySm' }, apt.serviceName)
                ),
                h('s-box', { padding: 'tight' },
                  h('s-text', { variant: 'headingLg' }, fmtMoney(apt.amount)),
                  h('s-button', { variant: 'primary', onClick: function() { addToCart(apt); } }, 'Add to Cart')
                )
              );
            })
          )
        : null,

      h('s-box', { padding: 'loose' },
        h('s-button', { onClick: function() { fetchSummary(loggedInStylistId); } }, 'Refresh'),
        h('s-box', { padding: 'base' },
          h('s-button', { variant: 'destructive', onClick: handleLogout }, 'Log Out')
        )
      )

    )
  );
}
