import { defineMediaWidget, pickTorrents } from '../_media/factory';
import { TorrentList } from '../_media/media';

const Qbittorrent = defineMediaWidget('qbittorrent', {
  defaultTitle: 'qBittorrent',
  emptyText: 'No torrents',
  pick: pickTorrents,
  render: (torrents) => <TorrentList torrents={torrents} />,
});

export default Qbittorrent;
