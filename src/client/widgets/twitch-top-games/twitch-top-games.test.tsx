import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TwitchTopGames from './index';
import type { TwitchTopGamesData } from '../../../shared/widgets/payloads';

const games: TwitchTopGamesData = [
  { id: '1', name: 'Just Chatting', boxArtUrl: 'https://img/chat-285x380.jpg', url: 'https://www.twitch.tv/directory/category/just-chatting' },
  { id: '2', name: 'League of Legends', boxArtUrl: null, url: 'https://www.twitch.tv/directory/category/league-of-legends' },
];

describe('twitch-top-games widget', () => {
  it('renders ranked games with box art', () => {
    render(<TwitchTopGames config={{ type: 'twitch-top-games' }} data={games} />);
    expect(screen.getByText('Just Chatting')).toBeInTheDocument();
    expect(screen.getByText('League of Legends')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    const img = screen.getByAltText('');
    expect(img).toHaveAttribute('src', 'https://img/chat-285x380.jpg');
  });

  it('collapses beyond collapse-after until "Show more" is clicked', () => {
    render(<TwitchTopGames config={{ type: 'twitch-top-games', 'collapse-after': 1 }} data={games} />);
    expect(screen.getByText(/Show more \(1\)/)).toBeInTheDocument();
  });

  it('survives empty data and surfaces errors', () => {
    render(<TwitchTopGames config={{ type: 'twitch-top-games' }} data={[]} />);
    expect(screen.getByText(/No top games/)).toBeInTheDocument();
    render(<TwitchTopGames config={{ type: 'twitch-top-games' }} data={null} error="HTTP 401 for api.twitch.tv" />);
    expect(screen.getByText(/HTTP 401/)).toBeInTheDocument();
  });
});
