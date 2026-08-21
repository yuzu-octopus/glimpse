import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import type { WidgetFetchContext } from './registry';

const mockFetch = vi.fn();


// Import fetcher after mock setup
import './docker';
import { serverWidgets } from './registry';
import { fetchDockerContainers } from './docker';
import { dockerContainersSchema } from '../../shared/widgets/docker';

function makeCtx(): WidgetFetchContext {
  return {
    fetch: mockFetch as unknown as typeof fetch,
    env: {},
    cache: new TtlCache(),
    singleflight: new Singleflight(),
  };
}

const raw = [
  {
    Names: ['/jellyfin'],
    Image: 'jellyfin/jellyfin',
    State: 'running',
    Status: 'Up 3 days',
    Labels: {},
  },
  {
    Names: ['/pihole'],
    Image: 'pihole/pihole',
    State: 'exited',
    Status: 'Exited (1) 2 hours ago',
    Labels: {},
  },
  {
    Names: ['/stack_nginx_1'],
    Image: 'nginx',
    State: 'running',
    Status: 'Up 5 days',
    Labels: { 'com.docker.compose.project': 'stack' },
    // grouped under stack via glance.parent override below
  },
];
describe('docker-containers fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation(async () =>
      new Response(JSON.stringify(raw), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
  });

  it('parses config with zod and defaults sock-path', () => {
    const cfg = dockerContainersSchema.parse({ type: 'docker-containers' });
    expect(cfg['sock-path']).toBe('/var/run/docker.sock');
  });

  it('fetches over unix socket and returns sorted containers', async () => {
    const data = await fetchDockerContainers(mockFetch as unknown as typeof fetch, {
      type: 'docker-containers',
      'sock-path': '/var/run/docker.sock',
    });
    expect(mockFetch).toHaveBeenCalledWith('http://localhost/containers/json?all=true', expect.anything());
    const init = mockFetch.mock.calls[0][1] as { unix?: string };
    expect(init.unix).toBe('/var/run/docker.sock');

    // exited (warn) sorts before running (ok)
    expect(data[0].name).toBe('pihole');
    expect(data[0].stateIcon).toBe('warn');
    expect(data[1].name).toBe('jellyfin');
    expect(data[1].stateIcon).toBe('ok');
    expect(data[1].stateText).toBe('up 3 days');
  });

  it('groups children via glance.parent label override', async () => {
    mockFetch.mockImplementationOnce(async () =>
      new Response(
        JSON.stringify([
          { Names: ['/stack'], Image: 'compose', State: 'running', Status: 'Up 5 days', Labels: {} },
          { Names: ['/stack_nginx_1'], Image: 'nginx', State: 'running', Status: 'Up 5 days', Labels: {} },
        ]),
        { status: 200 },
      ),
    );
    const data = await fetchDockerContainers(mockFetch as unknown as typeof fetch, {
      type: 'docker-containers',
      containers: {
        stack: { id: 'stack' },
        stack_nginx_1: { parent: 'stack', name: 'nginx' },
      },
    });
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('stack');
    expect(data[0].children?.map((c) => c.name)).toEqual(['nginx']);
  });

  it('bubbles warn child state to parent group', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          { Names: ['/grp'], Image: 'x', State: 'running', Status: 'Up', Labels: {} },
          { Names: ['/grp_db'], Image: 'db', State: 'exited', Status: 'Exited', Labels: {} },
        ]),
        { status: 200 },
      ),
    );
    const data = await fetchDockerContainers(mockFetch as unknown as typeof fetch, {
      type: 'docker-containers',
      containers: { grp: { id: 'grp' }, grp_db: { parent: 'grp' } },
    });
    expect(data[0].name).toBe('grp');
    expect(data[0].stateIcon).toBe('warn');
  });

  it('hides containers via glance.hide label and hide-by-default', async () => {
    let data = await fetchDockerContainers(mockFetch as unknown as typeof fetch, {
      type: 'docker-containers',
      containers: { pihole: { hide: 'true' } },
    });
    expect(data.map((c) => c.name)).not.toContain('pihole');

    data = await fetchDockerContainers(mockFetch as unknown as typeof fetch, {
      type: 'docker-containers',
      'hide-by-default': true,
      containers: { jellyfin: { hide: 'false' } },
    });
    expect(data.map((c) => c.name)).toEqual(['jellyfin']);
  });

  it('filters by category', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          { Names: ['/a'], Image: 'a', State: 'running', Status: 'Up', Labels: { 'glance.category': 'media' } },
          { Names: ['/b'], Image: 'b', State: 'running', Status: 'Up', Labels: {} },
        ]),
        { status: 200 },
      ),
    );
    const data = await fetchDockerContainers(mockFetch as unknown as typeof fetch, {
      type: 'docker-containers',
      category: 'media',
    });
    expect(data.map((c) => c.name)).toEqual(['a']);
  });

  it('respects running-only (all=false)', async () => {
    await fetchDockerContainers(mockFetch as unknown as typeof fetch, {
      type: 'docker-containers',
      'running-only': true,
    });
    expect(mockFetch.mock.calls[0][0]).toContain('all=false');
  });

  it('supports tcp:// http endpoints without unix option', async () => {
    await fetchDockerContainers(mockFetch as unknown as typeof fetch, {
      type: 'docker-containers',
      'sock-path': 'tcp://192.168.1.50:2375',
    });
    expect(mockFetch).toHaveBeenCalledWith('http://192.168.1.50:2375/containers/json?all=true', expect.anything());
    const init = mockFetch.mock.calls[0][1] as { unix?: string };
    expect(init.unix).toBeUndefined();
  });

  it('throws on non-200', async () => {
    mockFetch.mockResolvedValueOnce(new Response('denied', { status: 403 }));
    const ctx = makeCtx();
    await expect(serverWidgets.get('docker-containers')!(ctx, { type: 'docker-containers' })).rejects.toThrow(
      /non-200/,
    );
  });

  it('caches via ctx.cache + singleflight', async () => {
    const ctx = makeCtx();
    await serverWidgets.get('docker-containers')!(ctx, { type: 'docker-containers' });
    await serverWidgets.get('docker-containers')!(ctx, { type: 'docker-containers' });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('formats names when format-container-names set', async () => {
    const data = await fetchDockerContainers(mockFetch as unknown as typeof fetch, {
      type: 'docker-containers',
      'format-container-names': true,
    });
    expect(data.find((c) => c.image === 'nginx')?.name).toBe('Stack Nginx 1');
  });
});
