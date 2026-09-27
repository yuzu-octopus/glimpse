import { defineMediaWidget, pickTorrents, TorrentList } from '../_media/media';

const Qbittorrent = defineMediaWidget('qbittorrent', {
  defaultTitle: 'qBittorrent',
  emptyText: 'No torrents',
  pick: pickTorrents,
  render: (torrents) => <TorrentList torrents={torrents} />,
});

export default Qbittorrent;
