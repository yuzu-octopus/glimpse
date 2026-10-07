import { fireEvent, render, screen } from '@testing-library/react';
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
    // Asserting the label alone passed even if the collapse stopped
    // truncating entirely.
    expect(screen.queryByText('League of Legends')).toBeNull();
    fireEvent.click(screen.getByText(/Show more \(1\)/));
    expect(screen.getByText('League of Legends')).toBeInTheDocument();
  });

  it('survives empty data and surfaces errors', () => {
    render(<TwitchTopGames config={{ type: 'twitch-top-games' }} data={[]} />);
    expect(screen.getByText(/No top games/)).toBeInTheDocument();
    render(<TwitchTopGames config={{ type: 'twitch-top-games' }} data={null} error="HTTP 401 for api.twitch.tv" />);
    expect(screen.getByText(/HTTP 401/)).toBeInTheDocument();
  });

  it('renders no img when boxArtUrl is null', () => {
    const { container } = render(<TwitchTopGames config={{ type: 'twitch-top-games' }} data={games} />);
    // Second game has boxArtUrl: null
    const rows = container.querySelectorAll('[class*="row"]');
    expect(rows[1].querySelector('img')).toBeNull();
  });

  it('links each game to its Twitch directory URL', () => {
    render(<TwitchTopGames config={{ type: 'twitch-top-games' }} data={games} />);
    expect(screen.getByRole('link', { name: 'Just Chatting' })).toHaveAttribute(
      'href',
      'https://www.twitch.tv/directory/category/just-chatting',
    );
    expect(screen.getByRole('link', { name: 'League of Legends' })).toHaveAttribute(
      'href',
      'https://www.twitch.tv/directory/category/league-of-legends',
    );
  });

  it('renders correct rank numbers', () => {
    render(<TwitchTopGames config={{ type: 'twitch-top-games' }} data={games} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('does not collapse when games fit within collapse-after', () => {
    render(<TwitchTopGames config={{ type: 'twitch-top-games', 'collapse-after': 5 }} data={games} />);
    expect(screen.getByText('Just Chatting')).toBeInTheDocument();
    expect(screen.getByText('League of Legends')).toBeInTheDocument();
    expect(screen.queryByText(/Show more/)).toBeNull();
  });

  it('toggles to "Show less" when expanded', () => {
    render(<TwitchTopGames config={{ type: 'twitch-top-games', 'collapse-after': 1 }} data={games} />);
    fireEvent.click(screen.getByText(/Show more \(1\)/));
    expect(screen.getByText('League of Legends')).toBeInTheDocument();
    expect(screen.getByText('Show less')).toBeInTheDocument();
  });
});
