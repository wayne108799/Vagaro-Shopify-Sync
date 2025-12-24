import { render } from 'preact';

export default async () => {
  render(<Extension />, document.body);
}

function Extension() {
  return (
    <s-tile
      heading="Vagaro Appointments"
      subheading="View pending appointments"
      onClick={() => shopify.action.presentModal()}
    />
  );
}
