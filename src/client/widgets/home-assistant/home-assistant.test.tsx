import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { HomeAssistantEntity } from '../../../shared/widgets/payloads';
import HomeAssistant from './index';

function entity(over: Partial<HomeAssistantEntity> & { id: string }): HomeAssistantEntity {
  return {
    name: over.id,
    domain: over.id.split('.')[0],
    raw: '',
    value: '',
    status: 'neutral',
    numeric: false,
    ...over,
  };
}

const DATA = {
  entities: [
    entity({ id: 'binary_sensor.front_door', name: 'Front Door', value: 'Closed', raw: 'off', status: 'positive' }),
    entity({ id: 'binary_sensor.garage_door', name: 'Garage', value: 'Open', raw: 'on', status: 'negative' }),
    entity({
      id: 'sensor.living_room_temp',
      name: 'Living Room Temp',
      value: '21.5 °C',
      raw: '21.5',
      numeric: true,
    }),
  ],
};

describe('home-assistant widget', () => {
  it('renders one row per entity with its state word, not its raw state', () => {
    render(<HomeAssistant config={{ type: 'home-assistant' }} data={DATA} />);
    expect(screen.getByText('Front Door')).toBeInTheDocument();
    expect(screen.getByText('Closed')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('21.5 °C')).toBeInTheDocument();
    expect(screen.queryByText('off')).toBeNull();
  });

  it('shows the entity id as supporting text under the name', () => {
    render(<HomeAssistant config={{ type: 'home-assistant' }} data={DATA} />);
    expect(screen.getByText('binary_sensor.front_door')).toBeInTheDocument();
  });

  it('colours the status dot from the resolved status', () => {
    render(<HomeAssistant config={{ type: 'home-assistant' }} data={DATA} />);
    expect(screen.getAllByTestId('ha-status-positive')).toHaveLength(1);
    expect(screen.getAllByTestId('ha-status-negative')).toHaveLength(1);
    expect(screen.getAllByTestId('ha-status-neutral')).toHaveLength(1);
  });

  it('renders nothing but chrome while loading', () => {
    render(<HomeAssistant config={{ type: 'home-assistant' }} data={null} isLoading />);
    expect(screen.queryByText('Front Door')).toBeNull();
  });

  it('surfaces fetch errors via chrome', () => {
    render(<HomeAssistant config={{ type: 'home-assistant' }} data={null} error="boom" />);
    expect(screen.getByText(/boom/)).toBeInTheDocument();
  });
});
