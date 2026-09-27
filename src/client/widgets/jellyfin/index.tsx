import { defineMediaWidget, pickItems } from '../_media/factory';
import { MediaGrid } from '../_media/media';

const Jellyfin = defineMediaWidget('jellyfin', {
  defaultTitle: 'Jellyfin',
  emptyText: 'No recently added media',
  pick: pickItems,
  render: (items) => <MediaGrid items={items} />,
});

export default Jellyfin;
