import '@shopify/ui-extensions/preact';
import { render, h } from 'preact';

export default function extension() {
  render(h(Extension), document.body);
}

function Extension() {
  return h('s-tile', {
    title: 'Vagaro Appointments',
    subtitle: 'View pending appointments',
    onPress: function() { shopify.action.presentModal(); },
    enabled: true
  });
}
