import type { JellyfinConfig } from '../../../shared/widgets/media';
import type { MediaData } from '../../../shared/widgets/payloads';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { MediaGrid } from '../_media/media';
import sharedStyles from '../_media/media.module.css';

function Jellyfin({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as JellyfinConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  const items = ((data as MediaData | null)?.items ?? []) as MediaData['items'];
  if (loading) {
    return (
      <WidgetChrome
        title={cfg.title ?? 'Jellyfin'}
        titleUrl={cfg['title-url']}
        hideHeader={cfg['hide-header']}
        cssClass={cfg['css-class']}
        isLoading
      />
    );
  }
  if (items.length === 0 && !error) {
    return (
      <WidgetChrome
        title={cfg.title ?? 'Jellyfin'}
        titleUrl={cfg['title-url']}
        hideHeader={cfg['hide-header']}
        cssClass={cfg['css-class']}
      >
        <div className={sharedStyles.placeholder}>No recently added media</div>
      </WidgetChrome>
    );
  }
  return (
    <WidgetChrome
      title={cfg.title ?? 'Jellyfin'}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      error={error}
    >
      <MediaGrid items={items} />
    </WidgetChrome>
  );
}

registerWidgetComponent('jellyfin', Jellyfin);

export default Jellyfin;
