/** @jsxImportSource preact */
import { render, h } from 'preact';

export default async () => {
  render(h(Extension, null), document.body);
}

function Extension() {
  return h('s-tile', {
    heading: 'Vagaro Appointments',
    subheading: 'View pending appointments',
    onClick: () => shopify.action.presentModal()
  });
}
