import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ModelEndpointsData } from '../../../shared/widgets/payloads';
import ModelEndpoints from './index';

const CONFIG = { type: 'model-endpoints', models: ['openai/gpt-4o'] };

const PAYLOAD: ModelEndpointsData = {
  models: [
    {
      model: 'openai/gpt-4o',
      name: 'OpenAI: GPT-4o',
      health: 'down',
      providers: 2,
      up: 0,
      degraded: 1,
      down: 1,
      unavailable: true,
      url: 'https://openrouter.ai/openai/gpt-4o',
    },
  ],
  rows: [
    {
      model: 'openai/gpt-4o',
      modelName: 'OpenAI: GPT-4o',
      provider: 'DeepSeek',
      tag: 'deepseek',
      health: 'down',
      status: -5,
      uptime5m: null,
      uptime30m: null,
      uptime1d: 0,
      url: 'https://openrouter.ai/openai/gpt-4o',
    },
    {
      model: 'openai/gpt-4o',
      modelName: 'OpenAI: GPT-4o',
      provider: 'Azure',
      tag: 'azure',
      health: 'up',
      status: 0,
      uptime5m: 100,
      uptime30m: 99.8074,
      uptime1d: 99.904,
      url: 'https://openrouter.ai/openai/gpt-4o',
    },
  ],
  total: 12,
  checked: 1,
  requested: 1,
  failed: [],
};

describe('model-endpoints widget', () => {
  it('renders one row per endpoint with the provider and its uptime windows', () => {
    render(<ModelEndpoints config={CONFIG} data={PAYLOAD} />);
    const down = within(screen.getByRole('row', { name: /DeepSeek/ }));
    const up = within(screen.getByRole('row', { name: /Azure/ }));
    expect(up.getByText('99.8')).toBeInTheDocument();
    expect(up.getByText('99.9')).toBeInTheDocument();
    // 5m and 30m have no sample upstream: an em dash each, never a
    // fabricated 0 that would read as a dead provider.
    expect(down.getAllByText('—')).toHaveLength(2);
    expect(down.getByText('0.0')).toBeInTheDocument();
  });

  it('prints the model once per block, but keeps it on every row for a11y', () => {
    render(<ModelEndpoints config={CONFIG} data={PAYLOAD} />);
    // Two rows of one model: one visible link, not two.
    expect(screen.getAllByRole('link', { name: /^openai\/gpt-4o/ })).toHaveLength(1);
    // The continuation row still resolves to the model it belongs to.
    expect(screen.getByRole('row', { name: /openai\/gpt-4o.*Azure/ })).toBeInTheDocument();
  });
  it('paints health through the kit StatusDot, not a coloured cell', () => {
    render(<ModelEndpoints config={CONFIG} data={PAYLOAD} />);
    const down = screen.getByRole('img', { name: 'down' });
    expect(down.className).toContain('astryx-statusdot');
    expect(down).toHaveAttribute('data-variant', 'error');
    expect(screen.getByRole('img', { name: 'up' })).toHaveAttribute('data-variant', 'success');
  });

  it('makes the model id tappable, and it opens the model page', () => {
    render(<ModelEndpoints config={CONFIG} data={PAYLOAD} />);
    const link = screen.getByRole('link', { name: /^openai\/gpt-4o/ });
    expect(link).toHaveAttribute('href', 'https://openrouter.ai/openai/gpt-4o');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('summarises the rollup and how many rows the limit hid', () => {
    render(<ModelEndpoints config={CONFIG} data={PAYLOAD} />);
    expect(screen.getByText(/1\/1 models · 2 providers · 1 degraded · 1 down/)).toBeInTheDocument();
    expect(screen.getByText(/\+10 more/)).toBeInTheDocument();
  });

  it('says so plainly when unhealthy-only finds nothing wrong', () => {
    render(
      <ModelEndpoints
        config={{ ...CONFIG, 'unhealthy-only': true }}
        data={{
          ...PAYLOAD,
          rows: [],
          total: 0,
          models: [
            {
              ...PAYLOAD.models[0],
              health: 'up',
              up: 2,
              degraded: 0,
              down: 0,
              unavailable: false,
            },
          ],
        }}
      />,
    );
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('Every provider is up')).toBeInTheDocument();
  });

  it('does not call an unreachable model an empty result', () => {
    render(
      <ModelEndpoints
        config={CONFIG}
        data={{ ...PAYLOAD, rows: [], total: 0, models: [], checked: 0, failed: ['openai/gpt-4o'] }}
      />,
    );
    expect(screen.getByText('No models answered')).toBeInTheDocument();
  });

  it('renders the chrome only while loading', () => {
    render(<ModelEndpoints config={CONFIG} data={null} isLoading />);
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('stays quiet on a failure when show-errors is off', () => {
    render(<ModelEndpoints config={{ ...CONFIG, 'show-errors': false }} data={null} error="boom" />);
    expect(screen.queryByText(/boom/)).toBeNull();
  });

  it('surfaces the failure when show-errors is on', () => {
    render(<ModelEndpoints config={CONFIG} data={null} error="boom" />);
    expect(screen.getByText(/boom/)).toBeInTheDocument();
  });
});
