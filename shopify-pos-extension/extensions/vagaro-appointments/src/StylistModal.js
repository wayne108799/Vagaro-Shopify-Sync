import { render, h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

const BACKEND_URL = 'https://Beautyoasisadmin.replit.app';

export default async () => {
  render(h(Extension), document.body);
};

function Extension() {
  var _useState = useState(null);
  var summary = _useState[0];
  var setSummary = _useState[1];
  
  var _useState2 = useState(true);
  var loading = _useState2[0];
  var setLoading = _useState2[1];
  
  var _useState3 = useState(null);
  var error = _useState3[0];
  var setError = _useState3[1];
  
  var _useState4 = useState(null);
  var staffId = _useState4[0];
  var setStaffId = _useState4[1];
  
  var _useState5 = useState('');
  var debugInfo = _useState5[0];
  var setDebugInfo = _useState5[1];

  useEffect(function() {
    fetchSummary();
  }, []);

  async function fetchSummary() {
    setLoading(true);
    setError(null);
    setDebugInfo('Starting...');
    
    try {
      var staff = null;
      var savedLinkId = null;
      
      // Check for saved link ID in localStorage
      try {
        savedLinkId = localStorage.getItem('vagaro_stylist_link');
        if (savedLinkId) {
          setDebugInfo('Found saved link: ' + savedLinkId);
        }
      } catch (e) {
        // localStorage might not be available
      }
      
      try {
        if (typeof shopify !== 'undefined' && shopify.staff && shopify.staff.current) {
          staff = await shopify.staff.current();
          setDebugInfo('Got staff: ' + (staff ? staff.id : 'null'));
        } else {
          setDebugInfo('shopify.staff not available');
        }
      } catch (staffErr) {
        setDebugInfo('Staff error: ' + staffErr.message);
      }
      
      // If no staff ID available, use saved link or fetch stylist list for manual selection
      var url;
      var effectiveStaffId = (staff && staff.id) ? staff.id : savedLinkId;
      
      if (!effectiveStaffId) {
        setDebugInfo(function(prev) { return prev + ' | No staff or link, fetching stylist list'; });
        url = BACKEND_URL + '/api/pos/stylist-summary?staffId=unknown';
      } else {
        setStaffId(effectiveStaffId);
        url = BACKEND_URL + '/api/pos/stylist-summary?staffId=' + effectiveStaffId;
      }
      
      setDebugInfo(function(prev) { return prev + ' | Fetching: ' + url; });

      var response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors'
      });

      setDebugInfo(function(prev) { return prev + ' | Status: ' + response.status; });
      
      if (!response.ok) throw new Error('HTTP ' + response.status);
      var data = await response.json();
      setDebugInfo(function(prev) { return prev + ' | Found: ' + data.found; });
      setError(null);
      setSummary(data);
    } catch (err) {
      setDebugInfo(function(prev) { return prev + ' | ERROR: ' + err.message; });
      setError(err.message);
    } finally {
      setLoading(false);
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
      // Store the link ID for future lookups
      if (data.linkId) {
        try {
          localStorage.setItem('vagaro_stylist_link', data.linkId);
          setStaffId(data.linkId);
        } catch (e) {
          // localStorage might not be available
        }
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

  if (loading) {
    return h('s-page', { heading: 'My Earnings' },
      h('s-scroll-box', null,
        h('s-box', { padding: 'base' },
          h('s-text', null, 'Loading...')
        )
      )
    );
  }

  if (error) {
    return h('s-page', { heading: 'My Earnings' },
      h('s-scroll-box', null,
        h('s-box', { padding: 'base' },
          h('s-banner', { status: 'critical', title: 'Error' }, error),
          h('s-text', { variant: 'bodySm' }, debugInfo),
          h('s-button', { onClick: fetchSummary }, 'Retry')
        )
      )
    );
  }

  if (!summary || !summary.found) {
    var stylists = summary && summary.availableStylists ? summary.availableStylists : [];
    
    return h('s-page', { heading: 'Link Your Account' },
      h('s-scroll-box', null,
        h('s-box', { padding: 'base' },
          h('s-text', { variant: 'headingMedium' }, 'Select Your Name'),
          h('s-text', null, 'Link your POS account to track your earnings'),
          h('s-box', { paddingBlockStart: 'base' },
            stylists.length === 0 
              ? h('s-text', null, 'No stylists available. Add stylists in the admin dashboard.')
              : stylists.map(function(s) {
                  return h('s-card', { key: s.id },
                    h('s-box', { padding: 'base' },
                      h('s-text', { variant: 'headingMedium' }, s.name),
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

  return h('s-page', { heading: stylist.name },
    h('s-scroll-box', null,
      h('s-box', { padding: 'base' },
        
        h('s-card', null,
          h('s-box', { padding: 'base' },
            h('s-text', { variant: 'headingMedium' }, "Today's Earnings"),
            h('s-box', { paddingBlockStart: 'tight' },
              h('s-text', { variant: 'headingLarge' }, '$' + today.totalEarnings)
            ),
            h('s-box', { paddingBlockStart: 'tight' },
              h('s-text', null, 'Sales: $' + today.sales + ' | Tips: $' + today.tips),
              h('s-text', null, 'Commission: $' + today.commission + ' (' + stylist.commissionRate + '%)'),
              h('s-text', null, today.paidOrders + ' paid, ' + today.pendingOrders + ' pending')
            )
          )
        ),
        
        h('s-box', { paddingBlockStart: 'base' },
          h('s-card', null,
            h('s-box', { padding: 'base' },
              h('s-text', { variant: 'headingMedium' }, 'Pay Period'),
              h('s-text', null, period.start + ' to ' + period.end),
              h('s-box', { paddingBlockStart: 'tight' },
                h('s-text', { variant: 'headingLarge' }, '$' + period.totalEarnings)
              ),
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
          )
        ),
        
        pending.length > 0 && h('s-box', { paddingBlockStart: 'base' },
          h('s-text', { variant: 'headingMedium' }, 'Your Pending Appointments'),
          pending.map(function(apt) {
            return h('s-card', { key: apt.id },
              h('s-box', { padding: 'base' },
                h('s-text', { variant: 'headingMedium' }, apt.customerName),
                h('s-text', null, apt.serviceName),
                h('s-text', { variant: 'headingLarge' }, '$' + apt.amount),
                h('s-button', { onClick: function() { addToCart(apt); } }, 'Add to Cart')
              )
            );
          })
        ),
        
        h('s-box', { paddingBlockStart: 'base' },
          h('s-button', { onClick: fetchSummary }, 'Refresh')
        )
      )
    )
  );
}
