import { Screen, ScrollView, Navigator, Text, Button, Stack, Section, Badge, Banner, extension } from '@shopify/ui-extensions/point-of-sale';

const BACKEND_URL = 'https://Beautyoasisadmin.replit.app';

export default extension('pos.home.modal.render', (root, api) => {
  var currentStaffId = null;

  const navigator = root.createComponent(Navigator);
  root.append(navigator);

  const screen = root.createComponent(Screen, { name: 'Main', title: 'My Earnings' });
  navigator.append(screen);

  const scrollView = root.createComponent(ScrollView);
  screen.append(scrollView);

  const container = root.createComponent(Stack, { direction: 'vertical', paddingVertical: 'base', paddingHorizontal: 'base' });
  scrollView.append(container);

  container.append(root.createComponent(Text, {}, 'Loading...'));

  fetchSummary();

  async function fetchSummary() {
    try {
      var staff = null;
      var savedLinkId = null;

      try {
        savedLinkId = localStorage.getItem('vagaro_stylist_link');
      } catch (e) {}

      try {
        staff = await api.staff.getCurrent();
      } catch (e) {}

      var effectiveStaffId = (staff && staff.id) ? staff.id : savedLinkId;

      var url;
      if (!effectiveStaffId) {
        url = BACKEND_URL + '/api/pos/stylist-summary?staffId=unknown';
      } else {
        currentStaffId = effectiveStaffId;
        url = BACKEND_URL + '/api/pos/stylist-summary?staffId=' + effectiveStaffId;
      }

      var response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors'
      });

      if (!response.ok) throw new Error('HTTP ' + response.status);
      var data = await response.json();

      container.replaceChildren();

      if (!data.found) {
        renderLinkScreen(data.availableStylists || []);
        return;
      }

      screen.updateProps({ title: data.stylist.name });

      if (currentStaffId) {
        await renderClockSection(currentStaffId);
      }

      renderEarnings(data);

    } catch (err) {
      container.replaceChildren();
      container.append(root.createComponent(Text, {}, 'Error: ' + err.message));
      container.append(root.createComponent(Button, { title: 'Retry', onPress: fetchSummary }));
    }
  }

  function renderLinkScreen(stylists) {
    screen.updateProps({ title: 'Link Your Account' });

    container.append(root.createComponent(Text, { variant: 'headingLarge' }, 'Select Your Name'));
    container.append(root.createComponent(Text, {}, 'Link your POS account to track your earnings'));

    if (stylists.length === 0) {
      container.append(root.createComponent(Text, {}, 'No stylists available. Add stylists in the admin dashboard.'));
      return;
    }

    stylists.forEach(function(s) {
      var section = root.createComponent(Section);
      section.append(root.createComponent(Text, { variant: 'headingLarge' }, s.name));

      if (s.hasShopifyLink) {
        section.append(root.createComponent(Text, {}, '(Already linked)'));
      } else {
        section.append(root.createComponent(Button, {
          title: 'This is me',
          onPress: function() { linkStylist(s.id); }
        }));
      }

      container.append(section);
    });
  }

  async function linkStylist(stylistId) {
    try {
      var response = await fetch(BACKEND_URL + '/api/pos/link-stylist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stylistId: stylistId, shopifyStaffId: currentStaffId })
      });

      if (!response.ok) throw new Error('Failed to link');

      var data = await response.json();
      if (data.linkId) {
        try {
          localStorage.setItem('vagaro_stylist_link', data.linkId);
          currentStaffId = data.linkId;
        } catch (e) {}
      }

      api.toast.show('Account linked successfully');
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

      var clockSection = root.createComponent(Section);
      clockSection.append(root.createComponent(Text, { variant: 'headingLarge' }, 'Time Clock'));

      if (clockData.clockedIn) {
        clockSection.append(root.createComponent(Badge, { status: 'success', text: 'Clocked In' }));

        if (clockData.clockInTime) {
          clockSection.append(root.createComponent(Text, {}, 'Since ' + formatTime(clockData.clockInTime)));
        }
        if (clockData.hoursWorked) {
          clockSection.append(root.createComponent(Text, {}, clockData.hoursWorked + ' hours today'));
        }

        clockSection.append(root.createComponent(Button, {
          title: 'Clock Out',
          type: 'destructive',
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
              } else {
                api.toast.show(result.error || 'Failed to clock out');
              }
            } catch (e) {
              api.toast.show('Failed to clock out');
            }
          }
        }));
      } else {
        clockSection.append(root.createComponent(Badge, { text: 'Clocked Out' }));

        clockSection.append(root.createComponent(Button, {
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
                api.toast.show('Clocked in successfully');
                fetchSummary();
              } else {
                api.toast.show(result.error || 'Failed to clock in');
              }
            } catch (e) {
              api.toast.show('Failed to clock in');
            }
          }
        }));
      }

      container.append(clockSection);
    } catch (e) {
      // Clock section is optional, don't fail the whole modal
    }
  }

  function renderEarnings(data) {
    var stylist = data.stylist;
    var today = data.today;
    var period = data.payPeriod;
    var pending = data.pendingAppointments || [];

    // Today's Earnings
    var todaySection = root.createComponent(Section);
    todaySection.append(root.createComponent(Text, { variant: 'headingLarge' }, "Today's Earnings"));
    todaySection.append(root.createComponent(Text, { variant: 'headingLarge' }, '$' + today.totalEarnings));
    todaySection.append(root.createComponent(Text, {}, 'Sales: $' + today.sales + ' | Tips: $' + today.tips));
    todaySection.append(root.createComponent(Text, {}, 'Commission: $' + today.commission + ' (' + stylist.commissionRate + '%)'));
    todaySection.append(root.createComponent(Text, {}, today.paidOrders + ' paid, ' + today.pendingOrders + ' pending'));
    container.append(todaySection);

    // Pay Period
    var periodSection = root.createComponent(Section);
    periodSection.append(root.createComponent(Text, { variant: 'headingLarge' }, 'Pay Period'));
    periodSection.append(root.createComponent(Text, {}, period.start + ' to ' + period.end));
    periodSection.append(root.createComponent(Text, { variant: 'headingLarge' }, '$' + period.totalEarnings));
    periodSection.append(root.createComponent(Text, {}, 'Sales: $' + period.sales));
    periodSection.append(root.createComponent(Text, {}, 'Commission: $' + period.commission));
    periodSection.append(root.createComponent(Text, {}, 'Tips: $' + period.tips));
    if (stylist.hourlyRate !== '0' && stylist.hourlyRate !== null) {
      periodSection.append(root.createComponent(Text, {}, 'Hourly: $' + period.hourlyEarnings + ' (' + period.hoursWorked + ' hrs)'));
    }
    periodSection.append(root.createComponent(Text, {}, period.orderCount + ' orders'));
    container.append(periodSection);

    // Pending Appointments
    if (pending.length > 0) {
      var pendingSection = root.createComponent(Section);
      pendingSection.append(root.createComponent(Text, { variant: 'headingLarge' }, 'Your Pending Appointments'));

      pending.forEach(function(apt) {
        pendingSection.append(root.createComponent(Text, { variant: 'headingLarge' }, apt.customerName));
        pendingSection.append(root.createComponent(Text, {}, apt.serviceName));
        pendingSection.append(root.createComponent(Text, { variant: 'headingLarge' }, '$' + apt.amount));
        pendingSection.append(root.createComponent(Button, {
          title: 'Add to Cart',
          onPress: function() { addToCart(apt); }
        }));
      });

      container.append(pendingSection);
    }

    // Refresh button
    container.append(root.createComponent(Button, { title: 'Refresh', onPress: fetchSummary }));
  }

  async function addToCart(appointment) {
    try {
      if (appointment.shopifyProductVariantId) {
        await api.cart.addLineItem({
          variantId: appointment.shopifyProductVariantId,
          quantity: 1
        });
      } else {
        await api.cart.addCustomSale({
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

      api.toast.show('Added ' + appointment.serviceName + ' to cart');
      fetchSummary();
    } catch (err) {
      api.toast.show('Failed to add to cart');
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
});
