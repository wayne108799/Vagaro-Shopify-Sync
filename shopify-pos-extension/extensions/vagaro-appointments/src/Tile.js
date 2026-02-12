import '@shopify/ui-extensions/preact';
import { render, h } from 'preact';

export default function extension() {
  render(h(TileComponent), document.body);
}

function TileComponent() {
  return h('s-tile', {
    title: 'Vagaro Appointments',
    subtitle: 'View pending appointments',
    enabled: true,
    onClick: function() { shopify.action.presentModal(); }
  });
}
