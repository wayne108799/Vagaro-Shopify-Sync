import '@shopify/ui-extensions/preact';
import { render } from 'preact';

export default function extension() {
  render(<TileComponent />, document.body);
}

function TileComponent() {
  return (
    <s-tile
      title="Vagaro Appointments"
      subtitle="View pending appointments"
      enabled
      onClick={() => shopify.action.presentModal()}
    />
  );
}
