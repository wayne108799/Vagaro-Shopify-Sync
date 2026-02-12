import { Screen, ScrollView, Navigator, Text, Button, Stack, Section, extension } from '@shopify/ui-extensions/point-of-sale';

const BACKEND_URL = 'https://Beautyoasisadmin.replit.app';

export default extension('pos.home.modal.render', (root, api) => {
  const navigator = root.createComponent(Navigator);
  root.append(navigator);

  const screen = root.createComponent(Screen, { name: 'Main', title: 'Vagaro Appointments' });
  navigator.append(screen);

  const scrollView = root.createComponent(ScrollView);
  screen.append(scrollView);

  const container = root.createComponent(Stack, { direction: 'vertical', paddingVertical: 'base', paddingHorizontal: 'base' });
  scrollView.append(container);

  const loadingText = root.createComponent(Text, {}, 'Loading appointments...');
  container.append(loadingText);

  fetchAppointments();

  async function fetchAppointments() {
    try {
      var staffParam = '';
      try {
        var staff = await api.staff.getCurrent();
        if (staff && staff.id) {
          staffParam = '?staffId=' + staff.id;
        }
      } catch (e) {}

      var url = BACKEND_URL + '/api/pos/pending-appointments' + staffParam;

      var response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors'
      });

      if (!response.ok) throw new Error('HTTP ' + response.status);
      var data = await response.json();
      var appointments = data.appointments || [];
      var viewMode = data.viewMode || 'manager';
      var stylistName = data.stylistName || null;

      container.replaceChildren();

      if (viewMode === 'stylist' && stylistName) {
        screen.updateProps({ title: stylistName + "'s Appointments" });
      } else {
        screen.updateProps({ title: "Today's Appointments" });
      }

      if (appointments.length === 0) {
        container.append(root.createComponent(Text, {}, 'No pending appointments'));
        var refreshBtn = root.createComponent(Button, {
          title: 'Refresh',
          onPress: fetchAppointments,
        });
        container.append(refreshBtn);
        return;
      }

      container.append(root.createComponent(Text, { variant: 'headingLarge' }, appointments.length + ' Pending'));

      appointments.forEach(function(apt) {
        var section = root.createComponent(Section);

        section.append(root.createComponent(Text, { variant: 'headingLarge' }, apt.customerName));
        section.append(root.createComponent(Text, {}, apt.serviceName));
        if (viewMode === 'manager') {
          section.append(root.createComponent(Text, {}, 'Stylist: ' + apt.stylistName));
        }
        section.append(root.createComponent(Text, { variant: 'headingLarge' }, '$' + apt.amount));

        var addBtn = root.createComponent(Button, {
          title: 'Add to Cart',
          onPress: async function() {
            try {
              if (apt.shopifyProductVariantId) {
                await api.cart.addLineItem({
                  variantId: apt.shopifyProductVariantId,
                  quantity: 1,
                });
              } else {
                await api.cart.addCustomSale({
                  title: apt.serviceName,
                  price: apt.amount,
                  quantity: 1,
                  taxable: false,
                });
              }

              await fetch(BACKEND_URL + '/api/pos/mark-loaded/' + apt.id, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
              });

              api.toast.show('Added ' + apt.serviceName + ' to cart');
              fetchAppointments();
            } catch (err) {
              api.toast.show('Failed to add to cart');
            }
          }
        });
        section.append(addBtn);
        container.append(section);
      });

      var refreshBtn = root.createComponent(Button, {
        title: 'Refresh',
        onPress: fetchAppointments,
      });
      container.append(refreshBtn);

    } catch (err) {
      container.replaceChildren();
      container.append(root.createComponent(Text, {}, 'Error: ' + err.message));
      container.append(root.createComponent(Button, {
        title: 'Retry',
        onPress: fetchAppointments,
      }));
    }
  }
});
