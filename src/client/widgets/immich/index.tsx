import { defineMediaWidget, MediaGrid, pickItems } from '../_media/media';

const Immich = defineMediaWidget('immich', {
  defaultTitle: 'Immich',
  emptyText: 'No recent photos',
  pick: pickItems,
  render: (items) => <MediaGrid items={items} />,
});

export default Immich;
