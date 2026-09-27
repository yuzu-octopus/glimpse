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
    const { container } = render(<TwitchChannels config={{ type: 'twitch-channels' }} data={streams} />);
    expect(screen.getByText('Variety day')).toBeInTheDocument();
    expect(screen.getByText(/42k watching/)).toBeInTheDocument();
    expect(screen.getByText('Just Chatting')).toBeInTheDocument();
    // LIVE is a positive/in-progress state, so it must not wear the negative
    // hue — the kit's StatusDot owns the shape, the name and the pulse.
    const live = screen.getByRole('img', { name: 'Live' });
    expect(live).toHaveAttribute('data-variant', 'success');
    const thumb = container.querySelector('img[src="https://img/live-320x180.jpg"]');
    expect(thumb).not.toBeNull();
  });

  it('shows the channel avatar on live and offline rows alike', () => {
    render(<TwitchChannels config={{ type: 'twitch-channels' }} data={streams} />);
    // profile_image_url arrives for every channel; an offline row used to
    // have no mark at all.
    const avatars = screen.getAllByTestId('twitch-avatar');
    expect(avatars).toHaveLength(2);
    // Decorative: the channel name is the row's own link right beside it.
    expect(avatars[0]!).toHaveAttribute('role', 'presentation');
    const srcs = avatars.map((a) => a.querySelector('img')?.getAttribute('src'));
    expect(srcs).toEqual(['https://img/xqc.png', 'https://img/shroud.png']);
  });

  it('renders a channel with no avatar rather than a broken one', () => {
    render(
      <TwitchChannels
        config={{ type: 'twitch-channels' }}
        data={[{ ...streams[1]!, login: 'ghost', displayName: 'Ghost', profileImageUrl: null }]}
      />,
    );
    expect(screen.queryByTestId('twitch-avatar')).toBeNull();
    expect(screen.getByText('Ghost')).toBeInTheDocument();
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
