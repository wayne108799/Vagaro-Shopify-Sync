import '@shopify/ui-extensions/preact';
import { render, h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

var BACKEND_URL = 'https://Beautyoasisadmin.replit.app';

export default function extension() {
  render(h(StylistTileComponent), document.body);
}

function StylistTileComponent() {
  var _s = useState({ title: 'My Earnings', subtitle: 'Loading...', enabled: false });
  var tileProps = _s[0];
  var setTileProps = _s[1];

  useEffect(function() {
    fetchSummary();
    var interval = setInterval(fetchSummary, 60000);
    return function() { clearInterval(interval); };
  }, []);

  async function fetchSummary() {
    try {
      var staffId = null;
      try {
        var staff = await shopify.staff.current();
        if (staff && staff.id) {
          staffId = staff.id;
          try { localStorage.setItem('vagaro_staff_id', staff.id.toString()); } catch (e) {}
        }
      } catch (e) {}

      if (!staffId) {
        try { staffId = localStorage.getItem('vagaro_staff_id'); } catch (e) {}
      }

      if (!staffId) {
        setTileProps({ title: 'My Earnings', subtitle: 'Tap to link', enabled: true });
        return;
      }

      var response = await fetch(BACKEND_URL + '/api/pos/stylist-summary?staffId=' + staffId, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors'
      });
      if (!response.ok) throw new Error('Failed');
      var data = await response.json();

      if (!data.found) {
        setTileProps({ title: 'My Earnings', subtitle: 'Not linked', enabled: true });
        return;
      }

      var sub = '$' + (data.today ? data.today.totalEarnings : '0') + ' today';
      setTileProps({ title: data.stylist.name, subtitle: sub, enabled: true });
    } catch (err) {
      setTileProps({ title: 'My Earnings', subtitle: 'Tap to retry', enabled: true });
    }
  }

  return h('s-tile', {
    title: tileProps.title,
    subtitle: tileProps.subtitle,
    enabled: tileProps.enabled,
    onClick: function() { shopify.action.presentModal(); }
  });
}
