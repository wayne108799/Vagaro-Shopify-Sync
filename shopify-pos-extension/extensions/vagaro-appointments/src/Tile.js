import { Tile, extension } from '@shopify/ui-extensions/point-of-sale';

export default extension('pos.home.tile.render', (root, api) => {
  const tile = root.createComponent(Tile, {
    title: 'Vagaro Appointments',
    subtitle: 'View pending appointments',
    enabled: true,
    onPress: () => {
      api.action.presentModal();
    },
  });

  root.append(tile);
});
