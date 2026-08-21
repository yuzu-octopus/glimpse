import { z } from 'zod';
import { dockerContainersSchema } from '../../shared/widgets/docker';
import type { DockerContainer, DockerData } from '../../shared/widgets/payloads';
import { getDefaultTtl, parseCacheDuration } from '../cache';
import { registerWidget } from './registry';

/** Bun fetch extension: HTTP over a unix domain socket. */
type SocketFetch = (url: string, init?: RequestInit & { unix?: string }) => Promise<Response>;

const LABEL = {
  hide: 'glance.hide',
  name: 'glance.name',
  url: 'glance.url',
  description: 'glance.description',
  sameTab: 'glance.same-tab',
  id: 'glance.id',
  parent: 'glance.parent',
  category: 'glance.category',
} as const;

/** Lower sorts first — problems surface at the top (glance parity). */
const STATE_PRIORITY: Record<DockerContainer['stateIcon'], number> = {
  warn: 0,
  unknown: 1,
  paused: 2,
  ok: 3,
};

interface RawContainer {
  Names?: string[];
  Image?: string;
  State?: string;
  Status?: string;
  Labels?: Record<string, string>;
}

function label(c: RawContainer, key: string, def = ''): string {
  const v = c.Labels?.[key];
  return v ? v : def;
}

function stateToIcon(state: string): DockerContainer['stateIcon'] {
  switch (state) {
    case 'running':
      return 'ok';
    case 'paused':
      return 'paused';
    case 'exited':
    case 'unhealthy':
    case 'dead':
      return 'warn';
    default:
      return 'unknown';
  }
}

function deriveName(c: RawContainer, formatNames: boolean): string {
  const named = label(c, LABEL.name);
  if (named) return named;
  const raw = c.Names?.[0] ?? '';
  if (!raw) return 'n/a';
  let name = raw.replace(/^\//, '');
  if (formatNames) {
    name = name.replace(/[_-]/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
  }
  return name;
}

function sortByStateThenName(list: DockerContainer[]): void {
  list.sort(
    (a, b) =>
      STATE_PRIORITY[a.stateIcon] - STATE_PRIORITY[b.stateIcon] ||
      a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
  );
}

async function fetchFromSource(
  fetchFn: typeof fetch,
  source: string,
  all: boolean,
): Promise<RawContainer[]> {
  const query = `/containers/json?all=${all}`;
  const init = { signal: AbortSignal.timeout(5_000) };
  let res: Response;
  if (/^(tcp|https?):\/\//.test(source)) {
    const base = source.replace(/^tcp:/, 'http:').replace(/\/+$/, '');
    res = await fetchFn(`${base}${query}`, init);
  } else {
    res = await (fetchFn as SocketFetch)(`http://localhost${query}`, { ...init, unix: source });
  }
  if (!res.ok) throw new Error(`docker: non-200 response status: ${res.status}`);
  return (await res.json()) as RawContainer[];
}

/** Takes the schema's *input* shape — fields with defaults (sock-path) stay optional. */
export async function fetchDockerContainers(
  fetchFn: typeof fetch,
  cfg: z.input<typeof dockerContainersSchema>,
): Promise<DockerData> {
  let containers = await fetchFromSource(
    fetchFn,
    cfg['sock-path'] ?? '/var/run/docker.sock',
    !cfg['running-only'],
  );

  // Config label overrides apply to the bare container name (glance parity).
  const overrides = cfg.containers ?? {};
  for (const c of containers) {
    const name = (c.Names?.[0] ?? '').replace(/^\//, '');
    const o = overrides[name];
    if (!o) continue;
    c.Labels = { ...c.Labels };
    for (const [k, v] of Object.entries(o)) c.Labels[`glance.${k}`] = v;
  }

  if (cfg.category) {
    containers = containers.filter((c) => label(c, LABEL.category) === cfg.category);
  }

  // Split into parents and children; drop hidden ones (label wins over hide-by-default).
  const parents: RawContainer[] = [];
  const childrenByParent = new Map<string, RawContainer[]>();
  for (const c of containers) {
    const hideLabel = label(c, LABEL.hide);
    const hidden = hideLabel
      ? hideLabel === 'true' || hideLabel === '1'
      : (cfg['hide-by-default'] ?? false);
    if (hidden) continue;
    const parentId = label(c, LABEL.id);
    const parentRef = label(c, LABEL.parent);
    if (!parentId && parentRef) {
      const list = childrenByParent.get(parentRef) ?? [];
      list.push(c);
      childrenByParent.set(parentRef, list);
    } else {
      parents.push(c);
    }
  }

  const formatNames = cfg['format-container-names'] ?? false;
  const result: DockerData = parents.map((c) => {
    const children = (childrenByParent.get(label(c, LABEL.id)) ?? []).map((child) => ({
      name: deriveName(child, formatNames),
      image: child.Image ?? '',
      state: (child.State ?? '').toLowerCase(),
      stateIcon: stateToIcon((child.State ?? '').toLowerCase()),
      stateText: (child.Status ?? '').toLowerCase(),
      icon: { url: '', autoInvert: false },
    }));
    sortByStateThenName(children);

    const sameTabLabel = label(c, LABEL.sameTab, 'false');
    const dc: DockerContainer = {
      name: deriveName(c, formatNames),
      image: c.Image ?? '',
      state: (c.State ?? '').toLowerCase(),
      stateIcon: stateToIcon((c.State ?? '').toLowerCase()),
      stateText: (c.Status ?? '').toLowerCase(),
      url: label(c, LABEL.url) || undefined,
      sameTab: sameTabLabel === 'true' || sameTabLabel === '1',
      description: label(c, LABEL.description) || undefined,
      icon: { url: '/dockerhub.svg', autoInvert: false },
      children: children.length > 0 ? children : undefined,
    };

    // A warn child bubbles up to the group badge (glance parity).
    if (children.some((ch) => ch.stateIcon === 'warn')) dc.stateIcon = 'warn';
    return dc;
  });

  sortByStateThenName(result);
  return result;
}

registerWidget('docker-containers', async (ctx, config) => {
  const cfg = dockerContainersSchema.parse(config);
  const key = `docker-containers:${JSON.stringify(cfg)}`;
  const ttl = parseCacheDuration(cfg.cache ?? '10s') || getDefaultTtl('docker-containers');
  return ctx.singleflight.run(key, async () => {
    const cached = ctx.cache.get<DockerData>(key);
    if (cached) return cached;
    const data = await fetchDockerContainers(ctx.fetch, cfg);
    ctx.cache.set(key, data, ttl);
    return data;
  });
});
