import { Star } from 'lucide-react';
import { HStack, Icon, Link, Stack, Text } from '@astryxdesign/core';
import type { CustomApiConfig } from '../../../shared/widgets/keyed';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import type { CustomApiItem } from '../../../shared/widgets/payloads';
import styles from './custom-api.module.css';

function ItemRow({ item }: { item: CustomApiItem }) {
  const showStar = /star/i.test(item.title);
  // Purple means tappable, so the kit Link wears the title colour and the
  // underline-on-hover; a row with no url is plain body text, not a link.
  const title = item.url ? (
    <Link href={item.url} target="_blank" type="body" weight="medium" maxLines={1} hasUnderline={false}>
      {item.title}
    </Link>
  ) : (
    <Text type="body" weight="medium" maxLines={1}>
      {item.title}
    </Text>
  );
  const subtitle = item.subtitle ?? item.description;
  return (
    <HStack gap={2} vAlign="center" className={styles.row}>
      {item.image ? (
        <img src={item.image} alt="" loading="lazy" className={styles.image} />
      ) : item.icon ? (
        <img src={item.icon} alt="" loading="lazy" className={styles.icon} />
      ) : null}
      <Stack gap={0.5} className={styles.rowBody}>
        <HStack gap={1.5} vAlign="center">
          {showStar ? (
            <Icon icon={Star} size="xsm" color="warning" data-testid="custom-api-star" />
          ) : null}
          {title}
        </HStack>
        {subtitle ? <Text type="supporting" maxLines={1}>{subtitle}</Text> : null}
      </Stack>
      <Stack gap={0.5} hAlign="end" className={styles.rowRight}>
        {item.value ? (
          <Text type="body" weight="semibold" hasTabularNumbers>
            {item.value}
          </Text>
        ) : null}
        {item.timestamp ? <Text type="supporting">{item.timestamp}</Text> : null}
      </Stack>
    </HStack>
  );
}

function CustomApi({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as CustomApiConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  const items = ((data as { items?: CustomApiItem[] } | null)?.items ?? []) as CustomApiItem[];
  const frameless = cfg.frameless === true;
  const collapseAfter = cfg['collapse-after'];

  const rows = items.map((item) => <ItemRow key={`${item.title}::${item.url ?? ''}::${item.timestamp ?? ''}`} item={item} />);
  if (frameless) {
    // frameless has no chrome to hang error/loading on — surface inline but still respect collapseAfter
    if (loading) {
      return (
        <div className={styles.frameless} data-testid="custom-api-frameless">
          <div data-testid="widget-loading">Loading…</div>
        </div>
      );
    }
    if (error) {
      return (
        <div className={styles.frameless} data-testid="custom-api-frameless">
          <Text type="body" className={styles.framelessError}>
            {error}
          </Text>
        </div>
      );
    }
    // Reuse WidgetChrome collapse UI for consistency when collapseAfter is set; otherwise plain group
    if (typeof collapseAfter === 'number' && collapseAfter >= 0 && rows.length > collapseAfter) {
      return (
        <div className={styles.frameless} data-testid="custom-api-frameless">
          <WidgetChrome title={cfg.title} titleUrl={cfg['title-url']} hideHeader={cfg['hide-header']} cssClass={cfg['css-class']} collapseAfter={collapseAfter} items={rows} />
        </div>
      );
    }
    return (
      <div className={styles.frameless} data-testid="custom-api-frameless">
        {rows}
      </div>
    );
  }
  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      error={error}
      showErrors={cfg['show-errors']}
      isLoading={loading}
      collapseAfter={collapseAfter}
      items={rows}
    />
  );
}

registerWidgetComponent('custom-api', CustomApi);

export default CustomApi;
