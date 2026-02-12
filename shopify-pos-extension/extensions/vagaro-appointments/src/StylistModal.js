import { Screen, Text, Button, ScrollView, extension } from '@shopify/ui-extensions/point-of-sale';

const BACKEND_URL = 'https://Beautyoasisadmin.replit.app';

export default extension('pos.home.modal.render', (root, api) => {
  var currentStaffId = null;

  var screen = root.createComponent(Screen, { name: 'Main', title: 'My Earnings' });
  var scrollView = root.createComponent(ScrollView);
  screen.append(scrollView);

  scrollView.append(root.createComponent(Text, {}, 'Loading...'));
  root.append(screen);

  fetchSummary();

  async function fetchSummary() {
    try {
      var savedLinkId = null;
      try { savedLinkId = localStorage.getItem('vagaro_stylist_link'); } catch (e) {}

      var staffId = null;
      try {
        var staff = await api.session.currentStaff;
        if (staff && staff.id) staffId = staff.id;
      } catch (e) {}

      var effectiveId = staffId || savedLinkId;
      currentStaffId = effectiveId;

      var url = BACKEND_URL + '/api/pos/stylist-summary?staffId=' + (effectiveId || 'unknown');

      var response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors'
      });

      if (!response.ok) throw new Error('HTTP ' + response.status);
      var data = await response.json();

      scrollView.replaceChildren();

      if (!data.found) {
        renderLinkScreen(data.availableStylists || []);
        return;
      }

      screen.updateProps({ title: data.stylist.name });

      if (currentStaffId) {
        renderClockSection(currentStaffId);
      }

      renderEarnings(data);
    } catch (err) {
      scrollView.replaceChildren();
      scrollView.append(root.createComponent(Text, {}, 'Error: ' + err.message));
      scrollView.append(root.createComponent(Button, { title: 'Retry', onPress: fetchSummary }));
    }
  }

  function renderLinkScreen(stylists) {
    screen.updateProps({ title: 'Link Your Account' });
    scrollView.append(root.createComponent(Text, {}, 'Select your name to link your account:'));

    stylists.forEach(function(s) {
      if (s.hasShopifyLink) {
        scrollView.append(root.createComponent(Text, {}, s.name + ' (Already linked)'));
      } else {
        scrollView.append(root.createComponent(Button, {
          title: s.name + ' - This is me',
          onPress: function() { linkStylist(s.id); }
        }));
      }
    });
  }

  async function linkStylist(stylistId) {
    try {
      var response = await fetch(BACKEND_URL + '/api/pos/link-stylist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stylistId: stylistId, shopifyStaffId: currentStaffId })
      });
      if (!response.ok) throw new Error('Failed');
      var data = await response.json();
      if (data.linkId) {
        try { localStorage.setItem('vagaro_stylist_link', data.linkId); currentStaffId = data.linkId; } catch (e) {}
      }
      api.toast.show('Account linked!');
      fetchSummary();
    } catch (err) {
      api.toast.show('Failed to link account');
    }
  }

  async function renderClockSection(staffIdParam) {
    try {
      var response = await fetch(BACKEND_URL + '/api/pos/clock-status?staffId=' + staffIdParam, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors'
      });
      if (!response.ok) return;
      var clockData = await response.json();

      scrollView.append(root.createComponent(Text, {}, '--- Time Clock ---'));

      if (clockData.clockedIn) {
        scrollView.append(root.createComponent(Text, {}, 'Status: CLOCKED IN'));
        if (clockData.clockInTime) {
          scrollView.append(root.createComponent(Text, {}, 'Since ' + formatTime(clockData.clockInTime)));
        }
        if (clockData.hoursWorked) {
          scrollView.append(root.createComponent(Text, {}, clockData.hoursWorked + ' hours today'));
        }
        scrollView.append(root.createComponent(Button, {
          title: 'Clock Out',
          onPress: async function() {
            try {
              var res = await fetch(BACKEND_URL + '/api/pos/clock-out', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staffId: staffIdParam })
              });
              var result = await res.json();
              if (res.ok) {
                api.toast.show('Clocked out - ' + result.hoursWorked + ' hours');
                fetchSummary();
              }
            } catch (e) { api.toast.show('Failed to clock out'); }
          }
        }));
      } else {
        scrollView.append(root.createComponent(Text, {}, 'Status: CLOCKED OUT'));
        scrollView.append(root.createComponent(Button, {
          title: 'Clock In',
          onPress: async function() {
            try {
              var res = await fetch(BACKEND_URL + '/api/pos/clock-in', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staffId: staffIdParam })
              });
              var result = await res.json();
              if (res.ok) {
                api.toast.show('Clocked in!');
                fetchSummary();
              }
            } catch (e) { api.toast.show('Failed to clock in'); }
          }
        }));
      }
    } catch (e) {}
  }

  function renderEarnings(data) {
    var today = data.today;
    var period = data.payPeriod;
    var stylist = data.stylist;
    var pending = data.pendingAppointments || [];

    scrollView.append(root.createComponent(Text, {}, "--- Today's Earnings ---"));
    scrollView.append(root.createComponent(Text, {}, '$' + today.totalEarnings));
    scrollView.append(root.createComponent(Text, {}, 'Sales: $' + today.sales + ' | Tips: $' + today.tips));
    scrollView.append(root.createComponent(Text, {}, 'Commission: $' + today.commission + ' (' + stylist.commissionRate + '%)'));
    scrollView.append(root.createComponent(Text, {}, today.paidOrders + ' paid, ' + today.pendingOrders + ' pending'));

    scrollView.append(root.createComponent(Text, {}, '--- Pay Period ---'));
    scrollView.append(root.createComponent(Text, {}, period.start + ' to ' + period.end));
    scrollView.append(root.createComponent(Text, {}, '$' + period.totalEarnings));
    scrollView.append(root.createComponent(Text, {}, 'Sales: $' + period.sales + ' | Commission: $' + period.commission + ' | Tips: $' + period.tips));
    if (stylist.hourlyRate !== '0' && stylist.hourlyRate !== null) {
      scrollView.append(root.createComponent(Text, {}, 'Hourly: $' + period.hourlyEarnings + ' (' + period.hoursWorked + ' hrs)'));
    }
    scrollView.append(root.createComponent(Text, {}, period.orderCount + ' orders'));

    if (pending.length > 0) {
      scrollView.append(root.createComponent(Text, {}, '--- Your Pending Appointments ---'));
      pending.forEach(function(apt) {
        scrollView.append(root.createComponent(Text, {}, apt.customerName + ' - ' + apt.serviceName + ' - $' + apt.amount));
        scrollView.append(root.createComponent(Button, {
          title: 'Add to Cart',
          onPress: function() { addToCart(apt); }
        }));
      });
    }

    scrollView.append(root.createComponent(Button, { title: 'Refresh', onPress: fetchSummary }));
  }

  async function addToCart(apt) {
    try {
      if (apt.shopifyProductVariantId) {
        await api.cart.addLineItem({ variantId: apt.shopifyProductVariantId, quantity: 1 });
      } else {
        await api.cart.addCustomSale({ title: apt.serviceName, price: apt.amount, quantity: 1, taxable: false });
      }
      await fetch(BACKEND_URL + '/api/pos/mark-loaded/' + apt.id, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      api.toast.show('Added ' + apt.serviceName);
      fetchSummary();
    } catch (err) { api.toast.show('Failed to add to cart'); }
  }

  function formatTime(isoString) {
    if (!isoString) return '';
    var d = new Date(isoString);
    var h = d.getHours(), m = d.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; h = h ? h : 12;
    return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
  }
});
