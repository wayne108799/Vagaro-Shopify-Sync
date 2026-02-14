import '@shopify/ui-extensions/preact';
import { render, h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

var BACKEND_URL = 'https://Beautyoasisadmin.replit.app';

export default function extension() {
  render(h(StylistTileComponent), document.body);
}

function StylistTileComponent() {
  var _s = useState({ title: 'My Earnings', subtitle: 'Tap to log in', enabled: true });
  var tileProps = _s[0];
  var setTileProps = _s[1];

  useEffect(function() {
    setTileProps({ title: 'My Earnings', subtitle: 'Tap to log in', enabled: true });
  }, []);

  return h('s-tile', {
    title: tileProps.title,
    subtitle: tileProps.subtitle,
    enabled: tileProps.enabled,
    onClick: function() { shopify.action.presentModal(); }
  });
}
