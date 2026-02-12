import { Tile, extension } from '@shopify/ui-extensions/point-of-sale';

const BACKEND_URL = 'https://Beautyoasisadmin.replit.app';

export default extension('pos.home.tile.render', (root, api) => {
  var tile = root.createComponent(Tile, {
    title: 'My Earnings',
    subtitle: 'Loading...',
    enabled: false,
  });
  root.append(tile);

  fetchSummary();

  async function fetchSummary() {
    try {
      var staffId = 'unknown';
      try {
        var staff = await api.session.currentStaff;
        if (staff && staff.id) staffId = staff.id;
      } catch (e) {}

      var response = await fetch(BACKEND_URL + '/api/pos/stylist-summary?staffId=' + staffId, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors'
      });

      if (!response.ok) throw new Error('Failed');
      var data = await response.json();

      if (!data.found) {
        tile.updateProps({ title: 'My Earnings', subtitle: 'Not linked - tap to setup', enabled: true, onPress: function() { api.action.presentModal(); } });
        return;
      }

      var sub = '$' + (data.today ? data.today.totalEarnings : '0') + ' today';
      tile.updateProps({ title: data.stylist.name, subtitle: sub, enabled: true, onPress: function() { api.action.presentModal(); } });
    } catch (err) {
      tile.updateProps({ title: 'My Earnings', subtitle: 'Tap to retry', enabled: true, onPress: fetchSummary });
    }
  }

  setInterval(fetchSummary, 60000);
});
