import { defineMediaWidget, pickTorrents, TorrentList } from '../_media/media';

const Transmission = defineMediaWidget('transmission', {
  defaultTitle: 'Transmission',
  emptyText: 'No torrents',
  pick: pickTorrents,
  render: (torrents) => <TorrentList torrents={torrents} />,
});

export default Transmission;
