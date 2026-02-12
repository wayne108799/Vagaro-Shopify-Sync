import { Screen, Text, Button, ScrollView, extension } from '@shopify/ui-extensions/point-of-sale';

const BACKEND_URL = 'https://Beautyoasisadmin.replit.app';

export default extension('pos.home.modal.render', (root, api) => {
  var screen = root.createComponent(Screen, { name: 'Main', title: "Today's Appointments" });
  var scrollView = root.createComponent(ScrollView);
  screen.append(scrollView);

  var loadingText = root.createComponent(Text, {}, 'Loading...');
  scrollView.append(loadingText);
  root.append(screen);

  fetchAppointments();

  async function fetchAppointments() {
    try {
      var staffParam = '';
      try {
        var staff = await api.session.currentStaff;
        if (staff && staff.id) {
          staffParam = '?staffId=' + staff.id;
        }
      } catch (e) {}

      var response = await fetch(BACKEND_URL + '/api/pos/pending-appointments' + staffParam, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors'
      });

      if (!response.ok) throw new Error('HTTP ' + response.status);
      var data = await response.json();
      var appointments = data.appointments || [];

      scrollView.replaceChildren();

      if (appointments.length === 0) {
        scrollView.append(root.createComponent(Text, {}, 'No pending appointments'));
        scrollView.append(root.createComponent(Button, { title: 'Refresh', onPress: fetchAppointments }));
        return;
      }

      scrollView.append(root.createComponent(Text, {}, appointments.length + ' Pending'));

      appointments.forEach(function(apt) {
        scrollView.append(root.createComponent(Text, {}, apt.customerName + ' - ' + apt.serviceName));
        scrollView.append(root.createComponent(Text, {}, '$' + apt.amount + (apt.stylistName ? ' (' + apt.stylistName + ')' : '')));
        scrollView.append(root.createComponent(Button, {
          title: 'Add to Cart',
          onPress: function() { addToCart(apt); }
        }));
      });

      scrollView.append(root.createComponent(Button, { title: 'Refresh', onPress: fetchAppointments }));
    } catch (err) {
      scrollView.replaceChildren();
      scrollView.append(root.createComponent(Text, {}, 'Error: ' + err.message));
      scrollView.append(root.createComponent(Button, { title: 'Retry', onPress: fetchAppointments }));
    }
  }

  async function addToCart(apt) {
    try {
      if (apt.shopifyProductVariantId) {
        await api.cart.addLineItem({ variantId: apt.shopifyProductVariantId, quantity: 1 });
      } else {
        await api.cart.addCustomSale({ title: apt.serviceName, price: apt.amount, quantity: 1, taxable: false });
      }
      await fetch(BACKEND_URL + '/api/pos/mark-loaded/' + apt.id, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      api.toast.show('Added ' + apt.serviceName + ' to cart');
      fetchAppointments();
    } catch (err) {
      api.toast.show('Failed to add to cart');
    }
  }
});
