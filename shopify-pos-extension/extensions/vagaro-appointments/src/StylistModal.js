import '@shopify/ui-extensions/preact';
import { render, h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

const BACKEND_URL = 'https://Beautyoasisadmin.replit.app';

export default function extension() {
  render(h(Extension), document.body);
}

function Extension() {
  var _s1 = useState(null);
  var summary = _s1[0];
  var setSummary = _s1[1];

  var _s2 = useState(true);
  var loading = _s2[0];
  var setLoading = _s2[1];

  var _s3 = useState(null);
  var error = _s3[0];
  var setError = _s3[1];

  var _s4 = useState(null);
  var staffId = _s4[0];
  var setStaffId = _s4[1];

  var _s5 = useState(null);
  var clockStatus = _s5[0];
  var setClockStatus = _s5[1];

  var _s6 = useState(false);
  var clockLoading = _s6[0];
  var setClockLoading = _s6[1];

  useEffect(function() {
    fetchSummary();
  }, []);

  async function fetchSummary() {
    setLoading(true);
    setError(null);

    try {
      var staff = null;
      var savedLinkId = null;

      try {
        savedLinkId = localStorage.getItem('vagaro_stylist_link');
      } catch (e) {}

      try {
        if (typeof shopify !== 'undefined' && shopify.staff && shopify.staff.current) {
          staff = await shopify.staff.current();
        }
      } catch (staffErr) {
        console.log('Staff error:', staffErr);
      }

      var effectiveStaffId = (staff && staff.id) ? staff.id : savedLinkId;

      var url;
      if (!effectiveStaffId) {
        url = BACKEND_URL + '/api/pos/stylist-summary?staffId=unknown';
      } else {
        setStaffId(effectiveStaffId);
        url = BACKEND_URL + '/api/pos/stylist-summary?staffId=' + effectiveStaffId;
        fetchClockStatus(effectiveStaffId);
      }

      var response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors'
      });

      if (!response.ok) throw new Error('HTTP ' + response.status);
      var data = await response.json();
      setError(null);
      setSummary(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchClockStatus(id) {
    try {
      var response = await fetch(BACKEND_URL + '/api/pos/clock-status?staffId=' + id, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors'
      });
      if (response.ok) {
        var data = await response.json();
        setClockStatus(data);
      }
    } catch (err) {
      console.log('Clock status error:', err);
    }
  }

  async function handleClockIn() {
    if (!staffId) return;
    setClockLoading(true);
    try {
      var response = await fetch(BACKEND_URL + '/api/pos/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: staffId })
      });
      var data = await response.json();
      if (response.ok) {
        shopify.toast.show('Clocked in successfully');
        setClockStatus({ found: true, clockedIn: true, clockInTime: data.clockInTime, hoursWorked: '0.00' });
      } else {
        shopify.toast.show(data.error || 'Failed to clock in');
      }
    } catch (err) {
      shopify.toast.show('Failed to clock in');
    } finally {
      setClockLoading(false);
    }
  }

  async function handleClockOut() {
    if (!staffId) return;
    setClockLoading(true);
    try {
      var response = await fetch(BACKEND_URL + '/api/pos/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: staffId })
      });
      var data = await response.json();
      if (response.ok) {
        shopify.toast.show('Clocked out - ' + data.hoursWorked + ' hours');
        setClockStatus({ found: true, clockedIn: false });
        fetchSummary();
      } else {
        shopify.toast.show(data.error || 'Failed to clock out');
      }
    } catch (err) {
      shopify.toast.show('Failed to clock out');
    } finally {
      setClockLoading(false);
    }
  }

  async function linkStylist(stylistId) {
    try {
      var response = await fetch(BACKEND_URL + '/api/pos/link-stylist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stylistId: stylistId, shopifyStaffId: staffId })
      });

      if (!response.ok) throw new Error('Failed to link');

      var data = await response.json();
      if (data.linkId) {
        try {
          localStorage.setItem('vagaro_stylist_link', data.linkId);
          setStaffId(data.linkId);
        } catch (e) {}
      }

      shopify.toast.show('Account linked successfully');
      fetchSummary();
    } catch (err) {
      shopify.toast.show('Failed to link account');
    }
  }

  async function addToCart(appointment) {
    try {
      if (appointment.shopifyProductVariantId) {
        await shopify.cart.addLineItem({
          variantId: appointment.shopifyProductVariantId,
          quantity: 1
        });
      } else {
        await shopify.cart.addCustomSale({
          title: appointment.serviceName,
          price: appointment.amount,
          quantity: 1,
          taxable: false
        });
      }

      await fetch(BACKEND_URL + '/api/pos/mark-loaded/' + appointment.id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      shopify.toast.show('Added ' + appointment.serviceName + ' to cart');
      fetchSummary();
    } catch (err) {
      shopify.toast.show('Failed to add to cart');
    }
  }

  function formatTime(isoString) {
    if (!isoString) return '';
    var d = new Date(isoString);
    var hours = d.getHours();
    var mins = d.getMinutes();
    var ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return hours + ':' + (mins < 10 ? '0' : '') + mins + ' ' + ampm;
  }

  if (loading) {
    return h('s-page', { title: 'My Earnings' },
      h('s-scroll-box', null,
        h('s-box', { padding: 'base' },
          h('s-text', null, 'Loading...')
        )
      )
    );
  }

  if (error) {
    return h('s-page', { title: 'My Earnings' },
      h('s-scroll-box', null,
        h('s-box', { padding: 'base' },
          h('s-banner', { status: 'critical', title: 'Error' }, error),
          h('s-button', { onClick: fetchSummary }, 'Retry')
        )
      )
    );
  }

  if (!summary || !summary.found) {
    var stylists = summary && summary.availableStylists ? summary.availableStylists : [];

    return h('s-page', { title: 'Link Your Account' },
      h('s-scroll-box', null,
        h('s-box', { padding: 'base' },
          h('s-text', { variant: 'headingMd' }, 'Select Your Name'),
          h('s-text', null, 'Link your POS account to track your earnings'),
          h('s-box', { paddingBlockStart: 'base' },
            stylists.length === 0
              ? h('s-text', null, 'No stylists available. Add stylists in the admin dashboard.')
              : stylists.map(function(s) {
                  return h('s-section', { key: s.id },
                    h('s-box', { padding: 'base' },
                      h('s-text', { variant: 'headingMd' }, s.name),
                      s.hasShopifyLink
                        ? h('s-text', null, '(Already linked)')
                        : h('s-button', { onClick: function() { linkStylist(s.id); } }, 'This is me')
                    )
                  );
                })
          )
        )
      )
    );
  }

  var stylist = summary.stylist;
  var today = summary.today;
  var period = summary.payPeriod;
  var pending = summary.pendingAppointments || [];

  return h('s-page', { title: stylist.name },
    h('s-scroll-box', null,
      h('s-box', { padding: 'base' },

        h('s-section', { heading: 'Time Clock' },
          h('s-box', { padding: 'base' },
            clockStatus && clockStatus.clockedIn
              ? h('s-box', null,
                  h('s-badge', { tone: 'success' }, 'Clocked In'),
                  h('s-text', null, 'Since ' + formatTime(clockStatus.clockInTime)),
                  h('s-text', null, clockStatus.hoursWorked + ' hours today'),
                  h('s-box', { paddingBlockStart: 'tight' },
                    h('s-button', {
                      onClick: handleClockOut,
                      disabled: clockLoading,
                      variant: 'destructive'
                    }, clockLoading ? 'Processing...' : 'Clock Out')
                  )
                )
              : h('s-box', null,
                  h('s-badge', null, 'Clocked Out'),
                  h('s-box', { paddingBlockStart: 'tight' },
                    h('s-button', {
                      onClick: handleClockIn,
                      disabled: clockLoading,
                      variant: 'primary'
                    }, clockLoading ? 'Processing...' : 'Clock In')
                  )
                )
          )
        ),

        h('s-section', { heading: "Today's Earnings" },
          h('s-box', { padding: 'base' },
            h('s-text', { variant: 'headingLg' }, '$' + today.totalEarnings),
            h('s-box', { paddingBlockStart: 'tight' },
              h('s-text', null, 'Sales: $' + today.sales + ' | Tips: $' + today.tips),
              h('s-text', null, 'Commission: $' + today.commission + ' (' + stylist.commissionRate + '%)'),
              h('s-text', null, today.paidOrders + ' paid, ' + today.pendingOrders + ' pending')
            )
          )
        ),

        h('s-section', { heading: 'Pay Period' },
          h('s-box', { padding: 'base' },
            h('s-text', null, period.start + ' to ' + period.end),
            h('s-text', { variant: 'headingLg' }, '$' + period.totalEarnings),
            h('s-box', { paddingBlockStart: 'tight' },
              h('s-text', null, 'Sales: $' + period.sales),
              h('s-text', null, 'Commission: $' + period.commission),
              h('s-text', null, 'Tips: $' + period.tips),
              stylist.hourlyRate !== '0' && stylist.hourlyRate !== null
                ? h('s-text', null, 'Hourly: $' + period.hourlyEarnings + ' (' + period.hoursWorked + ' hrs)')
                : null,
              h('s-text', null, period.orderCount + ' orders')
            )
          )
        ),

        pending.length > 0 && h('s-section', { heading: 'Your Pending Appointments' },
          h('s-box', { padding: 'base' },
            pending.map(function(apt) {
              return h('s-box', { key: apt.id, padding: 'base' },
                h('s-text', { variant: 'headingMd' }, apt.customerName),
                h('s-text', null, apt.serviceName),
                h('s-text', { variant: 'headingLg' }, '$' + apt.amount),
                h('s-button', { onClick: function() { addToCart(apt); } }, 'Add to Cart')
              );
            })
          )
        ),

        h('s-box', { paddingBlockStart: 'base' },
          h('s-button', { onClick: fetchSummary }, 'Refresh')
        )
      )
    )
  );
}
