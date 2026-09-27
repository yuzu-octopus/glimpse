import { defineMediaWidget, pickTorrents } from '../_media/factory';
import { TorrentList } from '../_media/media';

const Transmission = defineMediaWidget('transmission', {
  defaultTitle: 'Transmission',
  emptyText: 'No torrents',
  pick: pickTorrents,
  render: (torrents) => <TorrentList torrents={torrents} />,
});

export default Transmission;
