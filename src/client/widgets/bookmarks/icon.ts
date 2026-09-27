// Port of glance's customIconField (glance/internal/glance/config-fields.go
// newCustomIconField). `icon:` is either a plain URL or a `<prefix>:<name>`
// shorthand into a public icon library on jsDelivr — the shorthand is a real
// glance feature (glance/docs/configuration.md "Icons"), so shipping it in
// config.example.yml without resolving it rendered a broken-image glyph.
//
//   si:immich   Simple Icons      https://simpleicons.org/
//   sh:immich   selfh.st icons    https://selfh.st/icons/
//   di:immich   Dashboard Icons   github.com/homarr-labs/dashboard-icons
//   mdi:camera  Material Design    https://pictogrammers.com/library/mdi/
//
// `auto-invert <…>` inverts a black glyph for the dark theme; si:/mdi: glyphs
// are black paths, so they always ask for it. The theme is dark-only, so
// glance's "invert unless the scheme is light" has no second branch here.

export interface ResolvedIcon {
  src: string;
  autoInvert: boolean;
}

const AUTO_INVERT_PREFIX = 'auto-invert ';

const SIMPLE_ICONS = 'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons';
const MDI = 'https://cdn.jsdelivr.net/npm/@mdi/svg@latest/svg';
const DASHBOARD_ICONS = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons';
const SELFHST_ICONS = 'https://cdn.jsdelivr.net/gh/selfhst/icons';

export function resolveIcon(raw: string): ResolvedIcon {
  const autoInvert = raw.startsWith(AUTO_INVERT_PREFIX);
  const value = autoInvert ? raw.slice(AUTO_INVERT_PREFIX.length) : raw;

  const colon = value.indexOf(':');
  if (colon === -1) return { src: value, autoInvert };

  const prefix = value.slice(0, colon);
  const name = value.slice(colon + 1);
  // "immich" and "immich.svg" are the same request; only the sh:/di: prefixes
  // vary by format, and they accept png as well as svg.
  const dot = name.indexOf('.');
  const basename = dot === -1 ? name : name.slice(0, dot);
  const declared = dot === -1 ? 'svg' : name.slice(dot + 1);
  const ext = declared === 'svg' || declared === 'png' ? declared : 'svg';

  switch (prefix) {
    case 'si':
      return { src: `${SIMPLE_ICONS}/${basename}.svg`, autoInvert: true };
    case 'mdi':
      return { src: `${MDI}/${basename}.svg`, autoInvert: true };
    case 'di':
      return { src: `${DASHBOARD_ICONS}/${ext}/${basename}.${ext}`, autoInvert };
    case 'sh':
      return { src: `${SELFHST_ICONS}/${ext}/${basename}.${ext}`, autoInvert };
    default:
      // Not a shorthand: a URL's scheme colon, or a host:port. Pass it through.
      return { src: value, autoInvert };
  }
}
