import { render, h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

const BACKEND_URL = 'https://Beautyoasisadmin.replit.app';

export default async () => {
  render(h(Extension), document.body);
}

function Extension() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(function() {
    fetchSummary();
    var interval = setInterval(fetchSummary, 60000);
    return function() { clearInterval(interval); };
  }, []);

  async function fetchSummary() {
    try {
      var staff = null;
      try {
        if (typeof shopify !== 'undefined' && shopify.staff && shopify.staff.current) {
          staff = await shopify.staff.current();
        }
      } catch (staffErr) {
        console.log('Could not get staff info:', staffErr);
      }
      
      if (!staff || !staff.id) {
        setSummary({ found: false, message: 'Not signed in' });
        setLoading(false);
        return;
      }

      var response = await fetch(BACKEND_URL + '/api/pos/stylist-summary?staffId=' + staff.id, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Failed to fetch');
      var data = await response.json();
      setSummary(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return h('s-tile', {
      heading: 'My Earnings',
      subheading: 'Loading...'
    });
  }

  if (error || !summary) {
    return h('s-tile', {
      heading: 'My Earnings',
      subheading: 'Tap to retry',
      onClick: function() { fetchSummary(); }
    });
  }

  if (!summary.found) {
    return h('s-tile', {
      heading: 'My Earnings',
      subheading: 'Not linked',
      onClick: function() { shopify.action.presentModal(); }
    });
  }

  var todayEarnings = summary.today ? '$' + summary.today.totalEarnings : '$0';
  var pendingCount = summary.today ? summary.today.pendingOrders : 0;
  var subheading = todayEarnings + ' today';
  if (pendingCount > 0) {
    subheading = subheading + ' (' + pendingCount + ' pending)';
  }

  return h('s-tile', {
    heading: summary.stylist.name,
    subheading: subheading,
    onClick: function() { shopify.action.presentModal(); }
  });
}
