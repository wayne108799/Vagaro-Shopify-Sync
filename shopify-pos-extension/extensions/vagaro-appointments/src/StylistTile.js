import { Tile, Text, extension } from '@shopify/ui-extensions/point-of-sale';

const BACKEND_URL = 'https://Beautyoasisadmin.replit.app';

export default extension('pos.home.tile.render', (root, api) => {
  const tile = root.createComponent(Tile, {
    title: 'My Earnings',
    subtitle: 'Loading...',
    enabled: false,
  });
  root.append(tile);

  fetchSummary();

  async function fetchSummary() {
    try {
      var staff = null;
      try {
        staff = await api.staff.getCurrent();
      } catch (e) {}

      var staffParam = (staff && staff.id) ? staff.id : 'unknown';

      var response = await fetch(BACKEND_URL + '/api/pos/stylist-summary?staffId=' + staffParam, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors'
      });

      if (!response.ok) throw new Error('Failed to fetch');
      var data = await response.json();

      if (!data.found) {
        tile.updateProps({
          title: 'My Earnings',
          subtitle: 'Not linked',
          enabled: true,
          onPress: () => { api.action.presentModal(); }
        });
        return;
      }

      var todayEarnings = data.today ? '$' + data.today.totalEarnings : '$0';
      var pendingCount = data.today ? data.today.pendingOrders : 0;
      var subtitle = todayEarnings + ' today';
      if (pendingCount > 0) {
        subtitle = subtitle + ' (' + pendingCount + ' pending)';
      }

      tile.updateProps({
        title: data.stylist.name,
        subtitle: subtitle,
        enabled: true,
        onPress: () => { api.action.presentModal(); }
      });
    } catch (err) {
      tile.updateProps({
        title: 'My Earnings',
        subtitle: 'Tap to retry',
        enabled: true,
        onPress: () => { fetchSummary(); }
      });
    }
  }

  setInterval(fetchSummary, 60000);
});
