import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DockerContainers from './index';
import type { DockerData } from '../../../shared/widgets/payloads';

const data: DockerData = [
  {
    name: 'pihole',
    image: 'pihole/pihole',
    state: 'exited',
    stateIcon: 'warn',
    stateText: 'exited (1) 2 hours ago',
    icon: { url: '/dockerhub.svg', autoInvert: false },
  },
  {
    name: 'stack',
    image: 'compose',
    state: 'running',
    stateIcon: 'ok',
    stateText: 'up 5 days',
    url: 'https://stack.lab',
    description: 'Compose stack',
    icon: { url: '/dockerhub.svg', autoInvert: false },
    children: [
      {
        name: 'nginx',
        image: 'nginx',
        state: 'running',
        stateIcon: 'ok',
        stateText: 'up 5 days',
        icon: { url: '', autoInvert: false },
      },
    ],
  },
];

describe('docker-containers widget', () => {
  it('renders containers with names and images', () => {
    render(<DockerContainers config={{ type: 'docker-containers', title: 'Docker' }} data={data} />);
    expect(screen.getByText('Docker')).toBeInTheDocument();
    expect(screen.getByText('pihole')).toBeInTheDocument();
    expect(screen.getByText('pihole/pihole')).toBeInTheDocument();
    expect(screen.getByText('stack')).toBeInTheDocument();
  });

  it('renders state badges per state icon', () => {
    render(<DockerContainers config={{ type: 'docker-containers' }} data={data} />);
    expect(screen.getAllByTestId('docker-state-warn').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('docker-state-ok').length).toBeGreaterThan(0);
    expect(screen.getByTitle(/exited/)).toBeInTheDocument();
  });

  it('links container name when url label set, honoring same-tab default (new tab)', () => {
    render(<DockerContainers config={{ type: 'docker-containers' }} data={data} />);
    const link = screen.getByRole('link', { name: 'stack' });
    expect(link).toHaveAttribute('href', 'https://stack.lab');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('expands children on click and shows child rows', () => {
    render(<DockerContainers config={{ type: 'docker-containers' }} data={data} />);
    expect(screen.queryByText('nginx')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /1 container/ }));
    expect(screen.getByText('nginx')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1 container/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows loading skeleton while data is null', () => {
    render(<DockerContainers config={{ type: 'docker-containers' }} data={null} />);
    expect(screen.getByTestId('widget-loading')).toBeInTheDocument();
  });

  it('surfaces fetch errors via chrome', () => {
    render(
      <DockerContainers config={{ type: 'docker-containers' }} data={null} error="docker socket unreachable" />,
    );
    expect(screen.getByText('docker socket unreachable')).toBeInTheDocument();
    expect(screen.getByTestId('widget-error-dot')).toBeInTheDocument();
  });
});
