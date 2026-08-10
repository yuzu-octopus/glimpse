import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TwitchChannels, TwitchTopGames } from './index';

const channels = [
  {
    login: 'shroud',
    displayName: 'shroud',
    live: true,
    viewers: 25000,
    title: 'Ranked grind',
    game: 'Valorant',
    thumbnail: 'https://static-cdn.jtvnw.net/previews-ttv/live_user_shroud-320x180.jpg',
  },
  {
    login: 'some_offline',
    displayName: 'some_offline',
    live: false,
    viewers: 0,
    title: null,
    game: null,
    thumbnail: null,
  },
];

const games = [
  { id: '509658', name: 'Just Chatting', thumbnail: 'https://static-cdn.jtvnw.net/ttv-boxart/Just%20Chatting-144x192.jpg' },
  { id: '27471', name: 'Minecraft', thumbnail: null },
];

describe('twitch-channels widget', () => {
  it('renders live channels with LIVE badge, viewers and game', () => {
    render(<TwitchChannels config={{ type: 'twitch-channels', title: 'Channels', channels: ['shroud'] }} data={{ channels }} />);
    expect(screen.getByText('Channels')).toBeInTheDocument();
    expect(screen.getAllByText('shroud').length).toBeGreaterThan(0);
    expect(screen.getByText('LIVE')).toBeInTheDocument();
    expect(screen.getByText('25,000')).toBeInTheDocument();
    expect(screen.getByText('Ranked grind')).toBeInTheDocument();
    expect(screen.getByText('Valorant')).toBeInTheDocument();
  });

  it('renders offline channels dimmed without live details', () => {
    render(<TwitchChannels config={{ type: 'twitch-channels', channels: ['shroud'] }} data={{ channels }} />);
    expect(screen.getByText('some_offline')).toBeInTheDocument();
    expect(screen.getAllByText('LIVE').length).toBe(1);
    expect(screen.queryByText('Ranked grind')).toBeInTheDocument();
  });
});

describe('twitch-top-games widget', () => {
  it('renders games with rank numbers', () => {
    render(<TwitchTopGames config={{ type: 'twitch-top-games', title: 'Top Games' }} data={{ games }} />);
    expect(screen.getByText('Top Games')).toBeInTheDocument();
    expect(screen.getByText('Just Chatting')).toBeInTheDocument();
    expect(screen.getByText('Minecraft')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('renders an empty body without crashing on empty data', () => {
    const { container } = render(
      <TwitchTopGames config={{ type: 'twitch-top-games' }} data={{ games: [] }} />,
    );
    expect(container.querySelector('[data-testid="widget-body"]')).toBeInTheDocument();
    expect(screen.queryByText('Just Chatting')).toBeNull();
  });
});
