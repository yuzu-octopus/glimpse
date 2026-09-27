import { defineMediaWidget, pickItems } from '../_media/factory';
import { MediaGrid } from '../_media/media';

const Immich = defineMediaWidget('immich', {
  defaultTitle: 'Immich',
  emptyText: 'No recent photos',
  pick: pickItems,
  render: (items) => <MediaGrid items={items} />,
});

export default Immich;
