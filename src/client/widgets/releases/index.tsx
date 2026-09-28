import { useState, type CSSProperties } from 'react';
import { Badge, Card, Collapsible, HStack, Icon, Link, Text } from '@astryxdesign/core';
import { Container, GitBranch } from 'lucide-react';
import { RELEASES_DEFAULTS, type ReleasesConfig } from '../../../shared/widgets/feeds';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { useAge } from '../_hooks/useAge';
import type { Release } from '../../../shared/widgets/payloads';
import styles from './releases.module.css';
void RELEASES_DEFAULTS;

/** Kit nested-inset surface (spacing.md: outer card `padding={4}`, nested
 *  `padding={3}`): background plus a separator border, never a direct fill. */
const insetCard: CSSProperties = {
  backgroundColor: 'var(--color-background)',
  border: 'var(--border-width) solid var(--color-separator)',
};

function SourceIcon({ source }: { source: Release['source'] }) {
  const IconComponent =
    source === 'github' || source === 'gitlab' || source === 'codeberg' ? GitBranch : Container;
  // Secondary, not `inherit` — an icon must not tint with its neighbours.
  return <Icon icon={IconComponent} size="sm" color="secondary" />;
}

function releaseKey(r: Release): string {
  // Stable identity across poll refreshes: url is unique per release; tag
  // added to guard docker-hub tags sharing one url path.
  return `${r.url}::${r.tag}`;
}

/** Whole lines of notes shown in the expanded row before the ellipsis. */
const NOTES_PREVIEW_LINES = 10;

function ReleaseRow({
  release,
  showIcon,
  open,
  onToggle,
}: {
  release: Release;
  showIcon: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const age = useAge(release.published);
  const trimmed = release.notes?.trim() ?? '';
  const hasNotes = trimmed.length > 0;

  /* The row stays a plain container holding the release link and the
     disclosure — a role="button" host around both would nest interactive
     controls (WCAG 4.1.2). Collapsible owns the toggle, so this row only
     supplies the trigger label; aria-expanded, aria-controls and the chevron
     are the primitive's job. The open flag is still parent-controlled, keyed
     by url::tag, so a poll that swaps object identity does not collapse it. */
  return (
    <div className={styles.row}>
      <HStack gap={1} vAlign="center">
        <Link
          href={release.url}
          target="_blank"
          type="body"
          maxLines={1}
          hasUnderline={false}
          className={styles.title}
        >
          {release.name || release.tag}
        </Link>
      </HStack>
      {/* Metadata: every edge on the 4px half-step (`gap={1}`), the separator
          as its own item so chip and age get the same beat. Age is metadata. */}
      <HStack gap={1} vAlign="center" wrap="wrap" className={styles.meta}>
        {showIcon ? <SourceIcon source={release.source} /> : null}
        {release.tag ? <Badge variant="yellow" label={release.tag} className={styles.tag} /> : null}
        {release.published ? (
          <>
            <Text type="supporting" aria-hidden="true">
              ·
            </Text>
            <Text type="supporting">{age}</Text>
          </>
        ) : null}
      </HStack>
      {hasNotes ? (
        <Collapsible
          className={styles.disclosure}
          isOpen={open}
          onOpenChange={onToggle}
          trigger="Release notes"
        >
          {/* Upstream changelogs run to thousands of lines, so the inset
              clamps to whole lines with a real ellipsis — no half-cut
              line, no nested scroller. The row title links to the full
              release, which is where glance sends readers too. Collapsed
              rows render no card at all: hidden copy is still text. */}
          {open ? (
            <Card variant="transparent" padding={3} style={insetCard} className={styles.notesCard}>
              <Text type="body" as="div" maxLines={NOTES_PREVIEW_LINES} wordBreak="break-all" className={styles.notes}>
                {trimmed}
              </Text>
            </Card>
          ) : null}
        </Collapsible>
      ) : null}
    </div>
  );
}

function Releases({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as ReleasesConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  const releases = ((data as { releases?: Release[] } | null)?.releases ?? []) as Release[];
  const showIcon = cfg['show-source-icon'] === true;
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggle = (k: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      error={error}
      showErrors={cfg['show-errors']}
      isLoading={loading}
      collapseAfter={cfg['collapse-after']}
      items={releases.map((r) => {
        const k = releaseKey(r);
        return (
          <ReleaseRow
            key={k}
            release={r}
            showIcon={showIcon}
            open={expanded.has(k)}
            onToggle={() => toggle(k)}
          />
        );
      })}
    />
  );
}

registerWidgetComponent('releases', Releases);

export default Releases;
