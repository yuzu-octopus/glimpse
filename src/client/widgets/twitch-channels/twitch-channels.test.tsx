import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TwitchChannels from './index';
import type { TwitchChannelsData } from '../../../shared/widgets/payloads';

const streams: TwitchChannelsData = [
  {
    login: 'xqc', displayName: 'xQc', title: 'Variety day', gameName: 'Just Chatting',
    viewerCount: 42000, thumbnailUrl: 'https://img/live-320x180.jpg',
    profileImageUrl: 'https://img/xqc.png', url: 'https://www.twitch.tv/xqc', live: true,
  },
  {
    login: 'shroud', displayName: 'Shroud', title: '', gameName: '',
    viewerCount: 0, thumbnailUrl: null,
    profileImageUrl: 'https://img/shroud.png', url: 'https://www.twitch.tv/shroud', live: false,
  },
];

describe('twitch-channels widget', () => {
  it('renders live stream with thumbnail + viewer count', () => {
    render(<TwitchChannels config={{ type: 'twitch-channels' }} data={streams} />);
    expect(screen.getByText('Variety day')).toBeInTheDocument();
    expect(screen.getByText(/42k watching/)).toBeInTheDocument();
    expect(screen.getByText('Just Chatting')).toBeInTheDocument();
    const img = screen.getByAltText('');
    expect(img).toHaveAttribute('src', 'https://img/live-320x180.jpg');
  });

  it('marks offline channels', () => {
    render(<TwitchChannels config={{ type: 'twitch-channels' }} data={streams} />);
    expect(screen.getByText('Shroud')).toBeInTheDocument();
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('collapses beyond collapse-after until "Show more" is clicked', () => {
    render(<TwitchChannels config={{ type: 'twitch-channels', 'collapse-after': 1 }} data={streams} />);
    expect(screen.getByText(/Show more \(1\)/)).toBeInTheDocument();
  });

  it('survives empty data and surfaces errors', () => {
    render(<TwitchChannels config={{ type: 'twitch-channels' }} data={[]} />);
    expect(screen.getByText(/No channels/)).toBeInTheDocument();
    render(<TwitchChannels config={{ type: 'twitch-channels' }} data={null} error="HTTP 401 for api.twitch.tv" />);
    expect(screen.getByText(/HTTP 401/)).toBeInTheDocument();
  });
});
