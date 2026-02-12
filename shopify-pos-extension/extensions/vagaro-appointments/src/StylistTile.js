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

  useEffect(function() {
    fetchSummary();
    var interval = setInterval(fetchSummary, 60000);
    return function() { clearInterval(interval); };
  }, []);

  async function fetchSummary() {
    setLoading(true);
    setError(null);

    try {
      var staff = null;
      try {
        if (typeof shopify !== 'undefined' && shopify.staff && shopify.staff.current) {
          staff = await shopify.staff.current();
        }
      } catch (staffErr) {
        console.log('Could not get staff info:', staffErr);
      }

      var staffParam = (staff && staff.id) ? staff.id : 'unknown';

      var response = await fetch(BACKEND_URL + '/api/pos/stylist-summary?staffId=' + staffParam, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors'
      });

      if (!response.ok) throw new Error('Failed to fetch');
      var data = await response.json();
      setError(null);
      setSummary(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return h('s-tile', {
      title: 'My Earnings',
      subtitle: 'Loading...',
      enabled: false
    });
  }

  if (error || !summary) {
    return h('s-tile', {
      title: 'My Earnings',
      subtitle: 'Tap to retry',
      onPress: function() { fetchSummary(); },
      enabled: true
    });
  }

  if (!summary.found) {
    return h('s-tile', {
      title: 'My Earnings',
      subtitle: 'Not linked',
      onPress: function() { shopify.action.presentModal(); },
      enabled: true
    });
  }

  var todayEarnings = summary.today ? '$' + summary.today.totalEarnings : '$0';
  var pendingCount = summary.today ? summary.today.pendingOrders : 0;
  var subtitle = todayEarnings + ' today';
  if (pendingCount > 0) {
    subtitle = subtitle + ' (' + pendingCount + ' pending)';
  }

  return h('s-tile', {
    title: summary.stylist.name,
    subtitle: subtitle,
    onPress: function() { shopify.action.presentModal(); },
    enabled: true
  });
}
